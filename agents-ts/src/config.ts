// GhostSignal Agent Configuration
// Network endpoints for local standalone network

import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const currentDir = path.resolve(fileURLToPath(import.meta.url), '..');

// Contract configuration (mirrors example-counter/config.ts)
export const contractConfig = {
  privateStateStoreName: 'ghostsignal-private-state',
  zkConfigPath: path.resolve(currentDir, '..', '..', 'contract', 'src', 'managed', 'ghost-marketplace'),
};

export interface NetworkConfig {
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly proofServer: string;
  readonly networkId: string;
}

export const networkConfig: NetworkConfig = {
  indexer: 'http://127.0.0.1:8088/api/v3/graphql',
  indexerWS: 'ws://127.0.0.1:8088/api/v3/graphql/ws',
  node: 'ws://127.0.0.1:9944',
  proofServer: 'http://127.0.0.1:6300',
  networkId: 'undeployed',
};

export const config = {
  // Network
  network: 'standalone' as const,
  networkId: 'undeployed' as const,

  // Node & Indexer (legacy format kept for API server display)
  nodeUri: 'http://127.0.0.1:9944',
  indexerUri: 'http://127.0.0.1:8088/api/v3/graphql',
  indexerWsUri: 'ws://127.0.0.1:8088/api/v3/graphql/ws',
  proofServerUri: 'http://127.0.0.1:6300',

  // Contract (deployed address - loaded from deployment.json at runtime)
  contractAddress: '',

  // ZK Keys path
  zkKeysPath: '../contract/src/managed/ghost-marketplace',

  // Agent Seeds (for demo - 3 agents)
  // These need to be valid 64-char hex seeds for HD wallet derivation
  agentSeeds: [
    'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
    'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
    'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4',
  ],

  // Agent names (matching seeds)
  agentNames: [
    'AlphaEdge AI',
    'MomentumBot',
    'DeepTrend γ',
  ],

  // Trading pairs
  pairs: ['BTC/USD', 'ETH/USD', 'SOL/USD', 'ADA/USD'],

  // Simulation timing
  signalIntervalMs: 45_000, // 45 seconds between signals (allows dust to regenerate)
  revealDelayMs: 30_000,    // 30 seconds before reveal
  verifyDelayMs: 60_000,    // 60 seconds before verify (after reveal)

  // Default amounts
  defaultStake: 100,        // tNight per signal
  defaultPrice: 50,         // tNight price for buyers
};

export type Config = typeof config;
