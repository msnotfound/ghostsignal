// GhostSignal — Midnight contract interaction service
// Mirrors: contract/provider functions from example-counter/counter-cli/src/api.ts
//
// Ported functions:
//   - createWalletAndMidnightProvider() → exact same bridge logic
//   - configureProviders()              → same provider wiring, different contract types
//   - deploy()                          → deploys GhostMarketplace instead of Counter
//   - joinContract()                    → joins GhostMarketplace
//   - commitSignal()                    → NEW: calls commit_signal circuit
//   - revealSignal()                    → NEW: calls reveal_signal circuit
//   - verifySignal()                    → NEW: calls verify_signal circuit
//   - registerAgent()                   → NEW: calls register_agent circuit
//   - getMarketplaceLedgerState()       → mirrors getCounterLedgerState()
//
// Key differences:
//   - No pino logger (browser console instead)
//   - Uses GhostMarketplace contract types
//   - Additional circuit-calling functions for marketplace operations

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import { GhostMarketplace, type GhostMarketplacePrivateState, witnesses, initialPrivateState } from '@midnight-ntwrk/ghostsignal-contract';
import * as ledger from '@midnight-ntwrk/ledger-v7';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { type FinalizedTxData, type MidnightProvider, type WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { assertIsContractAddress } from '@midnight-ntwrk/midnight-js-utils';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import * as Rx from 'rxjs';
import type { WalletContext } from './wallet';
import { type Config, contractConfig } from './config';
import type {
  MarketplaceCircuits,
  MarketplaceProviders,
  MarketplaceContract,
  DeployedMarketplaceContract,
} from '../types/common-types';
import { MarketplacePrivateStateId } from '../types/common-types';
import type { MarketplaceStats } from '../types';

// ============================================================================
// Compiled Contract
// Mirrors: counterCompiledContract from api.ts
// ============================================================================

/**
 * Pre-compile the marketplace contract with ZK circuit assets.
 * Mirrors: CompiledContract.make('counter', Counter.Contract).pipe(...) from api.ts
 */
const marketplaceCompiledContract = CompiledContract.make('ghost-marketplace', GhostMarketplace.Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(contractConfig.zkConfigPath),
);

// ============================================================================
// Contract Instance
// Mirrors: counterContractInstance from api.ts
// ============================================================================

/** The contract instance for local operations. */
export const marketplaceContractInstance: MarketplaceContract = new GhostMarketplace.Contract(witnesses);

// ============================================================================
// Wallet + Midnight Provider Bridge
// Mirrors: createWalletAndMidnightProvider, signTransactionIntents from api.ts
// ============================================================================

/**
 * Sign all unshielded offers in a transaction's intents.
 * Mirrors: signTransactionIntents() from api.ts (exact same workaround).
 */
const signTransactionIntents = (
  tx: { intents?: Map<number, ledger.Intent<ledger.SignatureEnabled, ledger.Proofish, ledger.PreBinding>> },
  signFn: (payload: Uint8Array) => ledger.Signature,
  proofMarker: 'proof' | 'pre-proof',
): void => {
  if (!tx.intents || tx.intents.size === 0) return;

  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (!intent) continue;

    const cloned = ledger.Intent.deserialize<ledger.SignatureEnabled, ledger.Proofish, ledger.PreBinding>(
      'signature',
      proofMarker,
      'pre-binding',
      intent.serialize(),
    );

    const sigData = cloned.signatureData(segment);
    const signature = signFn(sigData);

    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) => cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(sigs);
    }

    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) => cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
    }

    tx.intents.set(segment, cloned);
  }
};

/**
 * Create the unified WalletProvider & MidnightProvider for midnight-js.
 * Mirrors: createWalletAndMidnightProvider() from api.ts (exact same logic).
 */
export const createWalletAndMidnightProvider = async (
  ctx: WalletContext,
): Promise<WalletProvider & MidnightProvider> => {
  const state = await Rx.firstValueFrom(ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  return {
    getCoinPublicKey() {
      return state.shielded.coinPublicKey.toHexString();
    },
    getEncryptionPublicKey() {
      return state.shielded.encryptionPublicKey.toHexString();
    },
    async balanceTx(tx, ttl?) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: ctx.shieldedSecretKeys, dustSecretKey: ctx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );

      const signFn = (payload: Uint8Array) => ctx.unshieldedKeystore.signData(payload);
      signTransactionIntents(recipe.baseTransaction, signFn, 'proof');
      if (recipe.balancingTransaction) {
        signTransactionIntents(recipe.balancingTransaction, signFn, 'pre-proof');
      }

      return ctx.wallet.finalizeRecipe(recipe);
    },
    submitTx(tx) {
      return ctx.wallet.submitTransaction(tx) as ReturnType<MidnightProvider['submitTx']>;
    },
  };
};

// ============================================================================
// Provider Configuration
// Mirrors: configureProviders from api.ts
// ============================================================================

/**
 * Configure all midnight-js providers needed for contract deployment and interaction.
 * Mirrors: configureProviders() from api.ts (same wiring, different type params).
 */
export const configureProviders = async (
  ctx: WalletContext,
  config: Config,
): Promise<MarketplaceProviders> => {
  const walletAndMidnightProvider = await createWalletAndMidnightProvider(ctx);
  const zkConfigProvider = new NodeZkConfigProvider<MarketplaceCircuits>(contractConfig.zkConfigPath);
  return {
    privateStateProvider: levelPrivateStateProvider<typeof MarketplacePrivateStateId>({
      privateStateStoreName: contractConfig.privateStateStoreName,
      walletProvider: walletAndMidnightProvider,
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  };
};

// ============================================================================
// Contract Deployment & Joining
// Mirrors: deploy, joinContract from api.ts
// ============================================================================

/**
 * Deploy a new GhostMarketplace contract.
 * Mirrors: deploy() from api.ts
 */
export const deploy = async (
  providers: MarketplaceProviders,
  privateState: GhostMarketplacePrivateState = initialPrivateState,
): Promise<DeployedMarketplaceContract> => {
  console.log('[GhostSignal] Deploying marketplace contract...');
  const contract = await deployContract(providers, {
    compiledContract: marketplaceCompiledContract,
    privateStateId: 'ghostMarketplacePrivateState',
    initialPrivateState: privateState,
  });
  console.log(`[GhostSignal] Deployed at: ${contract.deployTxData.public.contractAddress}`);
  return contract;
};

/**
 * Join an existing GhostMarketplace contract by address.
 * Mirrors: joinContract() from api.ts
 */
export const joinContract = async (
  providers: MarketplaceProviders,
  contractAddress: string,
): Promise<DeployedMarketplaceContract> => {
  console.log(`[GhostSignal] Joining contract at: ${contractAddress}`);
  const contract = await findDeployedContract(providers, {
    contractAddress,
    compiledContract: marketplaceCompiledContract,
    privateStateId: 'ghostMarketplacePrivateState',
    initialPrivateState: initialPrivateState,
  });
  console.log(`[GhostSignal] Joined contract at: ${contract.deployTxData.public.contractAddress}`);
  return contract;
};

// ============================================================================
// Ledger State Reader
// Mirrors: getCounterLedgerState, displayCounterValue from api.ts
// ============================================================================

/**
 * Read the current marketplace ledger state from the indexer.
 * Mirrors: getCounterLedgerState() from api.ts
 */
export const getMarketplaceLedgerState = async (
  providers: MarketplaceProviders,
  contractAddress: ContractAddress,
): Promise<MarketplaceStats | null> => {
  assertIsContractAddress(contractAddress);
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
  if (contractState == null) return null;

  const state = GhostMarketplace.ledger(contractState.data);
  return {
    totalCommitments: state.total_commitments,
    totalReveals: state.total_reveals,
    totalVerified: state.total_verified,
    activeAgents: state.active_agents,
    totalStakeLocked: state.total_stake_locked,
  };
};

// ============================================================================
// Circuit Callers (NEW — not in example-counter)
// These follow the same pattern as increment() from api.ts:
//   const finalizedTxData = await counterContract.callTx.increment();
// ============================================================================

/**
 * Submit a signal commitment on-chain.
 * Calls the commit_signal circuit.
 *
 * NOTE: The circuit takes no parameters (fixed stake of 1 unit per commit).
 * Variable stake tracking is done off-chain to avoid witness disclosure.
 *
 * Pattern mirrors: increment() from api.ts
 *   → counterContract.callTx.increment()
 *   → marketplaceContract.callTx.commit_signal()
 */
export const commitSignal = async (
  contract: DeployedMarketplaceContract,
): Promise<FinalizedTxData> => {
  console.log('[GhostSignal] Committing signal...');
  const result = await contract.callTx.commit_signal();
  console.log(`[GhostSignal] Commitment tx: ${result.public.txId} in block ${result.public.blockHeight}`);
  return result.public;
};

/**
 * Reveal a previously committed signal on-chain.
 * Calls the reveal_signal circuit.
 */
export const revealSignal = async (
  contract: DeployedMarketplaceContract,
): Promise<FinalizedTxData> => {
  console.log('[GhostSignal] Revealing signal...');
  const result = await contract.callTx.reveal_signal();
  console.log(`[GhostSignal] Reveal tx: ${result.public.txId} in block ${result.public.blockHeight}`);
  return result.public;
};

/**
 * Verify a revealed signal against market outcome.
 * Calls the verify_signal circuit.
 */
export const verifySignal = async (
  contract: DeployedMarketplaceContract,
): Promise<FinalizedTxData> => {
  console.log('[GhostSignal] Verifying signal...');
  const result = await contract.callTx.verify_signal();
  console.log(`[GhostSignal] Verify tx: ${result.public.txId} in block ${result.public.blockHeight}`);
  return result.public;
};

/**
 * Register a new agent on the marketplace.
 * Calls the register_agent circuit.
 */
export const registerAgent = async (
  contract: DeployedMarketplaceContract,
): Promise<FinalizedTxData> => {
  console.log('[GhostSignal] Registering agent...');
  const result = await contract.callTx.register_agent();
  console.log(`[GhostSignal] Register tx: ${result.public.txId} in block ${result.public.blockHeight}`);
  return result.public;
};

/**
 * Read marketplace stats (triggers a proof but doesn't change state).
 * Calls the get_marketplace_stats circuit.
 */
export const getMarketplaceStats = async (
  contract: DeployedMarketplaceContract,
): Promise<FinalizedTxData> => {
  console.log('[GhostSignal] Reading marketplace stats...');
  const result = await contract.callTx.get_marketplace_stats();
  return result.public;
};
