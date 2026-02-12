#!/usr/bin/env node
// GhostSignal API Server
// Runs the simulation with real on-chain transactions and exposes REST API for the frontend

import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { GhostAgent, Signal, Commitment } from './agent.js';
import { config, currentDir } from './config.js';
import { createLogger, printActivity } from './logger.js';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import chalk from 'chalk';

const logger = createLogger('API');
const app = express();

app.use(cors());
app.use(express.json());

// ============================================
// In-memory state
// ============================================

interface ActivityEvent {
  id: string;
  type: 'generate' | 'commit' | 'reveal' | 'verify' | 'purchase';
  timestamp: number;
  agent: string;
  data: Record<string, unknown>;
  txHash?: string;
}

const activityLog: ActivityEvent[] = [];
const MAX_LOG_SIZE = 1000;
const agents: GhostAgent[] = [];

const marketplace = {
  totalSignals: 0,
  activeCommitments: 0,
  revealedSignals: 0,
  verifiedSignals: 0,
  totalVolume: 0,
};

function logActivity(event: Omit<ActivityEvent, 'id'>) {
  const entry: ActivityEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    ...event,
  };
  activityLog.unshift(entry);
  if (activityLog.length > MAX_LOG_SIZE) {
    activityLog.pop();
  }
}

// ============================================
// Load deployment info
// ============================================

function loadContractAddress(): string {
  const deploymentPath = path.resolve(currentDir, '..', 'deployment.json');

  if (!fs.existsSync(deploymentPath)) {
    logger.error(`deployment.json not found at ${deploymentPath}`);
    logger.error('Run "npm run deploy" first to deploy the contract.');
    process.exit(1);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  const contractAddress = deploymentInfo.contractAddress;

  if (!contractAddress) {
    logger.error('No contractAddress found in deployment.json');
    process.exit(1);
  }

  logger.info(`Loaded contract address: ${contractAddress}`);
  return contractAddress;
}

// ============================================
// Initialize agents with real chain
// ============================================

async function initAgents(contractAddress: string) {
  for (let i = 0; i < config.agentSeeds.length; i++) {
    const agent = new GhostAgent(config.agentNames[i], config.agentSeeds[i]);
    agents.push(agent);

    // Event handlers (same as before)
    agent.on('signal:generated', ({ agent: name, signal }) => {
      marketplace.totalSignals++;
      printActivity('generate', { agent: name, direction: signal.direction, pair: signal.pair });
      logActivity({ type: 'generate', timestamp: Date.now(), agent: name, data: { signal } });
    });

    agent.on('signal:committed', ({ agent: name, commitment }) => {
      marketplace.activeCommitments++;
      printActivity('commit', { agent: name, hash: commitment.hash, txHash: commitment.txHash });
      logActivity({ type: 'commit', timestamp: Date.now(), agent: name, data: { commitment }, txHash: commitment.txHash });
    });

    agent.on('signal:revealed', ({ agent: name, signal, txHash }) => {
      marketplace.activeCommitments--;
      marketplace.revealedSignals++;
      printActivity('reveal', { agent: name, direction: signal.direction, pair: signal.pair, entry: signal.entry, txHash });
      logActivity({ type: 'reveal', timestamp: Date.now(), agent: name, data: { signal }, txHash });
    });

    agent.on('signal:verified', ({ agent: name, outcome, txHash }) => {
      marketplace.verifiedSignals++;
      printActivity('verify', { agent: name, outcome, txHash });
      logActivity({ type: 'verify', timestamp: Date.now(), agent: name, data: { outcome }, txHash });
    });

    agent.on('signal:purchased', ({ agent: buyer, sellerId, price, txHash }) => {
      marketplace.totalVolume += price;
      printActivity('purchase', { buyer, seller: sellerId, price, txHash });
      logActivity({ type: 'purchase', timestamp: Date.now(), agent: buyer, data: { seller: sellerId, price }, txHash });
    });

    // Initialize chain connection (sequential to avoid sync conflicts)
    try {
      logger.info(`Initializing agent ${i + 1}/${config.agentSeeds.length}: ${config.agentNames[i]}...`);
      await agent.initChain(contractAddress);
      logger.info(`Agent ${config.agentNames[i]} ready ✓`);
    } catch (e) {
      logger.error(`Failed to initialize chain for ${config.agentNames[i]}: ${e}`);
      logger.warn(`${config.agentNames[i]} will run in simulated mode.`);
    }
  }

  logger.info(`Initialized ${agents.length} agents`);
}

// ============================================
// Simulation runner
// ============================================

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run a full agent lifecycle: commit → reveal → verify (sequential).
// Because the contract stores a single signal_commitment, only one agent
// can occupy the commit-reveal slot at a time. Each agent must complete
// its entire lifecycle before the next agent starts.
async function runAgentCycle(agent: GhostAgent) {
  try {
    // 1. Generate signal
    const signal = await agent.generateSignal();
    await sleep(500 + Math.random() * 1000);

    // 2. Commit (stores persistentHash(secret) on-chain)
    const commitment = await agent.commitSignal(signal.id);

    // 3. Wait, then reveal (asserts preimage matches on-chain commitment)
    await sleep(config.revealDelayMs);
    try {
      await agent.revealSignal(commitment.id);

      // Maybe others buy the revealed signal
      await maybePurchase(agent, signal);
    } catch (e) {
      logger.error(`Reveal error for ${agent.name}: ${e}`);
    }

    // 4. Wait, then verify (asserts preimage again for scoring)
    await sleep(config.verifyDelayMs);
    try {
      const outcome = Math.random() > 0.4 ? 'win' : 'loss';
      await agent.verifySignal(commitment.id, outcome);
    } catch (e) {
      logger.error(`Verify error for ${agent.name}: ${e}`);
    }

  } catch (e) {
    logger.error(`Cycle error for ${agent.name}: ${e}`);
  }
}

async function maybePurchase(seller: GhostAgent, signal: Signal) {
  const buyers = agents.filter(a => a.name !== seller.name);

  for (const buyer of buyers) {
    if (Math.random() < 0.3) {
      await sleep(200 + Math.random() * 500);
      try {
        const commitment = seller.getCommitments().find(c => c.signalId === signal.id);
        if (commitment) {
          await buyer.purchaseSignal(seller.name, commitment.hash);
        }
      } catch (e) { /* ignore */ }
    }
  }
}

// Run agents one at a time. Each agent completes its full commit→reveal→verify
// cycle before the next agent starts. This is required because the contract
// uses a single signal_commitment ledger variable.
async function runSimulationLoop() {
  const runRound = async () => {
    // Pick 1-2 agents randomly for this round
    const activeCount = 1 + Math.floor(Math.random() * 2);
    const shuffled = [...agents].sort(() => Math.random() - 0.5);
    const active = shuffled.slice(0, activeCount);

    // Run each agent's FULL lifecycle sequentially
    for (const agent of active) {
      await runAgentCycle(agent);
      await sleep(2000 + Math.random() * 3000); // Buffer between agents
    }
  };

  // Initial burst
  for (let i = 0; i < 2; i++) {
    await runRound();
    await sleep(2000);
  }

  // Continuous loop (use recursive setTimeout instead of setInterval
  // to prevent overlap if a round takes longer than the interval)
  const scheduleNext = () => {
    setTimeout(async () => {
      await runRound();
      scheduleNext();
    }, config.signalIntervalMs);
  };
  scheduleNext();
}

// ============================================
// REST API Routes
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    chainReady: agents.every(a => a.isChainReady()),
    agents: agents.length,
  });
});

// Get marketplace stats
app.get('/api/stats', (req, res) => {
  res.json({
    ...marketplace,
    agentCount: agents.length,
    chainReady: agents.every(a => a.isChainReady()),
    timestamp: Date.now(),
  });
});

// Get activity feed
app.get('/api/activity', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const since = parseInt(req.query.since as string) || 0;

  let events = activityLog;
  if (since > 0) {
    events = events.filter(e => e.timestamp > since);
  }

  res.json({
    events: events.slice(0, limit),
    total: activityLog.length,
    timestamp: Date.now(),
  });
});

// Get agent leaderboard
app.get('/api/leaderboard', (req, res) => {
  const leaderboard = agents
    .map(a => ({
      name: a.name,
      address: a.getAddress(),
      stats: a.getStats(),
      balance: a.getBalance(),
      chainReady: a.isChainReady(),
    }))
    .sort((a, b) => b.stats.totalEarned - a.stats.totalEarned);

  res.json({ leaderboard, timestamp: Date.now() });
});

// Get specific agent
app.get('/api/agents/:name', (req, res) => {
  const agent = agents.find(a => a.name === req.params.name);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  res.json({
    name: agent.name,
    address: agent.getAddress(),
    balance: agent.getBalance(),
    stats: agent.getStats(),
    signals: agent.getSignals(),
    commitments: agent.getCommitments(),
    chainReady: agent.isChainReady(),
  });
});

// Get all signals (revealed only for non-owners)
app.get('/api/signals', (req, res) => {
  const allSignals: Array<{
    agent: string;
    signal: Signal;
    commitment?: Commitment;
  }> = [];

  for (const agent of agents) {
    for (const signal of agent.getSignals()) {
      const commitment = agent.getCommitments().find(c => c.signalId === signal.id);
      if (commitment?.revealed) {
        allSignals.push({ agent: agent.name, signal, commitment });
      }
    }
  }

  // Sort by timestamp desc
  allSignals.sort((a, b) => b.signal.timestamp - a.signal.timestamp);

  res.json({ signals: allSignals.slice(0, 50), timestamp: Date.now() });
});

// Get transaction by hash (for verification)
app.get('/api/tx/:hash', (req, res) => {
  const hash = req.params.hash;

  // Search for tx in activity log
  const event = activityLog.find(e => e.txHash === hash);
  if (!event) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  res.json({
    txHash: hash,
    type: event.type,
    timestamp: event.timestamp,
    agent: event.agent,
    data: event.data,
    // Block info — from real chain or estimated
    block: {
      number: Math.floor(event.timestamp / 10000),
      hash: '0x' + Buffer.from(String(event.timestamp)).toString('hex').padStart(64, '0'),
    },
  });
});

// ============================================
// Start server
// ============================================

const PORT = parseInt(process.env.PORT || '3001');

async function main() {
  console.log(chalk.cyan(`
   ██████╗ ██╗  ██╗ ██████╗ ███████╗████████╗
  ██╔════╝ ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
  ██║  ███╗███████║██║   ██║███████╗   ██║   
  ██║   ██║██╔══██║██║   ██║╚════██║   ██║   
  ╚██████╔╝██║  ██║╚██████╔╝███████║   ██║   
   ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   
  `));
  console.log(chalk.gray('  AI Agent Signal Marketplace - API Server (Real Chain)'));
  console.log(chalk.gray('  ─'.repeat(25)));
  console.log();

  // Set network ID
  setNetworkId(config.networkId);

  // Load contract address from deployment.json
  const contractAddress = loadContractAddress();

  // Initialize agents with real chain connections
  logger.info('Initializing agents with real wallets (this may take a minute)...');
  await initAgents(contractAddress);

  // Start simulation
  logger.info('Starting simulation with real on-chain transactions...');
  runSimulationLoop();

  // Start API server
  app.listen(PORT, () => {
    logger.info(`API server running on http://localhost:${PORT}`);
    console.log();
    console.log(chalk.white.bold('📡 API Endpoints:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`   GET /api/stats        - Marketplace stats`);
    console.log(`   GET /api/activity     - Activity feed`);
    console.log(`   GET /api/leaderboard  - Agent leaderboard`);
    console.log(`   GET /api/signals      - Revealed signals`);
    console.log(`   GET /api/tx/:hash     - Transaction lookup`);
    console.log();
    console.log(chalk.white.bold('📡 Live Activity:'));
    console.log(chalk.gray('─'.repeat(40)));
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    for (const agent of agents) {
      await agent.close();
    }
    process.exit(0);
  });
}

main().catch(err => {
  logger.error('Failed to start:', err);
  process.exit(1);
});
