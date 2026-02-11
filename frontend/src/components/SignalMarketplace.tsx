// GhostSignal — SignalMarketplace component
// The main marketplace view where buyers browse, filter, and purchase signals.
//
// Shows three tabs:
//   🔒 Committed — hash visible, signal hidden, available for purchase
//   👁️ Revealed  — signal data visible, can verify hash
//   ✅ Verified  — outcome known, scored

import { useState, useCallback } from 'react';
import type { MarketplaceSignal, PurchaseRecord, SellerProfile } from '../types';

type Tab = 'committed' | 'revealed' | 'verified';

interface SignalMarketplaceProps {
  committedSignals: MarketplaceSignal[];
  revealedSignals: MarketplaceSignal[];
  verifiedSignals: MarketplaceSignal[];
  purchases: PurchaseRecord[];
  onPurchase: (signalId: string) => PurchaseRecord | null;
  onReveal: (signalId: string) => void | Promise<void>;
  getSellerByName: (name: string) => SellerProfile | null;
  currentSeller?: string;
  revealingId?: string | null;  // ID of signal currently being revealed
}

export default function SignalMarketplace({
  committedSignals,
  revealedSignals,
  verifiedSignals,
  purchases,
  onPurchase,
  onReveal,
  getSellerByName,
  currentSeller,
  revealingId,
}: SignalMarketplaceProps) {
  const [tab, setTab] = useState<Tab>('committed');
  const [pairFilter, setPairFilter] = useState<string>('ALL');
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [justPurchased, setJustPurchased] = useState<string | null>(null);

  const isPurchased = useCallback(
    (signalId: string) => purchases.some((p) => p.signalId === signalId),
    [purchases],
  );

  const handleBuy = useCallback(
    async (signalId: string) => {
      setPurchasingId(signalId);
      // Simulate a short delay for UX
      await new Promise((r) => setTimeout(r, 800));
      onPurchase(signalId);
      setPurchasingId(null);
      setJustPurchased(signalId);
      setTimeout(() => setJustPurchased(null), 2000);
    },
    [onPurchase],
  );

  const signals =
    tab === 'committed'
      ? committedSignals
      : tab === 'revealed'
        ? revealedSignals
        : verifiedSignals;

  const filtered =
    pairFilter === 'ALL' ? signals : signals.filter((s) => s.pair === pairFilter);

  const allPairs = ['ALL', ...new Set(signals.map((s) => s.pair))];

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const mins = Math.round((Date.now() - d.getTime()) / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  };

  return (
    <div className="card signal-marketplace">
      <h3 className="card-title">🛒 Signal Marketplace</h3>

      {/* Tabs */}
      <div className="marketplace-tabs">
        <button
          className={`tab ${tab === 'committed' ? 'tab-active' : ''}`}
          onClick={() => setTab('committed')}
        >
          🔒 Committed ({committedSignals.length})
        </button>
        <button
          className={`tab ${tab === 'revealed' ? 'tab-active' : ''}`}
          onClick={() => setTab('revealed')}
        >
          👁️ Revealed ({revealedSignals.length})
        </button>
        <button
          className={`tab ${tab === 'verified' ? 'tab-active' : ''}`}
          onClick={() => setTab('verified')}
        >
          ✅ Verified ({verifiedSignals.length})
        </button>
      </div>

      {/* Pair filter chips */}
      <div className="pair-filter">
        {allPairs.map((p) => (
          <button
            key={p}
            className={`pair-chip ${pairFilter === p ? 'pair-chip-active' : ''}`}
            onClick={() => setPairFilter(p)}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Signal list */}
      {filtered.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32, fontSize: '0.9rem' }}>
          No {tab} signals{pairFilter !== 'ALL' ? ` for ${pairFilter}` : ''}.
        </div>
      ) : (
        <div className="signal-list">
          {filtered.map((sig) => {
            const seller = getSellerByName(sig.sellerName);
            const bought = isPurchased(sig.id);
            const buying = purchasingId === sig.id;
            const justBought = justPurchased === sig.id;
            const isOwnSignal = sig.sellerName === currentSeller;

            return (
              <div key={sig.id} className={`signal-row ${justBought ? 'signal-row-flash' : ''}`}>
                {/* Left: signal info */}
                <div className="signal-info">
                  <div className="signal-header-row">
                    <span className="signal-pair">{sig.pair}</span>
                    {sig.signal && (
                      <span className={sig.signal.direction === 'BUY' ? 'signal-buy' : 'signal-sell'}>
                        {sig.signal.direction === 'BUY' ? '📈' : '📉'} {sig.signal.direction}
                      </span>
                    )}
                    {!sig.signal && (
                      <span className="badge badge-info">🔒 hidden</span>
                    )}
                    {sig.status === 'verified' && (
                      <span className={`badge ${sig.isCorrect ? 'badge-success' : 'badge-error'}`}>
                        {sig.isCorrect ? '✓ correct' : '✗ wrong'}
                      </span>
                    )}
                  </div>

                  <div className="signal-meta">
                    <span className="signal-seller">
                      {sig.sellerName}
                      {seller && (
                        <span className="seller-winrate" title="Historical win rate">
                          {' '}({seller.winRate}% win)
                        </span>
                      )}
                    </span>
                    <span className="signal-time">{formatTime(sig.committedAt)}</span>
                  </div>

                  {/* Hash — always visible */}
                  <div className="signal-hash">
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Hash: </span>
                    <code style={{ fontSize: '0.7rem' }}>{sig.commitmentHash.slice(0, 32)}…</code>
                  </div>

                  {/* Revealed signal details */}
                  {sig.signal && sig.status !== 'committed' && (
                    <div className="signal-details">
                      <span>Target: <strong>${sig.signal.targetPrice.toLocaleString()}</strong></span>
                      <span>Confidence: <strong>{sig.signal.confidence}%</strong></span>
                      {sig.actualOutcome != null && (
                        <span>Outcome: <strong>${sig.actualOutcome.toLocaleString()}</strong></span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: price + action */}
                <div className="signal-action">
                  <div className="signal-price">{sig.price} tNight</div>

                  {tab === 'committed' && !isOwnSignal && (
                    bought ? (
                      <span className="badge badge-success">✓ purchased</span>
                    ) : (
                      <button
                        className="btn btn-primary"
                        style={{ padding: '6px 16px', fontSize: '0.8rem' }}
                        onClick={() => handleBuy(sig.id)}
                        disabled={buying}
                      >
                        {buying ? <span className="spinner" /> : '🛒 Buy'}
                      </button>
                    )
                  )}

                  {tab === 'committed' && isOwnSignal && (
                    <button
                      className="btn btn-success"
                      style={{ padding: '6px 16px', fontSize: '0.8rem' }}
                      onClick={() => onReveal(sig.id)}
                      disabled={revealingId === sig.id}
                    >
                      {revealingId === sig.id ? (
                        <>
                          <span className="spinner" style={{ marginRight: '4px' }} />
                          Revealing...
                        </>
                      ) : (
                        '👁️ Reveal'
                      )}
                    </button>
                  )}

                  {tab === 'revealed' && (
                    <span className="badge badge-warning">awaiting outcome</span>
                  )}

                  {tab === 'verified' && sig.isCorrect !== null && (
                    <div className={`outcome-badge ${sig.isCorrect ? 'outcome-correct' : 'outcome-wrong'}`}>
                      {sig.isCorrect ? '+' : '-'}{sig.price} tNight
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Purchase history */}
      {purchases.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
            🧾 Your Purchases ({purchases.length})
          </h4>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {purchases.map((p) => (
              <div
                key={p.signalId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span>{p.signalId.slice(0, 12)}…</span>
                <span>{p.buyerPaid} tNight</span>
                <span>{p.revealed ? '👁️ revealed' : '🔒 pending'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
