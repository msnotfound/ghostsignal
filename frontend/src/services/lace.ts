// GhostSignal — Lace Wallet Integration Service
// Implements DApp Connector API for browser wallet integration
//
// This module provides:
//   - Lace wallet detection and connection
//   - Provider creation from Lace's ConnectedAPI
//   - Transaction balancing and submission via Lace
//
// For the Python AI agent, use the manual wallet in ./wallet.ts instead.

import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import * as ledger from '@midnight-ntwrk/ledger-v7';
import { toHex, fromHex } from '@midnight-ntwrk/midnight-js-utils';
import type { WalletProvider, MidnightProvider, ProofProvider, UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import type { MarketplaceCircuits, MarketplaceProviders } from '../types/common-types';
import { MarketplacePrivateStateId } from '../types/common-types';
import { contractConfig } from './config';

// ============================================================================
// TypeScript declarations for window.midnight
// ============================================================================

declare global {
  interface Window {
    midnight?: Record<string, InitialAPI>;
  }
}

// ============================================================================
// Lace Connection State
// ============================================================================

export interface LaceWalletState {
  connectedAPI: ConnectedAPI;
  initialAPI: InitialAPI;
  shieldedAddress: string;
  shieldedCoinPublicKey: string;
  shieldedEncryptionPublicKey: string;
  unshieldedAddress: string;
  dustAddress: string;
  dustBalance: bigint;
  indexerUri: string;
  indexerWsUri: string;
  proverServerUri: string;
}

// ============================================================================
// Wallet Detection
// ============================================================================

/**
 * Check if any Midnight wallet (e.g., Lace) is installed in the browser.
 */
export const isLaceAvailable = (): boolean => {
  return typeof window !== 'undefined' && 
         window.midnight !== undefined && 
         window.midnight.mnLace !== undefined;
};

/**
 * Get all available Midnight wallets installed in the browser.
 */
export const getAvailableWallets = (): InitialAPI[] => {
  if (typeof window === 'undefined' || !window.midnight) return [];

  const wallets: InitialAPI[] = [];
  for (const key in window.midnight) {
    try {
      const wallet = window.midnight[key];
      if (wallet?.name && wallet?.apiVersion && wallet?.connect) {
        wallets.push({
          name: wallet.name,
          apiVersion: wallet.apiVersion,
          connect: wallet.connect,
          icon: wallet.icon,
          rdns: wallet.rdns,
        });
      }
    } catch (e) {
      console.warn(`[Lace] Failed to enumerate wallet ${key}:`, e);
    }
  }
  return wallets;
};

// ============================================================================
// Connection Flow
// ============================================================================

/**
 * Connect to Lace wallet and return the full wallet state.
 * 
 * @param networkId - Network to connect to ('undeployed' for local devnet)
 * @param timeout - Max milliseconds to wait for Lace extension
 */
export const connectLace = async (
  networkId: string = 'undeployed',
  timeout: number = 5000,
): Promise<LaceWalletState> => {
  console.log('[Lace] Connecting to wallet...');

  // Wait for window.midnight.mnLace to be available
  const startTime = Date.now();
  while (!isLaceAvailable()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('LACE_NOT_FOUND: Lace wallet extension not detected. Please install it.');
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  const initialAPI = window.midnight!.mnLace!;
  console.log(`[Lace] Found wallet: ${initialAPI.name} v${initialAPI.apiVersion}`);

  // Connect to the specified network (triggers Lace popup for permission)
  const connectedAPI = await initialAPI.connect(networkId);
  console.log('[Lace] Connected to wallet');

  // Get service URIs from Lace's configuration
  const config = await connectedAPI.getConfiguration();
  console.log('[Lace] Network config:', config);

  // Set the network ID for midnight-js-network-id
  setNetworkId(networkId);

  // Fetch all wallet addresses and balances
  const [shieldedAddrs, unshieldedAddr, dustAddr, dustBal] = await Promise.all([
    connectedAPI.getShieldedAddresses(),
    connectedAPI.getUnshieldedAddress(),
    connectedAPI.getDustAddress(),
    connectedAPI.getDustBalance(),
  ]);

  const state: LaceWalletState = {
    connectedAPI,
    initialAPI,
    shieldedAddress: shieldedAddrs.shieldedAddress,
    shieldedCoinPublicKey: shieldedAddrs.shieldedCoinPublicKey,
    shieldedEncryptionPublicKey: shieldedAddrs.shieldedEncryptionPublicKey,
    unshieldedAddress: unshieldedAddr.unshieldedAddress,
    dustAddress: dustAddr.dustAddress,
    dustBalance: dustBal.balance,
    indexerUri: config.indexerUri,
    indexerWsUri: config.indexerWsUri,
    proverServerUri: config.proverServerUri,
  };

  console.log('[Lace] Wallet state:', {
    shieldedAddress: state.shieldedAddress.slice(0, 20) + '...',
    unshieldedAddress: state.unshieldedAddress.slice(0, 20) + '...',
    dustBalance: state.dustBalance.toString(),
  });

  return state;
};

// ============================================================================
// Provider Creation for Lace
// ============================================================================

/**
 * Key material provider that fetches circuit keys from the public folder.
 * Lace's getProvingProvider() needs this to know where to get ZK keys.
 */
const createKeyMaterialProvider = (basePath: string) => ({
  getZKIR: async (circuitId: string): Promise<Uint8Array> => {
    const url = `${basePath}/zkir/${circuitId}.zkir`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ZKIR: ${url}`);
    return new Uint8Array(await response.arrayBuffer());
  },
  getProverKey: async (circuitId: string): Promise<Uint8Array> => {
    const url = `${basePath}/keys/${circuitId}.prover`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch prover key: ${url}`);
    return new Uint8Array(await response.arrayBuffer());
  },
  getVerifierKey: async (circuitId: string): Promise<Uint8Array> => {
    const url = `${basePath}/keys/${circuitId}.verifier`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch verifier key: ${url}`);
    return new Uint8Array(await response.arrayBuffer());
  },
});

/**
 * Create full MarketplaceProviders from a Lace wallet connection.
 * 
 * CRITICAL: Lace handles transaction balancing and submission internally.
 * The balanceTx/submitTx methods call Lace's APIs, which trigger user popups.
 */
export const createLaceProviders = async (
  laceState: LaceWalletState,
): Promise<MarketplaceProviders> => {
  const { connectedAPI, indexerUri, indexerWsUri, shieldedCoinPublicKey, shieldedEncryptionPublicKey } = laceState;

  // Create key material provider pointing to our public circuit files
  const keyMaterial = createKeyMaterialProvider(`${window.location.origin}/midnight/ghost-marketplace`);

  // Get Lace's proving provider (handles ZK proof generation)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const laceProvingProvider = await connectedAPI.getProvingProvider(keyMaterial) as any;

  // Cache for balanced transaction hex (critical: don't re-serialize)
  let balancedTxHex: string | null = null;

  // Create proof provider that uses Lace's proving
  const proofProvider: ProofProvider = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async proveTx(unprovenTx: any, _config?: unknown): Promise<any> {
      const costModel = ledger.CostModel.initialCostModel();
      return unprovenTx.prove(laceProvingProvider, costModel);
    },
  };

  // Create wallet provider that uses Lace for balancing (triggers popup!)
  const walletProvider: WalletProvider = {
    getCoinPublicKey(): string {
      return shieldedCoinPublicKey;
    },
    getEncryptionPublicKey(): string {
      return shieldedEncryptionPublicKey;
    },
    async balanceTx(tx: UnboundTransaction, _ttl?: Date): Promise<ledger.FinalizedTransaction> {
      console.log('[Lace] Balancing transaction (popup will appear)...');
      
      // Serialize the unbound transaction
      const serializedTx = toHex(tx.serialize());
      
      // Call Lace's balance method - THIS TRIGGERS A USER POPUP
      const response = await connectedAPI.balanceUnsealedTransaction(serializedTx);
      
      // CRITICAL: Cache the hex to avoid re-serialization issues
      balancedTxHex = response.tx;
      
      // Deserialize for local use
      const transaction = ledger.Transaction.deserialize<
        ledger.SignatureEnabled,
        ledger.Proof,
        ledger.Binding
      >('signature', 'proof', 'binding', fromHex(response.tx));
      
      console.log('[Lace] Transaction balanced and signed');
      return transaction;
    },
  };

  // Create midnight provider that uses Lace for submission
  const midnightProvider: MidnightProvider = {
    async submitTx(tx: ledger.FinalizedTransaction): Promise<ledger.TransactionId> {
      console.log('[Lace] Submitting transaction...');
      
      // Use cached hex from balanceTx (critical: don't re-serialize)
      const hexToSubmit = balancedTxHex || toHex(tx.serialize());
      balancedTxHex = null; // Clear cache
      
      // Submit via Lace
      await connectedAPI.submitTransaction(hexToSubmit);
      
      // Get transaction ID
      const txIds = tx.identifiers();
      const txId = txIds[0];
      console.log(`[Lace] Transaction submitted: ${txId}`);
      return txId;
    },
  };

  // Create ZK config provider using the SDK's FetchZkConfigProvider
  // This fetches circuit keys from our public folder
  const zkConfigProviderBaseUrl = `${window.location.origin}/midnight/ghost-marketplace`;
  const zkConfigProvider = new FetchZkConfigProvider<MarketplaceCircuits>(zkConfigProviderBaseUrl);

  // Assemble all providers
  const providers: MarketplaceProviders = {
    privateStateProvider: levelPrivateStateProvider<typeof MarketplacePrivateStateId>({
      privateStateStoreName: contractConfig.privateStateStoreName,
      walletProvider,
    }),
    publicDataProvider: indexerPublicDataProvider(indexerUri, indexerWsUri),
    zkConfigProvider,
    proofProvider: proofProvider as MarketplaceProviders['proofProvider'],
    walletProvider,
    midnightProvider,
  };

  console.log('[Lace] Providers configured');
  return providers;
};

// ============================================================================
// Utility: Check connection status
// ============================================================================

/**
 * Check if the wallet is still connected and synced.
 */
export const checkLaceConnection = async (connectedAPI: ConnectedAPI): Promise<boolean> => {
  try {
    const status = await connectedAPI.getConnectionStatus();
    return status === 'connected';
  } catch {
    return false;
  }
};

/**
 * Get current dust balance (for gas fees).
 */
export const getLaceDustBalance = async (connectedAPI: ConnectedAPI): Promise<bigint> => {
  const { balance } = await connectedAPI.getDustBalance();
  return balance;
};
