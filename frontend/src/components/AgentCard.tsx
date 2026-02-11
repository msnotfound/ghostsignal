// GhostSignal — AgentCard component
// Displays an AI agent's on-chain profile and credibility metrics.
//
// Shows:
//   ✅ Verified win rate (from on-chain ledger state)
//   💰 Current stake at risk
//   🔒 Latest commitment hash
//   📊 Last 10 signals with verification status
//   🛒 Buy signal button

import { useState, useEffect, useCallback } from 'react';
import { commitSignal, revealSignal, getMarketplaceLedgerState } from '../services/midnight';
import type { DeployedMarketplaceContract, MarketplaceProviders } from '../types/common-types';
import type { WalletState, MarketplaceStats, SignalCommitment } from '../types';
import { formatBalance } from '../services/wallet';

interface AgentCardProps {
  contract: DeployedMarketplaceContract;
  providers: MarketplaceProviders;
  walletState: WalletState;
}

export default function AgentCard({ contract, providers, walletState }: AgentCardProps) {
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [stakeInput, setStakeInput] = useState('100');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [commitments, setCommitments] = useState<SignalCommitment[]>([]);
  const [lastTxId, setLastTxId] = useState('');
  const [error, setError] = useState('');

  /** Fetch marketplace stats from ledger (mirrors displayCounterValue in api.ts) */
  const refreshStats = useCallback(async () => {
    try {
      const address = contract.deployTxData.public.contractAddress;
      const result = await getMarketplaceLedgerState(providers, address);
      if (result) setStats(result);
    } catch (err) {
      console.error('[AgentCard] Failed to fetch stats:', err);
    }
  }, [contract, providers]);

  useEffect(() => {
    void refreshStats();
    // Poll every 15 seconds for ledger updates
    const interval = setInterval(() => void refreshStats(), 15_000);
    return () => clearInterval(interval);
  }, [refreshStats]);

  /** Commit a new signal (calls commit_signal circuit) */
  const handleCommit = useCallback(async () => {
    const stake = BigInt(parseInt(stakeInput, 10) || 0);
    if (stake <= 0n) {
      setError('Stake must be greater than 0');
      return;
    }

    setError('');
    setIsCommitting(true);
    try {
      // Generate commitment hash off-chain (H(signal || salt))
      const signal = JSON.stringify({
        direction: Math.random() > 0.5 ? 'BUY' : 'SELL',
        pair: 'BTC/USD',
        timestamp: new Date().toISOString(),
      });
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const payload = signal + salt;
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      // Call the on-chain commit_signal circuit (no parameters per contract spec)
      const txData = await commitSignal(contract);
      setLastTxId(txData.txId);

      // Track locally
      setCommitments((prev) => [
        {
          commitmentId: stats?.totalCommitments ?? 0n,
          commitmentHash: hashHex,
          stakeAmount: stake,
          committedAt: new Date().toISOString(),
          isRevealed: false,
          isVerified: false,
        },
        ...prev.slice(0, 9), // Keep last 10
      ]);

      await refreshStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commit failed');
    } finally {
      setIsCommitting(false);
    }
  }, [contract, stakeInput, stats, refreshStats]);

  /** Reveal last committed signal (calls reveal_signal circuit) */
  const handleReveal = useCallback(async () => {
    setError('');
    setIsRevealing(true);
    try {
      const txData = await revealSignal(contract);
      setLastTxId(txData.txId);

      // Mark latest unrevealed commitment as revealed
      setCommitments((prev) => {
        const copy = [...prev];
        const idx = copy.findIndex((c) => !c.isRevealed);
        if (idx >= 0) copy[idx] = { ...copy[idx], isRevealed: true };
        return copy;
      });

      await refreshStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reveal failed');
    } finally {
      setIsRevealing(false);
    }
  }, [contract, refreshStats]);

  // Compute win rate
  const winRate =
    stats && stats.totalReveals > 0n
      ? Number((stats.totalVerified * 100n) / stats.totalReveals)
      : 0;

  return (
    <div className="card">
      <h3 className="card-title">👻 Agent Profile</h3>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            ✅ Win Rate
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-green)' }}>
            {winRate}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            💰 Stake Locked
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-orange)' }}>
            {stats ? formatBalance(stats.totalStakeLocked) : '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            📝 Commitments
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>
            {stats ? Number(stats.totalCommitments) : '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            👁️ Reveals
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>
            {stats ? Number(stats.totalReveals) : '—'}
          </div>
        </div>
      </div>

      {/* Wallet info */}
      <div style={{ marginBottom: 16, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        <div>Balance: <strong>{formatBalance(walletState.balance)} tNight</strong></div>
        <div style={{ wordBreak: 'break-all' }}>
          Address: <code style={{ fontSize: '0.7rem' }}>{walletState.unshieldedAddress}</code>
        </div>
      </div>

      {/* Commit signal */}
      <div style={{ marginBottom: 16 }}>
        <div className="form-group">
          <label htmlFor="stake-input">Stake Amount (tNight)</label>
          <input
            id="stake-input"
            type="number"
            value={stakeInput}
            onChange={(e) => setStakeInput(e.target.value)}
            min="1"
            disabled={isCommitting || isRevealing}
          />
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={handleCommit} disabled={isCommitting || isRevealing}>
            {isCommitting ? <><span className="spinner" /> Committing...</> : '🔒 Commit Signal'}
          </button>
          <button
            className="btn btn-success"
            onClick={handleReveal}
            disabled={isRevealing || isCommitting || commitments.length === 0}
          >
            {isRevealing ? <><span className="spinner" /> Revealing...</> : '👁️ Reveal Signal'}
          </button>
        </div>
      </div>

      {/* Recent signals */}
      {commitments.length > 0 && (
        <div>
          <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
            📊 Recent Signals
          </h4>
          {commitments.map((c, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 0',
                borderBottom: '1px solid var(--border)',
                fontSize: '0.8rem',
              }}
            >
              <span className="hash" style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.commitmentHash.slice(0, 16)}...
              </span>
              <span>{formatBalance(c.stakeAmount)}</span>
              <span>
                {c.isVerified ? (
                  <span className="badge badge-success">verified</span>
                ) : c.isRevealed ? (
                  <span className="badge badge-warning">revealed</span>
                ) : (
                  <span className="badge badge-info">committed</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Last tx */}
      {lastTxId && (
        <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Last tx: <code>{lastTxId}</code>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="status status-error" style={{ marginTop: 12 }}>
          <span>✗ {error}</span>
        </div>
      )}
    </div>
  );
}
