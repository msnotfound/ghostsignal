// GhostSignal — Real Chain API
// Mirrors: example-counter/counter-cli/src/api.ts
//          starter-template02/counter-cli/src/api.ts
//
// This module provides all Midnight SDK integration:
//   - Wallet initialization from hex seed
//   - Provider configuration
//   - Contract deployment and joining
//   - Circuit call wrappers for GhostMarketplace

import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import { GhostMarketplace, witnesses, initialPrivateState } from '@midnight-ntwrk/ghostsignal-contract';
import type { GhostMarketplacePrivateState } from '@midnight-ntwrk/ghostsignal-contract';
import * as ledger from '@midnight-ntwrk/ledger-v7';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v7';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { type FinalizedTxData, type MidnightProvider, type WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
    createKeystore,
    InMemoryTransactionHistoryStorage,
    PublicKey,
    UnshieldedWallet,
    type UnshieldedKeystore,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { assertIsContractAddress } from '@midnight-ntwrk/midnight-js-utils';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { Buffer } from 'buffer';
import * as Rx from 'rxjs';
import { WebSocket } from 'ws';

import {
    type GhostMarketplaceCircuits,
    type GhostMarketplaceProviders,
    type DeployedGhostMarketplaceContract,
    GhostMarketplacePrivateStateId,
} from './common-types.js';
import { type NetworkConfig, contractConfig } from './config.js';
import { createLogger } from './logger.js';

const logger = createLogger('Chain');

// Required for GraphQL subscriptions (wallet sync) to work in Node.js
// @ts-expect-error: It's needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

// ============================================================================
// Pre-compile the contract with ZK circuit assets (v3.0.0 pattern)
// ============================================================================
const ghostMarketplaceCompiledContract = CompiledContract.make(
    'ghost-marketplace',
    GhostMarketplace.Contract,
).pipe(
    CompiledContract.withVacantWitnesses,
    CompiledContract.withCompiledFileAssets(contractConfig.zkConfigPath),
);

// ============================================================================
// Wallet context — holds all wallet components together
// ============================================================================
export interface WalletContext {
    wallet: WalletFacade;
    shieldedSecretKeys: ledger.ZswapSecretKeys;
    dustSecretKey: ledger.DustSecretKey;
    unshieldedKeystore: UnshieldedKeystore;
}

// ============================================================================
// Key derivation from seed
// ============================================================================
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
// Wallet configuration helpers
// ============================================================================
const buildShieldedConfig = (config: NetworkConfig) => ({
    networkId: getNetworkId(),
    indexerClientConnection: {
        indexerHttpUrl: config.indexer,
        indexerWsUrl: config.indexerWS,
    },
    provingServerUrl: new URL(config.proofServer),
    relayURL: new URL(config.node),
});

const buildUnshieldedConfig = (config: NetworkConfig) => ({
    networkId: getNetworkId(),
    indexerClientConnection: {
        indexerHttpUrl: config.indexer,
        indexerWsUrl: config.indexerWS,
    },
    txHistoryStorage: new InMemoryTransactionHistoryStorage(),
});

const buildDustConfig = (config: NetworkConfig) => ({
    networkId: getNetworkId(),
    costParameters: {
        additionalFeeOverhead: 300_000_000_000_000n,
        feeBlocksMargin: 5,
    },
    indexerClientConnection: {
        indexerHttpUrl: config.indexer,
        indexerWsUrl: config.indexerWS,
    },
    provingServerUrl: new URL(config.proofServer),
    relayURL: new URL(config.node),
});

// ============================================================================
// Wallet construction
// ============================================================================
export const initWalletWithSeed = async (
    hexSeed: string,
    config: NetworkConfig,
): Promise<WalletContext> => {
    const keys = deriveKeysFromSeed(hexSeed);
    const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
    const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
    const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], getNetworkId());

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

    return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
};

// ============================================================================
// Sync & balance helpers
// ============================================================================
export const waitForSync = (wallet: WalletFacade) =>
    Rx.firstValueFrom(
        wallet.state().pipe(
            Rx.throttleTime(5_000),
            Rx.filter((state) => state.isSynced),
        ),
    );

export const waitForFunds = (wallet: WalletFacade): Promise<bigint> =>
    Rx.firstValueFrom(
        wallet.state().pipe(
            Rx.throttleTime(10_000),
            Rx.filter((state) => state.isSynced),
            Rx.map((s) => s.unshielded?.balances[unshieldedToken().raw] ?? 0n),
            Rx.filter((balance) => balance > 0n),
        ),
    );

export const getUnshieldedBalance = async (wallet: WalletFacade): Promise<bigint> => {
    const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));
    return state.unshielded?.balances[unshieldedToken().raw] ?? 0n;
};

// ============================================================================
// Dust registration (required to pay transaction fees)
// ============================================================================
export const registerNightForDust = async (walletContext: WalletContext): Promise<boolean> => {
    const state = await Rx.firstValueFrom(walletContext.wallet.state().pipe(Rx.filter((s) => s.isSynced)));

    // If dust already available, skip
    if (state.dust.availableCoins.length > 0) {
        const dustBal = state.dust.walletBalance(new Date());
        logger.info(`Dust tokens already available (${dustBal} DUST)`);
        return true;
    }

    // Only register coins that haven't been designated yet
    const unregisteredNightUtxos =
        state.unshielded?.availableCoins.filter(
            (coin: any) => coin.meta?.registeredForDustGeneration !== true,
        ) ?? [];

    if (unregisteredNightUtxos.length === 0) {
        logger.info('All Night UTXOs already registered. Waiting for dust to generate...');
        await Rx.firstValueFrom(
            walletContext.wallet.state().pipe(
                Rx.throttleTime(5_000),
                Rx.filter((s) => s.isSynced),
                Rx.filter((s) => s.dust.walletBalance(new Date()) > 0n),
            ),
        );
        return true;
    }

    logger.info(`Registering ${unregisteredNightUtxos.length} Night UTXO(s) for dust generation...`);

    try {
        const recipe = await walletContext.wallet.registerNightUtxosForDustGeneration(
            unregisteredNightUtxos,
            walletContext.unshieldedKeystore.getPublicKey(),
            (payload) => walletContext.unshieldedKeystore.signData(payload),
        );

        const finalized = await walletContext.wallet.finalizeRecipe(recipe);
        await walletContext.wallet.submitTransaction(finalized);
        logger.info('Dust registration submitted. Waiting for dust to generate...');

        await Rx.firstValueFrom(
            walletContext.wallet.state().pipe(
                Rx.throttleTime(5_000),
                Rx.filter((s) => s.isSynced),
                Rx.filter((s) => (s.dust?.walletBalance(new Date()) ?? 0n) > 0n),
            ),
        );

        logger.info('Dust registration complete!');
        return true;
    } catch (e) {
        logger.error(`Failed to register Night UTXOs for dust: ${e}`);
        return false;
    }
};

// ============================================================================
// Build wallet from hex seed (full flow: init → sync → balance → dust)
// ============================================================================
export const buildWalletFromHexSeed = async (
    config: NetworkConfig,
    hexSeed: string,
): Promise<WalletContext> => {
    logger.info('Building wallet from hex seed...');
    const walletContext = await initWalletWithSeed(hexSeed, config);

    const walletAddress = walletContext.unshieldedKeystore.getBech32Address();
    logger.info(`Wallet address: ${walletAddress}`);

    logger.info('Waiting for wallet to sync...');
    await waitForSync(walletContext.wallet);

    const balance = await getUnshieldedBalance(walletContext.wallet);
    logger.info(`Balance: ${balance} tNight`);

    if (balance > 0n) {
        await registerNightForDust(walletContext);
    } else {
        logger.warn('Wallet has zero balance — skipping dust registration. Fund this wallet to enable transactions.');
    }

    return walletContext;
};

// ============================================================================
// Workaround for wallet-sdk-facade 1.0.0 signRecipe bug
// ============================================================================
const signTransactionIntents = (
    tx: { intents?: Map<number, any> },
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

// ============================================================================
// WalletProvider & MidnightProvider bridge (v3.0.0 pattern)
// ============================================================================
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

            // Apply signRecipe workaround
            const signFn = (payload: Uint8Array) => ctx.unshieldedKeystore.signData(payload);
            signTransactionIntents(recipe.baseTransaction, signFn, 'proof');
            if (recipe.balancingTransaction) {
                signTransactionIntents(recipe.balancingTransaction, signFn, 'pre-proof');
            }

            return ctx.wallet.finalizeRecipe(recipe);
        },
        submitTx(tx) {
            return ctx.wallet.submitTransaction(tx) as any;
        },
    };
};

// ============================================================================
// Provider configuration
// ============================================================================
export const configureProviders = async (
    walletContext: WalletContext,
    config: NetworkConfig,
    privateStateStoreName?: string,
): Promise<GhostMarketplaceProviders> => {
    setNetworkId(config.networkId);

    const walletAndMidnightProvider = await createWalletAndMidnightProvider(walletContext);
    const zkConfigProvider = new NodeZkConfigProvider<GhostMarketplaceCircuits>(contractConfig.zkConfigPath);

    const storeName = privateStateStoreName ?? contractConfig.privateStateStoreName;
    // Each agent needs its own LevelDB directory (midnightDbName) because the
    // database is encrypted with the wallet's encryption public key. Multiple
    // wallets cannot share a single encrypted LevelDB instance.
    const dbName = privateStateStoreName ? `midnight-ldb-${privateStateStoreName}` : 'midnight-level-db';
    logger.info(`Using private state store: ${storeName} (db: ${dbName})`);

    return {
        privateStateProvider: levelPrivateStateProvider<typeof GhostMarketplacePrivateStateId>({
            midnightDbName: dbName,
            privateStateStoreName: storeName,
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
// Contract operations
// ============================================================================

/** Deploy a new GhostMarketplace contract */
export const deploy = async (
    providers: GhostMarketplaceProviders,
    privateState: GhostMarketplacePrivateState,
): Promise<DeployedGhostMarketplaceContract> => {
    logger.info('Deploying GhostMarketplace contract...');
    const contract = await deployContract(providers, {
        compiledContract: ghostMarketplaceCompiledContract,
        privateStateId: GhostMarketplacePrivateStateId,
        initialPrivateState: privateState,
    });
    logger.info(`Deployed contract at address: ${contract.deployTxData.public.contractAddress}`);
    return contract;
};

/** Join an already-deployed GhostMarketplace contract */
export const joinContract = async (
    providers: GhostMarketplaceProviders,
    contractAddress: string,
): Promise<DeployedGhostMarketplaceContract> => {
    logger.info(`Joining contract at ${contractAddress}...`);
    const contract = await findDeployedContract(providers, {
        contractAddress,
        compiledContract: ghostMarketplaceCompiledContract,
        privateStateId: GhostMarketplacePrivateStateId,
        initialPrivateState: initialPrivateState,
    });
    logger.info(`Joined contract at address: ${contract.deployTxData.public.contractAddress}`);
    return contract;
};

/** Read marketplace stats from the on-chain ledger */
export const getLedgerState = async (
    providers: GhostMarketplaceProviders,
    contractAddress: ContractAddress,
): Promise<GhostMarketplace.Ledger | null> => {
    assertIsContractAddress(contractAddress);
    const state = await providers.publicDataProvider
        .queryContractState(contractAddress)
        .then((cs) => (cs != null ? GhostMarketplace.ledger(cs.data) : null));
    return state;
};

// ============================================================================
// Circuit call wrappers — each returns real FinalizedTxData
// ============================================================================

export const callCommitSignal = async (
    contract: DeployedGhostMarketplaceContract,
): Promise<FinalizedTxData> => {
    logger.info('Calling commit_signal circuit...');
    const result = await contract.callTx.commit_signal();
    logger.info(`commit_signal TX: ${result.public.txId} (block ${result.public.blockHeight})`);
    return result.public;
};

export const callRevealSignal = async (
    contract: DeployedGhostMarketplaceContract,
): Promise<FinalizedTxData> => {
    logger.info('Calling reveal_signal circuit...');
    const result = await contract.callTx.reveal_signal();
    logger.info(`reveal_signal TX: ${result.public.txId} (block ${result.public.blockHeight})`);
    return result.public;
};

export const callVerifySignal = async (
    contract: DeployedGhostMarketplaceContract,
): Promise<FinalizedTxData> => {
    logger.info('Calling verify_signal circuit...');
    const result = await contract.callTx.verify_signal();
    logger.info(`verify_signal TX: ${result.public.txId} (block ${result.public.blockHeight})`);
    return result.public;
};

export const callRegisterAgent = async (
    contract: DeployedGhostMarketplaceContract,
): Promise<FinalizedTxData> => {
    logger.info('Calling register_agent circuit...');
    const result = await contract.callTx.register_agent();
    logger.info(`register_agent TX: ${result.public.txId} (block ${result.public.blockHeight})`);
    return result.public;
};

// ============================================================================
// Wallet lifecycle
// ============================================================================
export const closeWallet = async (walletContext: WalletContext): Promise<void> => {
    try {
        await walletContext.wallet.stop();
    } catch (e) {
        logger.error(`Error closing wallet: ${e}`);
    }
};
