// GhostSignal — Wallet service
// Mirrors: wallet-related functions from example-counter/counter-cli/src/api.ts
//
// Ported functions:
//   - deriveKeysFromSeed()     → exact same HD derivation logic
//   - buildWalletAndWaitForFunds() → same but returns state for React (no CLI spinners)
//   - waitForSync()            → same Rx pattern
//   - waitForFunds()           → same Rx pattern
//   - getDustBalance()         → same
//   - registerForDustGeneration() → same
//   - buildFreshWallet()       → same
//
// Key difference: No console spinners (withStatus). Instead, functions accept
// an optional status callback for React state updates.

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as ledger from '@midnight-ntwrk/ledger-v7';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v7';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles, generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
  type UnshieldedKeystore,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import {
  MidnightBech32m,
  ShieldedAddress,
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey,
} from '@midnight-ntwrk/wallet-sdk-address-format';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { Buffer } from 'buffer';
import * as Rx from 'rxjs';
import type { Config } from './config';

// ============================================================================
// Types
// ============================================================================

/**
 * Wallet context returned after building a wallet.
 * Mirrors: WalletContext from api.ts (exact same shape).
 */
export interface WalletContext {
  wallet: WalletFacade;
  shieldedSecretKeys: ledger.ZswapSecretKeys;
  dustSecretKey: ledger.DustSecretKey;
  unshieldedKeystore: UnshieldedKeystore;
}

/** Optional callback for status updates in the UI (replaces CLI spinners) */
export type StatusCallback = (message: string) => void;

// ============================================================================
// Wallet Configuration Builders
// Mirrors: buildShieldedConfig, buildUnshieldedConfig, buildDustConfig from api.ts
// ============================================================================

const buildShieldedConfig = ({ indexer, indexerWS, node, proofServer }: Config) => ({
  networkId: getNetworkId(),
  indexerClientConnection: {
    indexerHttpUrl: indexer,
    indexerWsUrl: indexerWS,
  },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, 'ws')),
});

const buildUnshieldedConfig = ({ indexer, indexerWS }: Config) => ({
  networkId: getNetworkId(),
  indexerClientConnection: {
    indexerHttpUrl: indexer,
    indexerWsUrl: indexerWS,
  },
  txHistoryStorage: new InMemoryTransactionHistoryStorage(),
});

const buildDustConfig = ({ indexer, indexerWS, node, proofServer }: Config) => ({
  networkId: getNetworkId(),
  costParameters: {
    additionalFeeOverhead: 300_000_000_000_000n,
    feeBlocksMargin: 5,
  },
  indexerClientConnection: {
    indexerHttpUrl: indexer,
    indexerWsUrl: indexerWS,
  },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, 'ws')),
});

// ============================================================================
// Key Derivation
// Mirrors: deriveKeysFromSeed from api.ts (exact same logic)
// ============================================================================

/**
 * Derive HD wallet keys for all three roles (Zswap, NightExternal, Dust)
 * from a hex-encoded seed using BIP-44 style derivation at account 0, index 0.
 *
 * Mirrors: deriveKeysFromSeed() from example-counter/counter-cli/src/api.ts
 */
const deriveKeysFromSeed = (seed: string) => {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hdWallet.type !== 'seedOk') {
    throw new Error('Failed to initialize HDWallet from seed');
  }

  const derivationResult = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);

  if (derivationResult.type !== 'keysDerived') {
    throw new Error('Failed to derive keys');
  }

  hdWallet.hdWallet.clear();
  return derivationResult.keys;
};

// ============================================================================
// Wallet Sync & Funds
// Mirrors: waitForSync, waitForFunds from api.ts (exact same Rx patterns)
// ============================================================================

/**
 * Wait until the wallet has fully synced with the network.
 * Mirrors: waitForSync() from api.ts
 */
export const waitForSync = (wallet: WalletFacade) =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.filter((state) => state.isSynced),
    ),
  );

/**
 * Wait until the wallet has a non-zero unshielded balance.
 * Mirrors: waitForFunds() from api.ts
 */
export const waitForFunds = (wallet: WalletFacade): Promise<bigint> =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(10_000),
      Rx.filter((state) => state.isSynced),
      Rx.map((s) => s.unshielded.balances[unshieldedToken().raw] ?? 0n),
      Rx.filter((balance) => balance > 0n),
    ),
  );

// ============================================================================
// Dust Management
// Mirrors: getDustBalance, registerForDustGeneration from api.ts
// ============================================================================

/**
 * Get the current DUST balance from the wallet state.
 * Mirrors: getDustBalance() from api.ts
 */
export const getDustBalance = async (
  wallet: WalletFacade,
): Promise<{ available: bigint; pending: bigint; availableCoins: number; pendingCoins: number }> => {
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  const available = state.dust.walletBalance(new Date());
  const availableCoins = state.dust.availableCoins.length;
  const pendingCoins = state.dust.pendingCoins.length;
  const pending = state.dust.pendingCoins.reduce((sum: bigint, c: { initialValue: bigint }) => sum + c.initialValue, 0n);
  return { available, pending, availableCoins, pendingCoins };
};

/**
 * Register unshielded NIGHT UTXOs for dust generation.
 * Mirrors: registerForDustGeneration() from api.ts
 *
 * On Preprod/Preview, NIGHT tokens generate DUST over time, but only after
 * the UTXOs have been explicitly designated for dust generation via an on-chain
 * transaction.
 */
export const registerForDustGeneration = async (
  wallet: WalletFacade,
  unshieldedKeystore: UnshieldedKeystore,
  onStatus?: StatusCallback,
): Promise<void> => {
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));

  // Check if dust is already available
  if (state.dust.availableCoins.length > 0) {
    onStatus?.('Dust tokens already available');
    return;
  }

  // Only register coins that haven't been designated yet
  const nightUtxos = state.unshielded.availableCoins.filter(
    (coin: { meta?: { registeredForDustGeneration?: boolean } }) => coin.meta?.registeredForDustGeneration !== true,
  );

  if (nightUtxos.length === 0) {
    onStatus?.('Waiting for dust tokens to generate...');
    await Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.throttleTime(5_000),
        Rx.filter((s) => s.isSynced),
        Rx.filter((s) => s.dust.walletBalance(new Date()) > 0n),
      ),
    );
    return;
  }

  onStatus?.(`Registering ${nightUtxos.length} NIGHT UTXO(s) for dust generation...`);
  const recipe = await wallet.registerNightUtxosForDustGeneration(
    nightUtxos,
    unshieldedKeystore.getPublicKey(),
    (payload: Uint8Array) => unshieldedKeystore.signData(payload),
  );
  const finalized = await wallet.finalizeRecipe(recipe);
  await wallet.submitTransaction(finalized);

  // Wait for dust to actually generate
  onStatus?.('Waiting for dust tokens to generate...');
  await Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.filter((s) => s.isSynced),
      Rx.filter((s) => s.dust.walletBalance(new Date()) > 0n),
    ),
  );
};

// ============================================================================
// Wallet Builder
// Mirrors: buildWalletAndWaitForFunds from api.ts
// ============================================================================

/**
 * Build (or restore) a wallet from a hex seed, then wait for sync and funds.
 *
 * Mirrors: buildWalletAndWaitForFunds() from example-counter/counter-cli/src/api.ts
 *
 * Differences from example-counter:
 *   - No CLI spinners (withStatus) — uses StatusCallback for React state updates
 *   - Returns wallet info needed by the UI (addresses, balances)
 *   - No genesis seed auto-login — user always provides seed
 */
export const buildWalletAndWaitForFunds = async (
  config: Config,
  seed: string,
  onStatus?: StatusCallback,
): Promise<WalletContext & { unshieldedAddress: string; shieldedAddress: string; balance: bigint }> => {
  // Step 1: Derive HD keys and initialize sub-wallets
  // Mirrors: the wallet-building block in api.ts buildWalletAndWaitForFunds()
  onStatus?.('Deriving wallet keys...');
  const keys = deriveKeysFromSeed(seed);
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], getNetworkId());

  onStatus?.('Initializing wallet...');
  const shieldedWallet = ShieldedWallet(buildShieldedConfig(config)).startWithSecretKeys(shieldedSecretKeys);
  const unshieldedWallet = UnshieldedWallet(buildUnshieldedConfig(config)).startWithPublicKey(
    PublicKey.fromKeyStore(unshieldedKeystore),
  );
  const dustWallet = DustWallet(buildDustConfig(config)).startWithSecretKey(
    dustSecretKey,
    ledger.LedgerParameters.initialParameters().dust,
  );

  const wallet = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
  await wallet.start(shieldedSecretKeys, dustSecretKey);

  // Step 2: Wait for sync
  // Mirrors: waitForSync() call in api.ts
  onStatus?.('Syncing with network...');
  const syncedState = await waitForSync(wallet);

  // Build addresses for display
  const networkId = getNetworkId();
  const coinPubKey = ShieldedCoinPublicKey.fromHexString(syncedState.shielded.coinPublicKey.toHexString());
  const encPubKey = ShieldedEncryptionPublicKey.fromHexString(syncedState.shielded.encryptionPublicKey.toHexString());
  const shieldedAddress = MidnightBech32m.encode(networkId, new ShieldedAddress(coinPubKey, encPubKey)).toString();
  const unshieldedAddress = unshieldedKeystore.getBech32Address();

  // Step 3: Check balance and wait for funds if needed
  // Mirrors: the balance-check block in api.ts
  let balance = syncedState.unshielded.balances[unshieldedToken().raw] ?? 0n;
  if (balance === 0n) {
    onStatus?.('Waiting for incoming tokens...');
    balance = await waitForFunds(wallet);
  }

  // Step 4: Register for dust generation
  // Mirrors: registerForDustGeneration() call in api.ts
  await registerForDustGeneration(wallet, unshieldedKeystore, onStatus);

  onStatus?.('Wallet ready!');
  return {
    wallet,
    shieldedSecretKeys,
    dustSecretKey,
    unshieldedKeystore,
    unshieldedAddress: String(unshieldedAddress),
    shieldedAddress,
    balance,
  };
};

/**
 * Build a wallet with a freshly generated random seed.
 * Mirrors: buildFreshWallet() from api.ts
 */
export const buildFreshWallet = async (config: Config, onStatus?: StatusCallback) => {
  const seed = toHex(Buffer.from(generateRandomSeed()));
  return { seed, ...(await buildWalletAndWaitForFunds(config, seed, onStatus)) };
};

/**
 * Generate a new random seed without building a wallet.
 * Useful for the UI to show the seed before the user confirms.
 */
export const generateNewSeed = (): string => toHex(Buffer.from(generateRandomSeed()));

/**
 * Format a token balance for display (e.g. 1000000000 → "1,000,000,000").
 * Mirrors: formatBalance() from api.ts
 */
export const formatBalance = (balance: bigint): string => balance.toLocaleString();
