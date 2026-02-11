// GhostSignal — useMarketplace hook
// Shared marketplace state: all listed signals, seller profiles, and purchase records.
// Acts as the "store" that all marketplace components read/write.
//
// In production, this would be backed by indexer queries + on-chain state.
// For now, it uses in-memory state seeded with realistic demo data.

import { useState, useCallback, useMemo } from 'react';
import type {
  MarketplaceSignal,
  SellerProfile,
  PurchaseRecord,
  TradingSignal,
  SignalStatus,
} from '../types';

// ============================================================================
// Demo Data — realistic marketplace signals with performance history
// ============================================================================

const DEMO_SELLERS: SellerProfile[] = [
  {
    id: 'seller-alpha',
    name: 'AlphaEdge AI',
    totalSignals: 142,
    correctSignals: 104,
    winRate: 73.2,
    avgConfidence: 78,
    totalStaked: 14200,
    totalEarned: 8950,
    activeSince: '2025-11-15',
    pairs: ['BTC/USD', 'ETH/USD'],
  },
  {
    id: 'seller-beta',
    name: 'MomentumBot',
    totalSignals: 89,
    correctSignals: 58,
    winRate: 65.2,
    avgConfidence: 72,
    totalStaked: 8900,
    totalEarned: 4200,
    activeSince: '2025-12-01',
    pairs: ['BTC/USD', 'SOL/USD', 'ETH/USD'],
  },
  {
    id: 'seller-gamma',
    name: 'DeepTrend γ',
    totalSignals: 214,
    correctSignals: 173,
    winRate: 80.8,
    avgConfidence: 85,
    totalStaked: 21400,
    totalEarned: 15600,
    activeSince: '2025-10-01',
    pairs: ['BTC/USD', 'ETH/USD', 'ADA/USD'],
  },
  {
    id: 'seller-delta',
    name: 'VolSurfer Δ',
    totalSignals: 67,
    correctSignals: 38,
    winRate: 56.7,
    avgConfidence: 65,
    totalStaked: 6700,
    totalEarned: 2100,
    activeSince: '2026-01-05',
    pairs: ['SOL/USD'],
  },
  {
    id: 'seller-epsilon',
    name: 'NeuralSwing',
    totalSignals: 310,
    correctSignals: 239,
    winRate: 77.1,
    avgConfidence: 81,
    totalStaked: 31000,
    totalEarned: 22400,
    activeSince: '2025-09-01',
    pairs: ['BTC/USD', 'ETH/USD', 'SOL/USD', 'ADA/USD'],
  },
];

function makeDemoSignals(): MarketplaceSignal[] {
  const now = Date.now();
  return [
    // Committed (hash visible, signal hidden)
    {
      id: 'sig-001',
      sellerName: 'AlphaEdge AI',
      pair: 'BTC/USD',
      commitmentHash: 'a3f2c8e1d4b7a9f06e5c3d2b1a0f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1',
      salt: '',
      signal: null,
      price: 120,
      status: 'committed',
      committedAt: new Date(now - 180_000).toISOString(),
      revealedAt: null,
      isCorrect: null,
      actualOutcome: null,
    },
    {
      id: 'sig-002',
      sellerName: 'DeepTrend γ',
      pair: 'ETH/USD',
      commitmentHash: 'b4e3d9f2a5c8b1e0d7f6a3c2b9e8d1f0a7c6b5e4d3f2a1c0b9e8d7f6a5c4b3',
      salt: '',
      signal: null,
      price: 200,
      status: 'committed',
      committedAt: new Date(now - 120_000).toISOString(),
      revealedAt: null,
      isCorrect: null,
      actualOutcome: null,
    },
    // Revealed (signal now visible, pending verification)
    {
      id: 'sig-003',
      sellerName: 'MomentumBot',
      pair: 'BTC/USD',
      commitmentHash: 'c5f4e0a3b6d9c2f1e8a7d0b3c6f5e4a1d0c9b8e7f6a5d4c3b2a1e0d9c8b7a6',
      salt: 'f1e2d3c4b5a6978869574a3b2c1d0e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6',
      signal: {
        id: 'sig-003',
        direction: 'BUY',
        pair: 'BTC/USD',
        targetPrice: 68500,
        confidence: 82,
        timestamp: new Date(now - 600_000).toISOString(),
      },
      price: 100,
      status: 'revealed',
      committedAt: new Date(now - 600_000).toISOString(),
      revealedAt: new Date(now - 300_000).toISOString(),
      isCorrect: null,
      actualOutcome: null,
    },
    {
      id: 'sig-004',
      sellerName: 'NeuralSwing',
      pair: 'SOL/USD',
      commitmentHash: 'd6a5f1b4c7e0d3a2b9f8c1e6d5a4b3c2f1e0d9a8c7b6f5e4d3a2c1b0e9f8d7',
      salt: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1',
      signal: {
        id: 'sig-004',
        direction: 'SELL',
        pair: 'SOL/USD',
        targetPrice: 142,
        confidence: 75,
        timestamp: new Date(now - 900_000).toISOString(),
      },
      price: 80,
      status: 'revealed',
      committedAt: new Date(now - 900_000).toISOString(),
      revealedAt: new Date(now - 450_000).toISOString(),
      isCorrect: null,
      actualOutcome: null,
    },
    // Verified (outcome known, signal scored)
    {
      id: 'sig-005',
      sellerName: 'DeepTrend γ',
      pair: 'BTC/USD',
      commitmentHash: 'e7b6a2c5d8f1e4a3c0b9d2f5e8a1c4b7f0d3a6c9e2b5f8a1d4c7e0b3f6a9d2',
      salt: 'deadbeef0123456789abcdef0123456789abcdef0123456789abcdef01234567',
      signal: {
        id: 'sig-005',
        direction: 'BUY',
        pair: 'BTC/USD',
        targetPrice: 65200,
        confidence: 88,
        timestamp: new Date(now - 3_600_000).toISOString(),
      },
      price: 200,
      status: 'verified',
      committedAt: new Date(now - 3_600_000).toISOString(),
      revealedAt: new Date(now - 1_800_000).toISOString(),
      isCorrect: true,
      actualOutcome: 66100,
    },
    {
      id: 'sig-006',
      sellerName: 'AlphaEdge AI',
      pair: 'ETH/USD',
      commitmentHash: 'f8c7b3d6e9a2f5c8b1d4e7a0f3c6b9e2d5a8f1c4b7e0d3a6f9c2b5e8a1d4c7',
      salt: 'cafebabe0123456789abcdef0123456789abcdef0123456789abcdef01234567',
      signal: {
        id: 'sig-006',
        direction: 'SELL',
        pair: 'ETH/USD',
        targetPrice: 3650,
        confidence: 71,
        timestamp: new Date(now - 7_200_000).toISOString(),
      },
      price: 120,
      status: 'verified',
      committedAt: new Date(now - 7_200_000).toISOString(),
      revealedAt: new Date(now - 5_400_000).toISOString(),
      isCorrect: true,
      actualOutcome: 3580,
    },
    {
      id: 'sig-007',
      sellerName: 'VolSurfer Δ',
      pair: 'SOL/USD',
      commitmentHash: '0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1',
      salt: 'baadf00d0123456789abcdef0123456789abcdef0123456789abcdef01234567',
      signal: {
        id: 'sig-007',
        direction: 'BUY',
        pair: 'SOL/USD',
        targetPrice: 155,
        confidence: 63,
        timestamp: new Date(now - 5_400_000).toISOString(),
      },
      price: 60,
      status: 'verified',
      committedAt: new Date(now - 5_400_000).toISOString(),
      revealedAt: new Date(now - 3_600_000).toISOString(),
      isCorrect: false,
      actualOutcome: 148,
    },
    {
      id: 'sig-008',
      sellerName: 'NeuralSwing',
      pair: 'ETH/USD',
      commitmentHash: '1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
      salt: 'f00dcafe0123456789abcdef0123456789abcdef0123456789abcdef01234567',
      signal: {
        id: 'sig-008',
        direction: 'BUY',
        pair: 'ETH/USD',
        targetPrice: 3400,
        confidence: 90,
        timestamp: new Date(now - 10_800_000).toISOString(),
      },
      price: 150,
      status: 'verified',
      committedAt: new Date(now - 10_800_000).toISOString(),
      revealedAt: new Date(now - 7_200_000).toISOString(),
      isCorrect: true,
      actualOutcome: 3520,
    },
  ];
}

// ============================================================================
// Hook
// ============================================================================

export function useMarketplace() {
  const [signals, setSignals] = useState<MarketplaceSignal[]>(makeDemoSignals);
  const [sellers] = useState<SellerProfile[]>(DEMO_SELLERS);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);

  // ---- Derived data ----

  /** Signals available for purchase (committed but not yet bought by this user) */
  const committedSignals = useMemo(
    () => signals.filter((s) => s.status === 'committed'),
    [signals],
  );

  /** Signals that have been revealed */
  const revealedSignals = useMemo(
    () => signals.filter((s) => s.status === 'revealed'),
    [signals],
  );

  /** Signals that have been verified with outcome */
  const verifiedSignals = useMemo(
    () => signals.filter((s) => s.status === 'verified'),
    [signals],
  );

  /** Seller lookup by name */
  const getSellerByName = useCallback(
    (name: string) => sellers.find((s) => s.name === name) ?? null,
    [sellers],
  );

  // ---- Actions ----

  /**
   * Create and list a new signal (seller action).
   * Called AFTER the on-chain commit_signal() succeeds.
   * The hash and salt are pre-computed in SignalCreator before the circuit call.
   */
  const createSignal = useCallback(
    async (params: {
      sellerName: string;
      pair: string;
      direction: 'BUY' | 'SELL';
      targetPrice: number;
      confidence: number;
      price: number;
      commitmentHash: string;  // Pre-computed by SignalCreator
      salt: string;            // Pre-computed by SignalCreator
    }): Promise<MarketplaceSignal> => {
      const signal: TradingSignal = {
        id: `sig-${Date.now()}`,
        direction: params.direction,
        pair: params.pair,
        targetPrice: params.targetPrice,
        confidence: params.confidence,
        timestamp: new Date().toISOString(),
      };

      const listing: MarketplaceSignal = {
        id: signal.id,
        sellerName: params.sellerName,
        pair: params.pair,
        commitmentHash: params.commitmentHash,  // Use pre-computed hash
        salt: params.salt,                      // Use pre-computed salt
        signal: null,  // Hidden until revealed
        price: params.price,
        status: 'committed',
        committedAt: new Date().toISOString(),
        revealedAt: null,
        isCorrect: null,
        actualOutcome: null,
      };

      // Store the actual signal data in a hidden property for reveal
      // (In production, this would be stored encrypted in the private state provider)
      (listing as MarketplaceSignal & { _hiddenSignal?: TradingSignal })._hiddenSignal = signal;

      setSignals((prev) => [listing, ...prev]);
      return listing;
    },
    [],
  );

  /** Buy a signal (buyer action) — records purchase, returns the signal */
  const purchaseSignal = useCallback(
    (signalId: string): PurchaseRecord | null => {
      const sig = signals.find((s) => s.id === signalId);
      if (!sig) return null;

      const record: PurchaseRecord = {
        signalId,
        buyerPaid: sig.price,
        purchasedAt: new Date().toISOString(),
        revealed: sig.status !== 'committed',
        signal: sig.signal,
      };

      setPurchases((prev) => [record, ...prev]);
      return record;
    },
    [signals],
  );

  /** Reveal a signal (seller action) — exposes the hidden signal data */
  const revealSignalById = useCallback((signalId: string) => {
    setSignals((prev) =>
      prev.map((s) => {
        if (s.id !== signalId) return s;
        // Retrieve the hidden signal data
        const hiddenSignal = (s as MarketplaceSignal & { _hiddenSignal?: TradingSignal })._hiddenSignal;
        return {
          ...s,
          status: 'revealed' as SignalStatus,
          revealedAt: new Date().toISOString(),
          signal: hiddenSignal ?? s.signal,  // Reveal the signal
        };
      }),
    );
    // Also update any purchase records
    setPurchases((prev) =>
      prev.map((p) => {
        if (p.signalId !== signalId) return p;
        const sig = signals.find((s) => s.id === signalId);
        const hiddenSignal = sig ? (sig as MarketplaceSignal & { _hiddenSignal?: TradingSignal })._hiddenSignal : null;
        return { ...p, revealed: true, signal: hiddenSignal ?? p.signal };
      }),
    );
  }, [signals]);

  /** Verify a signal against a market outcome (simulate for now) */
  const verifySignalById = useCallback(
    (signalId: string, actualOutcome: number) => {
      setSignals((prev) =>
        prev.map((s) => {
          if (s.id !== signalId || !s.signal) return s;
          const isCorrect =
            s.signal.direction === 'BUY'
              ? actualOutcome >= s.signal.targetPrice
              : actualOutcome <= s.signal.targetPrice;
          return {
            ...s,
            status: 'verified' as SignalStatus,
            isCorrect,
            actualOutcome,
          };
        }),
      );
    },
    [],
  );

  /** Marketplace summary stats */
  const marketStats = useMemo(() => {
    const total = signals.length;
    const verified = verifiedSignals.length;
    const correct = verifiedSignals.filter((s) => s.isCorrect).length;
    const totalVolume = signals.reduce((sum, s) => sum + s.price, 0);
    return {
      totalSignals: total,
      totalVerified: verified,
      totalCorrect: correct,
      overallWinRate: verified > 0 ? ((correct / verified) * 100).toFixed(1) : '0.0',
      totalVolume,
      activeSellers: sellers.length,
    };
  }, [signals, verifiedSignals, sellers]);

  return {
    // State
    signals,
    sellers,
    purchases,
    committedSignals,
    revealedSignals,
    verifiedSignals,
    marketStats,
    // Actions
    createSignal,
    purchaseSignal,
    revealSignalById,
    verifySignalById,
    getSellerByName,
  };
}
