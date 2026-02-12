#!/usr/bin/env node
// GhostSignal — Contract Deployment Script
// Mirrors: starter-template02/counter-cli/src/deploy.ts
//
// Usage: npx tsx src/deploy.ts [optional-hex-seed]
//
// Deploys the GhostMarketplace contract to the local Midnight network
// and saves the deployment info to deployment.json.

import path from 'node:path';
import fs from 'node:fs';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { initialPrivateState } from '@midnight-ntwrk/ghostsignal-contract';
import * as chainApi from './chain-api.js';
import { networkConfig, currentDir } from './config.js';
import { createLogger } from './logger.js';
import chalk from 'chalk';

const logger = createLogger('Deploy');

async function main() {
    console.log(chalk.cyan(`
   ██████╗ ██╗  ██╗ ██████╗ ███████╗████████╗
  ██╔════╝ ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
  ██║  ███╗███████║██║   ██║███████╗   ██║   
  ██║   ██║██╔══██║██║   ██║╚════██║   ██║   
  ╚██████╔╝██║  ██║╚██████╔╝███████║   ██║   
   ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   
  `));
    console.log(chalk.gray('  Contract Deployment'));
    console.log(chalk.gray('  ─'.repeat(25)));
    console.log();

    // Set network ID before anything else
    setNetworkId(networkConfig.networkId);

    // Check for command-line argument or use genesis wallet
    let walletSeed: string;
    const seedArg = process.argv[2];

    if (seedArg && seedArg.length === 64) {
        walletSeed = seedArg;
        logger.info('Using provided wallet seed.');
    } else {
        // Genesis wallet on local standalone network
        walletSeed = '0000000000000000000000000000000000000000000000000000000000000001';
        logger.info('Using genesis wallet seed for local network.');
    }

    let walletContext: chainApi.WalletContext | null = null;

    try {
        // Build wallet
        logger.info('Building wallet...');
        walletContext = await chainApi.buildWalletFromHexSeed(networkConfig, walletSeed);

        const walletAddress = walletContext.unshieldedKeystore.getBech32Address();
        console.log(`  Wallet Address: ${chalk.yellow(walletAddress)}`);
        console.log();

        // Configure providers
        logger.info('Configuring providers...');
        const providers = await chainApi.configureProviders(walletContext, networkConfig);

        // Deploy contract
        logger.info('Deploying contract. This may take 30–60 seconds...');
        const deployedContract = await chainApi.deploy(providers, initialPrivateState);

        const contractAddress = deployedContract.deployTxData.public.contractAddress;

        // Save deployment info
        const deploymentInfo = {
            contractAddress,
            deployedAt: new Date().toISOString(),
            network: 'standalone',
            walletAddress,
            config: {
                indexer: networkConfig.indexer,
                indexerWS: networkConfig.indexerWS,
                node: networkConfig.node,
                proofServer: networkConfig.proofServer,
            },
        };

        const deploymentPath = path.resolve(currentDir, '..', 'deployment.json');
        fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

        console.log();
        console.log(chalk.green.bold('  ✅ CONTRACT DEPLOYED SUCCESSFULLY'));
        console.log(`  Contract Address: ${chalk.yellow(contractAddress)}`);
        console.log(`  Deployment info:  ${chalk.gray(deploymentPath)}`);
        console.log();

        // Clean up
        await chainApi.closeWallet(walletContext);
        process.exit(0);
    } catch (error) {
        logger.error(`Deployment failed: ${error}`);
        if (walletContext) await chainApi.closeWallet(walletContext);
        process.exit(1);
    }
}

main().catch(console.error);
