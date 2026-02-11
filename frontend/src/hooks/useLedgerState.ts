// GhostSignal — useLedgerState hook
// Fetches real-time ledger state from the indexer via the publicDataProvider.
//
// This hook polls the contract's public ledger state and returns:
//   - totalCommitments, totalReveals, totalVerified, activeAgents, totalStakeLocked
//
// In production, this would use WebSocket subscriptions for real-time updates.

import { useState, useEffect, useCallback } from 'react';
import { getMarketplaceLedgerState } from '../services/midnight';
import type { MarketplaceProviders } from '../types/common-types';
import type { MarketplaceStats } from '../types';

interface UseLedgerStateOptions {
  providers: MarketplaceProviders | null;
  contractAddress: string;
  pollInterval?: number;  // ms between polls, default 10000
}

interface UseLedgerStateResult {
  ledgerState: MarketplaceStats | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch and poll the on-chain ledger state.
 */
export function useLedgerState({
  providers,
  contractAddress,
  pollInterval = 10000,
}: UseLedgerStateOptions): UseLedgerStateResult {
  const [ledgerState, setLedgerState] = useState<MarketplaceStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    if (!providers || !contractAddress) return;

    setIsLoading(true);
    setError(null);

    try {
      const state = await getMarketplaceLedgerState(providers, contractAddress as `0x${string}`);
      setLedgerState(state);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch ledger state';
      console.error('[useLedgerState] Error:', err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [providers, contractAddress]);

  // Initial fetch
  useEffect(() => {
    void fetchState();
  }, [fetchState]);

  // Polling
  useEffect(() => {
    if (!providers || !contractAddress || pollInterval <= 0) return;

    const interval = setInterval(() => {
      void fetchState();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [providers, contractAddress, pollInterval, fetchState]);

  return {
    ledgerState,
    isLoading,
    error,
    refresh: fetchState,
  };
}
