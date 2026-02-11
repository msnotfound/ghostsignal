// GhostSignal — Configuration
// Mirrors: example-counter/counter-cli/src/config.ts
//
// Key differences from example-counter config.ts:
//   - NO path.resolve or import.meta.url (runs in browser, not Node.js)
//   - NO logDir (logs go to browser console)
//   - Static ports only (no testcontainers dynamic mapping)
//   - Uses Vite env vars (import.meta.env.VITE_*) with fallbacks
//   - setNetworkId() called at config construction time (same pattern)

import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

/**
 * Contract configuration.
 * Mirrors: contractConfig from example-counter/counter-cli/src/config.ts
 *
 * example-counter uses:
 *   privateStateStoreName: 'counter-private-state'
 *   zkConfigPath: path.resolve(currentDir, '..', '..', 'contract', 'src', 'managed', 'counter')
 *
 * In the browser context, zkConfigPath points to the contract build output
 * that gets bundled or served by Vite. For the proof server, the ZK config
 * is read server-side, so we provide a relative path.
 */
export const contractConfig = {
  privateStateStoreName: 'ghost-marketplace-private-state',
  zkConfigPath: '../../contract/src/managed/ghost-marketplace',
};

/**
 * Config interface.
 * Mirrors: Config interface from example-counter, minus logDir.
 */
export interface Config {
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly proofServer: string;
}

/**
 * Standalone configuration for local devnet.
 * Mirrors: StandaloneConfig from example-counter/counter-cli/src/config.ts
 *
 * Uses static ports for pre-running bricktowers containers:
 *   - Proof Server: localhost:6300
 *   - Indexer:      localhost:8088
 *   - Node:         localhost:9944
 *
 * NO testcontainers, NO dynamic port mapping.
 */
export class StandaloneConfig implements Config {
  indexer: string;
  indexerWS: string;
  node: string;
  proofServer: string;

  constructor() {
    // Set network ID at construction time (same pattern as example-counter)
    const networkId = import.meta.env.VITE_NETWORK_ID || 'undeployed';
    setNetworkId(networkId);

    // Read from Vite env vars with static port fallbacks
    this.indexer = import.meta.env.VITE_INDEXER_URL || 'http://localhost:8088/api/v3/graphql';
    this.indexerWS = import.meta.env.VITE_INDEXER_WS_URL || 'ws://localhost:8088/api/v3/graphql/ws';
    this.node = import.meta.env.VITE_NODE_URL || 'http://localhost:9944';
    this.proofServer = import.meta.env.VITE_PROOF_SERVER_URL || 'http://localhost:6300';
  }
}

/**
 * Preview network configuration (Midnight Preview testnet).
 * Mirrors: PreviewConfig from example-counter.
 */
export class PreviewConfig implements Config {
  indexer = 'https://indexer.preview.midnight.network/api/v3/graphql';
  indexerWS = 'wss://indexer.preview.midnight.network/api/v3/graphql/ws';
  node = 'https://rpc.preview.midnight.network';
  proofServer = 'http://localhost:6300';
  constructor() {
    setNetworkId('preview');
  }
}

/**
 * Preprod network configuration (Midnight Preprod testnet).
 * Mirrors: PreprodConfig from example-counter.
 */
export class PreprodConfig implements Config {
  indexer = 'https://indexer.preprod.midnight.network/api/v3/graphql';
  indexerWS = 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws';
  node = 'https://rpc.preprod.midnight.network';
  proofServer = 'http://localhost:6300';
  constructor() {
    setNetworkId('preprod');
  }
}
