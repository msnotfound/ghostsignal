// GhostSignal — useWallet hook
// Wraps the wallet.ts service for React components.

import { useState, useCallback } from 'react';
import { StandaloneConfig, PreviewConfig, PreprodConfig, type Config } from '../services/config';
import {
  buildWalletAndWaitForFunds,
  buildFreshWallet,
  getDustBalance,
  formatBalance,
  type WalletContext,
} from '../services/wallet';
import type { WalletState } from '../types';

type WalletStatus = 'idle' | 'building' | 'syncing' | 'waiting-funds' | 'ready' | 'error';
type Network = 'standalone' | 'preview' | 'preprod';

const getConfig = (network: Network): Config => {
  switch (network) {
    case 'preview':
      return new PreviewConfig();
    case 'preprod':
      return new PreprodConfig();
    default:
      return new StandaloneConfig();
  }
};

export function useWallet() {
  const [walletContext, setWalletContext] = useState<WalletContext | null>(null);
  const [walletState, setWalletState] = useState<WalletState | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [status, setStatus] = useState<WalletStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onStatus = useCallback((msg: string) => {
    setStatusMessage(msg);
    if (msg.includes('Syncing')) setStatus('syncing');
    else if (msg.includes('Waiting for incoming')) setStatus('waiting-funds');
    else if (msg.includes('ready')) setStatus('ready');
  }, []);

  /** Restore wallet from seed */
  const restoreWallet = useCallback(
    async (seed: string, network: Network = 'standalone') => {
      setError(null);
      setStatus('building');
      setStatusMessage('Building wallet...');

      try {
        const cfg = getConfig(network);
        setConfig(cfg);

        const ctx = await buildWalletAndWaitForFunds(cfg, seed, onStatus);
        setWalletContext(ctx);

        const dust = await getDustBalance(ctx.wallet);

        const state: WalletState = {
          mode: 'manual',
          seed,
          isSynced: true,
          balance: ctx.balance,
          dustBalance: dust.available,
          unshieldedAddress: ctx.unshieldedAddress,
          shieldedAddress: ctx.shieldedAddress,
          hasFunds: ctx.balance > 0n,
        };
        setWalletState(state);
        setStatus('ready');
        setStatusMessage(`Balance: ${formatBalance(ctx.balance)} tNight`);

        return { walletContext: ctx, walletState: state, config: cfg };
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to build wallet');
        throw err;
      }
    },
    [onStatus],
  );

  /** Create a fresh wallet with a random seed */
  const createFreshWallet = useCallback(
    async (network: Network = 'standalone') => {
      setError(null);
      setStatus('building');
      setStatusMessage('Generating seed and building wallet...');

      try {
        const cfg = getConfig(network);
        setConfig(cfg);

        const result = await buildFreshWallet(cfg, onStatus);
        setWalletContext(result);

        const dust = await getDustBalance(result.wallet);

        const state: WalletState = {
          mode: 'manual',
          seed: result.seed,
          isSynced: true,
          balance: result.balance,
          dustBalance: dust.available,
          unshieldedAddress: result.unshieldedAddress,
          shieldedAddress: result.shieldedAddress,
          hasFunds: result.balance > 0n,
        };
        setWalletState(state);
        setStatus('ready');

        return { walletContext: result, walletState: state, config: cfg };
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to create wallet');
        throw err;
      }
    },
    [onStatus],
  );

  /** Refresh balances */
  const refreshBalance = useCallback(async () => {
    if (!walletContext) return;

    const dust = await getDustBalance(walletContext.wallet);
    setWalletState((prev) =>
      prev
        ? {
            ...prev,
            dustBalance: dust.available,
          }
        : prev,
    );
  }, [walletContext]);

  return {
    walletContext,
    walletState,
    config,
    status,
    statusMessage,
    error,
    restoreWallet,
    createFreshWallet,
    refreshBalance,
  };
}
