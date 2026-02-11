// GhostSignal — useAgentStats hook
// Polls agent statistics from the on-chain ledger.

import { useState, useEffect, useCallback } from 'react';
import { getMarketplaceLedgerState } from '../services/midnight';
import type { MarketplaceProviders, DeployedMarketplaceContract } from '../types/common-types';
import type { AgentProfile, MarketplaceStats } from '../types';

export function useAgentStats(
  contract: DeployedMarketplaceContract | null,
  providers: MarketplaceProviders | null,
  pollIntervalMs = 15_000,
) {
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!contract || !providers) return;
    setIsLoading(true);
    try {
      const address = contract.deployTxData.public.contractAddress;
      const result = await getMarketplaceLedgerState(providers, address);
      if (result) {
        setStats(result);
        // Derive agent profile from aggregate stats (per-agent in production)
        const winRate = result.totalReveals > 0n
          ? Number((result.totalVerified * 100n) / result.totalReveals)
          : 0;
        setAgentProfile({
          totalCommitments: result.totalCommitments,
          totalReveals: result.totalReveals,
          totalVerified: result.totalVerified,
          winRate,
          currentStake: result.totalStakeLocked,
        });
      }
    } catch (err) {
      console.error('[useAgentStats] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [contract, providers]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), pollIntervalMs);
    return () => clearInterval(interval);
  }, [refresh, pollIntervalMs]);

  return { stats, agentProfile, isLoading, refresh };
}
