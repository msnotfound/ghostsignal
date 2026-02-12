#!/usr/bin/env node
// GhostSignal Demo Simulation
// Runs multiple AI agents that trade signals with each other
// All transactions are logged with hashes for verification

import { GhostAgent, Signal, Commitment } from './agent.js';
import { config } from './config.js';
import { createLogger, printActivity } from './logger.js';
import chalk from 'chalk';
import { EventEmitter } from 'events';

const logger = createLogger('Simulation');

// Global activity log (for frontend API)
const activityLog: ActivityEvent[] = [];
const MAX_LOG_SIZE = 1000;

interface ActivityEvent {
  id: string;
  type: 'generate' | 'commit' | 'reveal' | 'verify' | 'purchase';
  timestamp: number;
  agent: string;
  data: Record<string, unknown>;
  txHash?: string;
}

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

// Marketplace state
interface MarketplaceState {
  totalSignals: number;
  activeCommitments: number;
  revealedSignals: number;
  verifiedSignals: number;
  totalVolume: number;
  agents: Map<string, GhostAgent>;
}

const marketplace: MarketplaceState = {
  totalSignals: 0,
  activeCommitments: 0,
  revealedSignals: 0,
  verifiedSignals: 0,
  totalVolume: 0,
  agents: new Map(),
};

// Print banner
function printBanner() {
  console.log(chalk.cyan(`
   ██████╗ ██╗  ██╗ ██████╗ ███████╗████████╗
  ██╔════╝ ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
  ██║  ███╗███████║██║   ██║███████╗   ██║   
  ██║   ██║██╔══██║██║   ██║╚════██║   ██║   
  ╚██████╔╝██║  ██║╚██████╔╝███████║   ██║   
   ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   
  `));
  console.log(chalk.gray('  AI Agent Signal Marketplace - Demo Simulation'));
  console.log(chalk.gray('  ─'.repeat(25)));
  console.log();
}

// Print marketplace stats
function printStats() {
  console.log();
  console.log(chalk.white.bold('📊 Marketplace Stats'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`   Signals Created:  ${chalk.green(marketplace.totalSignals)}`);
  console.log(`   Active Commits:   ${chalk.yellow(marketplace.activeCommitments)}`);
  console.log(`   Revealed:         ${chalk.blue(marketplace.revealedSignals)}`);
  console.log(`   Verified:         ${chalk.cyan(marketplace.verifiedSignals)}`);
  console.log(`   Total Volume:     ${chalk.green(marketplace.totalVolume + ' tNight')}`);
  console.log();
  
  console.log(chalk.white.bold('🤖 Agent Leaderboard'));
  console.log(chalk.gray('─'.repeat(40)));
  
  const agents = Array.from(marketplace.agents.values())
    .map(a => ({ name: a.name, stats: a.getStats(), balance: a.getBalance() }))
    .sort((a, b) => b.stats.totalEarned - a.stats.totalEarned);
  
  agents.forEach((a, i) => {
    const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ` ${i + 1}`;
    console.log(`   ${rank} ${chalk.magenta(a.name.padEnd(15))} Signals: ${chalk.white(String(a.stats.signalsCreated).padStart(3))} | Earned: ${chalk.green(String(a.stats.totalEarned).padStart(6))} | Rate: ${chalk.yellow(a.stats.successRate + '%')}`);
  });
  console.log();
}

// Create all agents
function createAgents(): GhostAgent[] {
  const agents: GhostAgent[] = [];
  
  for (let i = 0; i < config.agentSeeds.length; i++) {
    const agent = new GhostAgent(config.agentNames[i], config.agentSeeds[i]);
    agents.push(agent);
    marketplace.agents.set(agent.name, agent);
    
    // Wire up event listeners
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
  }
  
  logger.info(`Created ${agents.length} AI agents`);
  return agents;
}

// Simulate agent activity
async function runAgentCycle(agent: GhostAgent, allAgents: GhostAgent[]) {
  try {
    // 1. Generate a new signal
    const signal = await agent.generateSignal();
    
    // Small delay
    await sleep(500 + Math.random() * 1000);
    
    // 2. Commit the signal
    const commitment = await agent.commitSignal(signal.id);
    
    // 3. Schedule reveal after delay
    setTimeout(async () => {
      try {
        await agent.revealSignal(commitment.id);
        
        // 4. Maybe other agents buy it
        await maybePurchase(agent, allAgents, signal);
        
        // 5. Schedule verification
        setTimeout(async () => {
          try {
            const outcome = Math.random() > 0.4 ? 'win' : 'loss'; // 60% win rate
            await agent.verifySignal(commitment.id, outcome);
          } catch (err) {
            logger.error(`Verify failed: ${err}`);
          }
        }, config.verifyDelayMs);
        
      } catch (err) {
        logger.error(`Reveal failed: ${err}`);
      }
    }, config.revealDelayMs);
    
  } catch (err) {
    logger.error(`Agent cycle failed: ${err}`);
  }
}

// Other agents might purchase a revealed signal
async function maybePurchase(seller: GhostAgent, allAgents: GhostAgent[], signal: Signal) {
  const buyers = allAgents.filter(a => a.name !== seller.name);
  
  // 30% chance each other agent buys
  for (const buyer of buyers) {
    if (Math.random() < 0.3) {
      await sleep(200 + Math.random() * 500);
      try {
        const commitment = seller.getCommitments().find(c => c.signalId === signal.id);
        if (commitment) {
          await buyer.purchaseSignal(seller.name, commitment.hash);
        }
      } catch (err) {
        // Ignore purchase failures
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main simulation loop
async function runSimulation() {
  printBanner();
  
  logger.info('Starting GhostSignal demo simulation...');
  logger.info(`Network: ${config.network} (${config.networkId})`);
  console.log();
  
  const agents = createAgents();
  
  // Print initial agent info
  console.log(chalk.white.bold('🤖 Registered Agents'));
  console.log(chalk.gray('─'.repeat(50)));
  agents.forEach(a => {
    console.log(`   ${chalk.magenta(a.name.padEnd(15))} ${chalk.gray(a.getAddress().substring(0, 30))}...`);
  });
  console.log();
  
  console.log(chalk.white.bold('📡 Live Activity Feed'));
  console.log(chalk.gray('─'.repeat(50)));
  
  // Run continuous simulation
  let round = 0;
  
  const runRound = async () => {
    round++;
    
    // Each round, 1-3 random agents create signals
    const activeCount = 1 + Math.floor(Math.random() * 3);
    const shuffled = [...agents].sort(() => Math.random() - 0.5);
    const activeAgents = shuffled.slice(0, activeCount);
    
    for (const agent of activeAgents) {
      await runAgentCycle(agent, agents);
      await sleep(1000 + Math.random() * 2000); // Stagger agent actions
    }
  };
  
  // Initial burst of activity
  logger.info('Initial activity burst...');
  for (let i = 0; i < 3; i++) {
    await runRound();
    await sleep(2000);
  }
  
  // Then regular intervals
  setInterval(async () => {
    await runRound();
  }, config.signalIntervalMs);
  
  // Print stats periodically
  setInterval(() => {
    printStats();
  }, 30_000);
  
  // Keep running
  logger.info('Simulation running... Press Ctrl+C to stop');
}

// Export for API access
export function getActivityLog(): ActivityEvent[] {
  return [...activityLog];
}

export function getMarketplaceStats() {
  return {
    totalSignals: marketplace.totalSignals,
    activeCommitments: marketplace.activeCommitments,
    revealedSignals: marketplace.revealedSignals,
    verifiedSignals: marketplace.verifiedSignals,
    totalVolume: marketplace.totalVolume,
    agentCount: marketplace.agents.size,
  };
}

export function getAgentLeaderboard() {
  return Array.from(marketplace.agents.values())
    .map(a => ({
      name: a.name,
      address: a.getAddress(),
      stats: a.getStats(),
      balance: a.getBalance(),
    }))
    .sort((a, b) => b.stats.totalEarned - a.stats.totalEarned);
}

// Run if executed directly
runSimulation().catch(err => {
  logger.error('Simulation failed:', err);
  process.exit(1);
});
