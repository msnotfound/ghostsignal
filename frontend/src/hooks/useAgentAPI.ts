// useAgentAPI hook
// Connects to the GhostSignal agent API server for real-time data

import { useState, useEffect, useCallback } from 'react';

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ============================================
// Types matching API response
// ============================================

export interface ActivityEvent {
  id: string;
  type: 'generate' | 'commit' | 'reveal' | 'verify' | 'purchase';
  timestamp: number;
  agent: string;
  data: {
    signal?: {
      id: string;
      pair: string;
      direction: 'LONG' | 'SHORT';
      entry: number;
      target: number;
      stopLoss: number;
      timeframe: string;
      confidence: string;
      rationale: string;
      timestamp: number;
    };
    commitment?: {
      id: string;
      signalId: string;
      hash: string;
      txHash?: string;
      revealed: boolean;
      verified: boolean;
    };
    outcome?: 'win' | 'loss';
    seller?: string;
    price?: number;
  };
  txHash?: string;
}

export interface MarketStats {
  totalSignals: number;
  activeCommitments: number;
  revealedSignals: number;
  verifiedSignals: number;
  totalVolume: number;
  agentCount: number;
  timestamp: number;
}

export interface AgentStats {
  signalsCreated: number;
  signalsRevealed: number;
  signalsVerified: number;
  signalsPurchased: number;
  totalEarned: number;
  totalSpent: number;
  successRate: number;
}

export interface LeaderboardEntry {
  name: string;
  address: string;
  stats: AgentStats;
  balance: number;
}

export interface RevealedSignal {
  agent: string;
  signal: {
    id: string;
    pair: string;
    direction: 'LONG' | 'SHORT';
    entry: number;
    target: number;
    stopLoss: number;
    timeframe: string;
    confidence: string;
    rationale: string;
    timestamp: number;
  };
  commitment?: {
    id: string;
    hash: string;
    txHash?: string;
  };
}

export interface TxDetails {
  txHash: string;
  type: string;
  timestamp: number;
  agent: string;
  data: Record<string, unknown>;
  block: {
    number: number;
    hash: string;
  };
}

// ============================================
// Hook
// ============================================

export function useAgentAPI() {
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [signals, setSignals] = useState<RevealedSignal[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/stats`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
      setConnected(true);
      setError(null);
      setLastUpdate(new Date());
    } catch (e) {
      setConnected(false);
      setError(e instanceof Error ? e.message : 'Connection error');
    }
  }, []);

  // Fetch activity feed
  const fetchActivity = useCallback(async (limit = 50) => {
    try {
      const res = await fetch(`${API_BASE}/api/activity?limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch activity');
      const data = await res.json();
      setActivity(data.events);
    } catch (e) {
      console.error('Activity fetch error:', e);
    }
  }, []);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/leaderboard`);
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      const data = await res.json();
      setLeaderboard(data.leaderboard);
    } catch (e) {
      console.error('Leaderboard fetch error:', e);
    }
  }, []);

  // Fetch revealed signals
  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/signals`);
      if (!res.ok) throw new Error('Failed to fetch signals');
      const data = await res.json();
      setSignals(data.signals);
    } catch (e) {
      console.error('Signals fetch error:', e);
    }
  }, []);

  // Lookup transaction
  const lookupTx = useCallback(async (hash: string): Promise<TxDetails | null> => {
    try {
      const res = await fetch(`${API_BASE}/api/tx/${encodeURIComponent(hash)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  // Poll for updates
  useEffect(() => {
    // Initial fetch
    fetchStats();
    fetchActivity();
    fetchLeaderboard();
    fetchSignals();

    // Set up polling
    const statsInterval = setInterval(fetchStats, 5000);
    const activityInterval = setInterval(() => fetchActivity(50), 3000);
    const leaderboardInterval = setInterval(fetchLeaderboard, 10000);
    const signalsInterval = setInterval(fetchSignals, 5000);

    return () => {
      clearInterval(statsInterval);
      clearInterval(activityInterval);
      clearInterval(leaderboardInterval);
      clearInterval(signalsInterval);
    };
  }, [fetchStats, fetchActivity, fetchLeaderboard, fetchSignals]);

  return {
    // State
    stats,
    activity,
    leaderboard,
    signals,
    connected,
    error,
    lastUpdate,
    // Methods
    lookupTx,
    refresh: () => {
      fetchStats();
      fetchActivity();
      fetchLeaderboard();
      fetchSignals();
    },
  };
}

export default useAgentAPI;
