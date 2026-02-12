// GhostSignal AI Agent
// Each agent has a wallet and can interact with the contract on-chain

import { config, networkConfig } from './config.js';
import { createLogger } from './logger.js';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import * as chainApi from './chain-api.js';
import type { DeployedGhostMarketplaceContract } from './common-types.js';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

const logger = createLogger('Agent');

// Signal types
export type SignalDirection = 'LONG' | 'SHORT';
export type SignalTimeframe = '1H' | '4H' | '1D' | '1W';
export type SignalConfidence = 'low' | 'medium' | 'high';

export interface Signal {
  id: string;
  pair: string;
  direction: SignalDirection;
  entry: number;
  target: number;
  stopLoss: number;
  timeframe: SignalTimeframe;
  confidence: SignalConfidence;
  rationale: string;
  timestamp: number;
}

export interface Commitment {
  id: string;
  signalId: string;
  hash: string;
  salt: string;
  secretBytes: Uint8Array; // The 32-byte secret used for on-chain commit-reveal
  timestamp: number;
  txHash?: string;
  blockHeight?: bigint;
  revealed: boolean;
  verified: boolean;
}

export interface AgentStats {
  signalsCreated: number;
  signalsRevealed: number;
  signalsVerified: number;
  signalsPurchased: number;
  totalEarned: number;
  totalSpent: number;
  successRate: number;
}

export class GhostAgent extends EventEmitter {
  readonly name: string;
  readonly seed: string;
  private commitments: Map<string, Commitment> = new Map();
  private signals: Map<string, Signal> = new Map();
  private stats: AgentStats;
  private walletAddress: string = '';
  private balance: number = 10000; // Demo balance (tracked locally)

  // Real chain integration
  private walletContext: chainApi.WalletContext | null = null;
  private contract: DeployedGhostMarketplaceContract | null = null;
  private chainInitialized: boolean = false;

  constructor(name: string, seed: string) {
    super();
    this.name = name;
    this.seed = seed;
    this.stats = {
      signalsCreated: 0,
      signalsRevealed: 0,
      signalsVerified: 0,
      signalsPurchased: 0,
      totalEarned: 0,
      totalSpent: 0,
      successRate: 0,
    };
    // Temporary address until chain init
    this.walletAddress = this.generateTempAddress();
  }

  private generateTempAddress(): string {
    const hash = crypto.createHash('sha256').update(this.seed).digest('hex');
    return `addr_test1_${hash.substring(0, 40)}`;
  }

  // Initialize real chain connection
  async initChain(contractAddress: string): Promise<void> {
    logger.info(`${this.name}: Initializing chain connection...`);

    setNetworkId(networkConfig.networkId);

    // Build wallet from seed
    this.walletContext = await chainApi.buildWalletFromHexSeed(networkConfig, this.seed);
    this.walletAddress = String(this.walletContext.unshieldedKeystore.getBech32Address());
    logger.info(`${this.name}: Wallet address: ${this.walletAddress}`);

    // Configure providers (each agent uses its own private state store)
    const storeName = `ghostsignal-${this.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const providers = await chainApi.configureProviders(this.walletContext, networkConfig, storeName);

    // Join the deployed contract
    this.contract = await chainApi.joinContract(providers, contractAddress);
    logger.info(`${this.name}: Joined contract at ${contractAddress}`);

    // Register on-chain
    try {
      const registerTx = await chainApi.callRegisterAgent(this.contract);
      logger.info(`${this.name}: Registered on-chain (tx: ${registerTx.txId})`);
    } catch (e) {
      logger.warn(`${this.name}: register_agent failed (may already be registered): ${e}`);
    }

    this.chainInitialized = true;
    logger.info(`${this.name}: Chain initialization complete ✓`);
  }

  // Generate a trading signal based on AI-like analysis
  async generateSignal(): Promise<Signal> {
    const pair = config.pairs[Math.floor(Math.random() * config.pairs.length)];
    const direction: SignalDirection = Math.random() > 0.5 ? 'LONG' : 'SHORT';
    const timeframes: SignalTimeframe[] = ['1H', '4H', '1D', '1W'];
    const timeframe = timeframes[Math.floor(Math.random() * timeframes.length)];
    const confidences: SignalConfidence[] = ['low', 'medium', 'high'];
    const confidence = confidences[Math.floor(Math.random() * confidences.length)];

    // Generate realistic price levels
    const basePrice = this.getBasePrice(pair);
    const volatility = 0.02; // 2% volatility
    const entry = basePrice * (1 + (Math.random() - 0.5) * volatility);

    let target: number;
    let stopLoss: number;

    if (direction === 'LONG') {
      target = entry * (1 + 0.02 + Math.random() * 0.05); // 2-7% above
      stopLoss = entry * (1 - 0.01 - Math.random() * 0.02); // 1-3% below
    } else {
      target = entry * (1 - 0.02 - Math.random() * 0.05); // 2-7% below
      stopLoss = entry * (1 + 0.01 + Math.random() * 0.02); // 1-3% above
    }

    const signal: Signal = {
      id: crypto.randomUUID(),
      pair,
      direction,
      entry: Math.round(entry * 100) / 100,
      target: Math.round(target * 100) / 100,
      stopLoss: Math.round(stopLoss * 100) / 100,
      timeframe,
      confidence,
      rationale: this.generateRationale(pair, direction, confidence),
      timestamp: Date.now(),
    };

    this.signals.set(signal.id, signal);
    this.stats.signalsCreated++;

    logger.info(`${this.name} generated signal: ${signal.direction} ${signal.pair} @ ${signal.entry}`);
    this.emit('signal:generated', { agent: this.name, signal });

    return signal;
  }

  private getBasePrice(pair: string): number {
    const basePrices: Record<string, number> = {
      'BTC/USD': 42000 + Math.random() * 1000,
      'ETH/USD': 2500 + Math.random() * 100,
      'SOL/USD': 95 + Math.random() * 10,
      'ADA/USD': 0.55 + Math.random() * 0.05,
    };
    return basePrices[pair] || 100;
  }

  private generateRationale(pair: string, direction: SignalDirection, confidence: SignalConfidence): string {
    const indicators = [
      'RSI oversold bounce detected',
      'MACD crossover confirmed',
      'Support level holding strong',
      'Resistance breakthrough imminent',
      'Volume divergence pattern',
      'Fibonacci retracement at key level',
      'Moving average convergence',
      'Bollinger band squeeze breakout',
      'Order flow imbalance detected',
      'Whale accumulation pattern',
    ];

    const count = confidence === 'high' ? 3 : confidence === 'medium' ? 2 : 1;
    const selected = [];
    for (let i = 0; i < count; i++) {
      selected.push(indicators[Math.floor(Math.random() * indicators.length)]);
    }

    return selected.join('. ') + '. ';
  }

  // Create commitment hash for a signal (commit phase)
  async commitSignal(signalId: string): Promise<Commitment> {
    const signal = this.signals.get(signalId);
    if (!signal) {
      throw new Error(`Signal ${signalId} not found`);
    }

    const salt = crypto.randomBytes(32).toString('hex');
    const data = JSON.stringify({ signal, salt });
    const hash = crypto.createHash('sha256').update(data).digest('hex');

    // Generate the 32-byte secret for on-chain commit-reveal.
    // This secret is the preimage: commit stores persistentHash(secret),
    // reveal and verify assert the preimage matches.
    const secretBytes = crypto.createHash('sha256')
      .update(Buffer.from(hash, 'hex'))
      .digest();

    const commitment: Commitment = {
      id: crypto.randomUUID(),
      signalId,
      hash: `0x${hash}`,
      salt,
      secretBytes,  // Store for later reveal/verify
      timestamp: Date.now(),
      revealed: false,
      verified: false,
    };

    // Call real on-chain commit_signal circuit with the secret
    const txHash = await this.callOnChain('commit_signal', secretBytes);
    commitment.txHash = txHash;

    this.commitments.set(commitment.id, commitment);

    logger.info(`${this.name} committed signal ${signalId} -> hash: ${commitment.hash.substring(0, 18)}...`);
    this.emit('signal:committed', { agent: this.name, commitment, signal });

    return commitment;
  }

  // Reveal the signal (reveal phase)
  async revealSignal(commitmentId: string): Promise<{ signal: Signal; txHash: string }> {
    const commitment = this.commitments.get(commitmentId);
    if (!commitment) {
      throw new Error(`Commitment ${commitmentId} not found`);
    }

    const signal = this.signals.get(commitment.signalId);
    if (!signal) {
      throw new Error(`Signal ${commitment.signalId} not found`);
    }

    // Call real on-chain reveal_signal circuit with the SAME secret
    // The contract will assert: persistentHash(secret) == signal_commitment
    const txHash = await this.callOnChain('reveal_signal', commitment.secretBytes);

    commitment.revealed = true;
    this.stats.signalsRevealed++;

    logger.info(`${this.name} revealed signal: ${signal.direction} ${signal.pair}`);
    this.emit('signal:revealed', { agent: this.name, signal, commitment, txHash });

    return { signal, txHash };
  }

  // Verify signal outcome after timeframe elapses
  async verifySignal(commitmentId: string, outcome: 'win' | 'loss'): Promise<{ success: boolean; txHash: string }> {
    const commitment = this.commitments.get(commitmentId);
    if (!commitment) {
      throw new Error(`Commitment ${commitmentId} not found`);
    }

    const signal = this.signals.get(commitment.signalId);
    if (!signal) {
      throw new Error(`Signal not found`);
    }

    // Call real on-chain verify_signal circuit with the SAME secret
    // The contract asserts: persistentHash(secret) == signal_commitment
    const txHash = await this.callOnChain('verify_signal', commitment.secretBytes);

    commitment.verified = true;
    this.stats.signalsVerified++;

    const success = outcome === 'win';
    if (success) {
      const earned = config.defaultStake * 2;
      this.balance += earned;
      this.stats.totalEarned += earned;
    }

    // Update success rate
    this.stats.successRate = Math.round(
      (this.stats.signalsVerified > 0
        ? (this.stats.totalEarned / (this.stats.signalsVerified * config.defaultStake * 2))
        : 0) * 100
    );

    logger.info(`${this.name} verified signal: ${outcome.toUpperCase()} (${this.stats.successRate}% success rate)`);
    this.emit('signal:verified', { agent: this.name, signal, outcome, txHash });

    return { success, txHash };
  }

  // Purchase another agent's revealed signal (off-chain — no purchase circuit in contract)
  async purchaseSignal(sellerId: string, signalHash: string): Promise<{ txHash: string }> {
    const price = config.defaultPrice;

    if (this.balance < price) {
      throw new Error(`Insufficient balance: ${this.balance} < ${price}`);
    }

    // Purchase stays off-chain (no purchase circuit in the Compact contract)
    // Generate a deterministic hash for tracking purposes
    const txData = JSON.stringify({
      method: 'purchase_signal',
      sellerId,
      signalHash,
      buyer: this.walletAddress,
      nonce: Date.now(),
    });
    const txHash = '0x' + crypto.createHash('sha256').update(txData).digest('hex');

    this.balance -= price;
    this.stats.signalsPurchased++;
    this.stats.totalSpent += price;

    logger.info(`${this.name} purchased signal from ${sellerId} for ${price} tNight`);
    this.emit('signal:purchased', { agent: this.name, sellerId, signalHash, price, txHash });

    return { txHash };
  }

  // Execute a single on-chain call attempt
  private async executeOnChain(method: 'commit_signal' | 'reveal_signal' | 'verify_signal', secret: Uint8Array) {
    switch (method) {
      case 'commit_signal':
        return chainApi.callCommitSignal(this.contract!, secret);
      case 'reveal_signal':
        return chainApi.callRevealSignal(this.contract!, secret);
      case 'verify_signal':
        return chainApi.callVerifySignal(this.contract!, secret);
    }
  }

  // Execute a real on-chain transaction with dust-aware retry
  private async callOnChain(method: 'commit_signal' | 'reveal_signal' | 'verify_signal', secret?: Uint8Array): Promise<string> {
    if (!this.chainInitialized || !this.contract) {
      logger.warn(`${this.name}: Chain not initialized, using simulated tx for ${method}`);
      return this.simulateTransaction(method);
    }

    if (!secret) {
      logger.warn(`${this.name}: No secret provided for ${method}, using simulated tx`);
      return this.simulateTransaction(method);
    }

    const MAX_RETRIES = 2;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const txData = await this.executeOnChain(method, secret);
        const txId = txData.txId;
        logger.info(`${this.name}: ${method} on-chain TX: ${txId} (block ${txData.blockHeight})`);
        return txId;
      } catch (e: any) {
        const errMsg = String(e?.message || e);
        const isDustError = errMsg.includes('No dust tokens') || errMsg.includes('Database failed to open');

        if (isDustError && attempt < MAX_RETRIES) {
          const waitSec = 15;
          logger.warn(`${this.name}: Dust exhausted for ${method}, waiting ${waitSec}s for regeneration (attempt ${attempt}/${MAX_RETRIES})...`);
          await new Promise((r) => setTimeout(r, waitSec * 1000));
          continue;
        }

        logger.error(`${this.name}: On-chain ${method} failed: ${e}`);
        logger.warn(`${this.name}: Falling back to simulated tx`);
        return this.simulateTransaction(method);
      }
    }

    return this.simulateTransaction(method);
  }

  // Fallback simulated transaction (generates realistic tx hash)
  private async simulateTransaction(method: string): Promise<string> {
    const txData = JSON.stringify({
      method,
      agent: this.walletAddress,
      nonce: Date.now(),
      random: Math.random(),
    });
    const txHash = '0x' + crypto.createHash('sha256').update(txData).digest('hex');

    // Simulate network delay (100-500ms)
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));

    logger.debug(`TX (simulated): ${method} -> ${txHash.substring(0, 18)}...`);

    return txHash;
  }

  // Get agent's wallet address
  getAddress(): string {
    return this.walletAddress;
  }

  // Get current balance
  getBalance(): number {
    return this.balance;
  }

  // Get all commitments
  getCommitments(): Commitment[] {
    return Array.from(this.commitments.values());
  }

  // Get all signals
  getSignals(): Signal[] {
    return Array.from(this.signals.values());
  }

  // Get stats
  getStats(): AgentStats {
    return { ...this.stats };
  }

  // Get pending (unrevealed) commitments
  getPendingCommitments(): Commitment[] {
    return this.getCommitments().filter(c => !c.revealed);
  }

  // Get revealed but unverified commitments
  getUnverifiedCommitments(): Commitment[] {
    return this.getCommitments().filter(c => c.revealed && !c.verified);
  }

  // Check if chain is initialized
  isChainReady(): boolean {
    return this.chainInitialized;
  }

  // Close wallet connection
  async close(): Promise<void> {
    if (this.walletContext) {
      await chainApi.closeWallet(this.walletContext);
      this.walletContext = null;
      this.contract = null;
      this.chainInitialized = false;
    }
  }
}
