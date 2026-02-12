// GhostSignal — Fund Agent Wallets
//
// Transfers tNight tokens from the genesis wallet to each agent wallet
// on the local standalone network. This must be run AFTER deploy.ts and
// BEFORE starting the agent simulation.
//
// Usage: npx tsx src/fund-agents.ts

import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v7';
import { networkConfig, config } from './config.js';
import * as chainApi from './chain-api.js';
import { createLogger } from './logger.js';

const logger = createLogger('Fund');

// Amount to send to each agent (100,000 tNight — enough for many transactions)
const FUND_AMOUNT = 100_000_000_000_000n; // 100,000 tNight (with 9 decimal places)

async function main() {
    console.log(`
   ██████╗ ██╗  ██╗ ██████╗ ███████╗████████╗
  ██╔════╝ ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
  ██║  ███╗███████║██║   ██║███████╗   ██║   
  ██║   ██║██╔══██║██║   ██║╚════██║   ██║   
  ╚██████╔╝██║  ██║╚██████╔╝███████║   ██║   
   ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   
  
  Fund Agent Wallets
  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─
`);

    // ── 1. Build genesis wallet ──────────────────────────────────────────
    setNetworkId(networkConfig.networkId);
    const genesisSeed = '0000000000000000000000000000000000000000000000000000000000000001';

    logger.info('Building genesis wallet...');
    const genesisCtx = await chainApi.buildWalletFromHexSeed(networkConfig, genesisSeed);
    const genesisAddr = String(genesisCtx.unshieldedKeystore.getBech32Address());
    logger.info(`Genesis address: ${genesisAddr}`);

    const genesisBalance = await chainApi.getUnshieldedBalance(genesisCtx.wallet);
    logger.info(`Genesis balance: ${genesisBalance} tNight`);

    if (genesisBalance === 0n) {
        logger.error('Genesis wallet has zero balance! Is the local network running?');
        await chainApi.closeWallet(genesisCtx);
        process.exit(1);
    }

    // ── 2. Derive agent addresses ────────────────────────────────────────
    logger.info('Deriving agent wallet addresses...');
    const agentAddresses: { name: string; address: string }[] = [];

    for (let i = 0; i < config.agentSeeds.length; i++) {
        const seed = config.agentSeeds[i];
        const name = config.agentNames[i];

        // Temporarily build each agent wallet just to get its address
        const agentCtx = await chainApi.initWalletWithSeed(seed, networkConfig);

        // Wait for sync
        await chainApi.waitForSync(agentCtx.wallet);

        const addr = String(agentCtx.unshieldedKeystore.getBech32Address());
        const balance = await chainApi.getUnshieldedBalance(agentCtx.wallet);

        agentAddresses.push({ name, address: addr });
        logger.info(`  ${name}: ${addr} (balance: ${balance} tNight)`);

        // Close agent wallet — we only needed the address
        await chainApi.closeWallet(agentCtx);
    }

    // ── 3. Transfer funds to each agent ──────────────────────────────────
    const nightTokenType = unshieldedToken().raw;

    for (const agent of agentAddresses) {
        logger.info(`Sending ${FUND_AMOUNT} tNight to ${agent.name}...`);

        try {
            const recipe = await genesisCtx.wallet.transferTransaction(
                [
                    {
                        type: 'unshielded' as const,
                        outputs: [
                            {
                                type: nightTokenType,
                                receiverAddress: agent.address,
                                amount: FUND_AMOUNT,
                            },
                        ],
                    },
                ],
                {
                    shieldedSecretKeys: genesisCtx.shieldedSecretKeys,
                    dustSecretKey: genesisCtx.dustSecretKey,
                },
                {
                    ttl: new Date(Date.now() + 30 * 60 * 1000),
                    payFees: true,
                },
            );

            // Sign the transaction
            const signFn = (payload: Uint8Array) => genesisCtx.unshieldedKeystore.signData(payload);
            const signedRecipe = await genesisCtx.wallet.signRecipe(recipe, signFn);

            // Finalize and submit
            const finalized = await genesisCtx.wallet.finalizeTransaction(
                signedRecipe.type === 'UNPROVEN_TRANSACTION' ? signedRecipe.transaction : (signedRecipe as any).transaction,
            );
            const txId = await genesisCtx.wallet.submitTransaction(finalized);

            logger.info(`  ✅ Sent to ${agent.name} — TX: ${txId}`);
        } catch (e: any) {
            logger.error(`  ❌ Failed to fund ${agent.name}: ${e.message || e}`);
        }

        // Small delay between transfers to avoid UTXO conflicts
        await new Promise((r) => setTimeout(r, 3000));
    }

    // ── 4. Verify balances ───────────────────────────────────────────────
    logger.info('Waiting for transfers to settle (15 seconds)...');
    await new Promise((r) => setTimeout(r, 15000));

    logger.info('Verifying agent balances...');
    for (let i = 0; i < config.agentSeeds.length; i++) {
        const agentCtx = await chainApi.initWalletWithSeed(config.agentSeeds[i], networkConfig);
        await chainApi.waitForSync(agentCtx.wallet);
        const balance = await chainApi.getUnshieldedBalance(agentCtx.wallet);
        const ok = balance > 0n ? '✅' : '❌';
        logger.info(`  ${ok} ${config.agentNames[i]}: ${balance} tNight`);
        await chainApi.closeWallet(agentCtx);
    }

    // ── 5. Cleanup ───────────────────────────────────────────────────────
    await chainApi.closeWallet(genesisCtx);

    console.log(`
  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─
  ✅ Agent funding complete! You can now run: npm run start
`);
}

main().catch((e) => {
    logger.error(`Funding failed: ${e}`);
    process.exit(1);
});
