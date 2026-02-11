// GhostSignal — SignalPurchase component
// Interface for buying signals from agents on the marketplace.

import { useState, useCallback } from 'react';
import type { DeployedMarketplaceContract, MarketplaceProviders } from '../types/common-types';

interface SignalPurchaseProps {
  contract: DeployedMarketplaceContract;
  providers: MarketplaceProviders;
}

interface AvailableSignal {
  agentName: string;
  pair: string;
  winRate: number;
  price: bigint;
  commitmentHash: string;
  isRevealed: boolean;
}

export default function SignalPurchase({ contract: _contract, providers: _providers }: SignalPurchaseProps) {
  const [selectedSignal, setSelectedSignal] = useState<AvailableSignal | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchasedSignals, setPurchasedSignals] = useState<string[]>([]);

  // Demo signals (in production, these come from indexer queries)
  const availableSignals: AvailableSignal[] = [
    {
      agentName: 'Agent Alpha',
      pair: 'BTC/USD',
      winRate: 72,
      price: 50n,
      commitmentHash: 'a1b2c3d4e5f6...',
      isRevealed: false,
    },
    {
      agentName: 'Agent Beta',
      pair: 'ETH/USD',
      winRate: 65,
      price: 30n,
      commitmentHash: 'f6e5d4c3b2a1...',
      isRevealed: true,
    },
    {
      agentName: 'Agent Gamma',
      pair: 'SOL/USD',
      winRate: 81,
      price: 75n,
      commitmentHash: '1a2b3c4d5e6f...',
      isRevealed: false,
    },
  ];

  const handlePurchase = useCallback(async (signal: AvailableSignal) => {
    setSelectedSignal(signal);
    setIsPurchasing(true);

    try {
      // In production, this would call a purchase circuit on-chain
      // For now, simulate a purchase delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setPurchasedSignals((prev) => [...prev, signal.commitmentHash]);
    } finally {
      setIsPurchasing(false);
      setSelectedSignal(null);
    }
  }, []);

  return (
    <div className="card">
      <h3 className="card-title">🛒 Buy Signals</h3>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
        Purchase trading signals from AI agents. Signals are backed by on-chain stakes.
      </p>

      {availableSignals.map((signal) => {
        const isPurchased = purchasedSignals.includes(signal.commitmentHash);
        const isThisPurchasing = isPurchasing && selectedSignal?.commitmentHash === signal.commitmentHash;

        return (
          <div
            key={signal.commitmentHash}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                {signal.agentName} — {signal.pair}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Win rate:{' '}
                <span style={{ color: signal.winRate >= 70 ? 'var(--accent-green)' : 'var(--accent-orange)' }}>
                  {signal.winRate}%
                </span>
                {' • '}
                {signal.isRevealed ? (
                  <span className="badge badge-warning">revealed</span>
                ) : (
                  <span className="badge badge-info">committed</span>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--accent-orange)', marginBottom: 4 }}>
                {Number(signal.price)} tNight
              </div>
              {isPurchased ? (
                <span className="badge badge-success">purchased</span>
              ) : (
                <button
                  className="btn btn-primary"
                  style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                  onClick={() => handlePurchase(signal)}
                  disabled={isPurchasing}
                >
                  {isThisPurchasing ? <span className="spinner" /> : '🛒 Buy'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
