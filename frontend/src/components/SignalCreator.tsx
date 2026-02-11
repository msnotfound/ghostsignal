// GhostSignal — SignalCreator component
// Form for a browser user to create and sell a trading signal.
//
// Flow:
//   1. User fills in pair, direction, target price, confidence, price
//   2. Clicks "Commit Signal"
//   3. SHA-256(signal || salt) is computed, salt is saved to localStorage
//   4. commit_signal() circuit is called on-chain (triggers Lace popup)
//   5. Signal is listed in the marketplace with hash visible, data hidden
//   6. After delay, user clicks "Reveal" to publish the signal data

import { useState, useCallback } from 'react';
import { commitSignal } from '../services/midnight';
import { createCommitmentHash } from '../utils/verification';
import type { DeployedMarketplaceContract } from '../types/common-types';

// Local storage key for saving commitment salts (needed for reveal)
const COMMITMENT_STORAGE_KEY = 'ghostsignal_commitments';

interface StoredCommitment {
  signalId: string;
  salt: string;
  signal: {
    pair: string;
    direction: 'BUY' | 'SELL';
    targetPrice: number;
    confidence: number;
  };
  price: number;
  committedAt: string;
}

/** Save a commitment's salt to localStorage for later reveal */
const saveCommitmentSalt = (commitment: StoredCommitment) => {
  const existing = localStorage.getItem(COMMITMENT_STORAGE_KEY);
  const commitments: StoredCommitment[] = existing ? JSON.parse(existing) : [];
  commitments.push(commitment);
  localStorage.setItem(COMMITMENT_STORAGE_KEY, JSON.stringify(commitments));
};

/** Get all stored commitments for the reveal flow */
export const getStoredCommitments = (): StoredCommitment[] => {
  const stored = localStorage.getItem(COMMITMENT_STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

interface SignalCreatorProps {
  contract: DeployedMarketplaceContract;
  sellerName: string;
  onSignalCreated: (params: {
    sellerName: string;
    pair: string;
    direction: 'BUY' | 'SELL';
    targetPrice: number;
    confidence: number;
    price: number;
    commitmentHash: string;
    salt: string;
  }) => Promise<unknown>;
}

const PAIRS = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'ADA/USD'];

export default function SignalCreator({ contract, sellerName, onSignalCreated }: SignalCreatorProps) {
  const [pair, setPair] = useState('BTC/USD');
  const [direction, setDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [targetPrice, setTargetPrice] = useState('');
  const [confidence, setConfidence] = useState('75');
  const [price, setPrice] = useState('100');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastHash, setLastHash] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = useCallback(async () => {
    const tp = parseFloat(targetPrice);
    const conf = parseInt(confidence, 10);
    const prc = parseInt(price, 10);

    if (!tp || tp <= 0) { setError('Enter a valid target price'); return; }
    if (conf < 1 || conf > 100) { setError('Confidence must be 1–100'); return; }
    if (prc < 1) { setError('Price must be at least 1 tNight'); return; }

    setError('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      // 1. Build the signal data and create commitment hash with salt
      const signalData = {
        pair,
        direction,
        targetPrice: tp,
        confidence: conf,
        timestamp: new Date().toISOString(),
      };
      
      const { hash: commitmentHash, salt } = await createCommitmentHash(signalData);
      const signalId = `sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      console.log('[SignalCreator] Commitment hash:', commitmentHash);
      console.log('[SignalCreator] Salt (saved locally):', salt.slice(0, 16) + '...');

      // 2. Save the salt to localStorage (needed for reveal later)
      saveCommitmentSalt({
        signalId,
        salt,
        signal: { pair, direction, targetPrice: tp, confidence: conf },
        price: prc,
        committedAt: new Date().toISOString(),
      });

      // 3. Call the on-chain commit_signal circuit (triggers Lace popup if using Lace)
      //    This increments total_commitments and total_stake_locked on the ledger
      const txData = await commitSignal(contract);
      console.log('[SignalCreator] On-chain tx:', txData.txId);

      // 4. Add to marketplace listing via the hook
      await onSignalCreated({
        sellerName,
        pair,
        direction,
        targetPrice: tp,
        confidence: conf,
        price: prc,
        commitmentHash,
        salt,
      });

      setLastHash(commitmentHash);
      setSuccessMsg(`Signal committed! Tx: ${txData.txId.slice(0, 16)}...`);
      setTargetPrice('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to commit signal';
      console.error('[SignalCreator] Error:', err);
      // Check for user rejection
      if (msg.includes('rejected') || msg.includes('cancelled') || msg.includes('denied')) {
        setError('Transaction cancelled by user');
      } else {
        setError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [contract, sellerName, pair, direction, targetPrice, confidence, price, onSignalCreated]);

  return (
    <div className="card signal-creator">
      <h3 className="card-title">📡 Create & Sell Signal</h3>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
        Commit a trading signal to the marketplace. Your strategy stays private — only the hash is published.
      </p>

      {/* Pair selector */}
      <div className="form-group">
        <label>Trading Pair</label>
        <div className="pair-selector">
          {PAIRS.map((p) => (
            <button
              key={p}
              className={`pair-chip ${pair === p ? 'pair-chip-active' : ''}`}
              onClick={() => setPair(p)}
              disabled={isSubmitting}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Direction toggle */}
      <div className="form-group">
        <label>Direction</label>
        <div className="direction-toggle">
          <button
            className={`direction-btn ${direction === 'BUY' ? 'direction-buy-active' : ''}`}
            onClick={() => setDirection('BUY')}
            disabled={isSubmitting}
          >
            📈 BUY
          </button>
          <button
            className={`direction-btn ${direction === 'SELL' ? 'direction-sell-active' : ''}`}
            onClick={() => setDirection('SELL')}
            disabled={isSubmitting}
          >
            📉 SELL
          </button>
        </div>
      </div>

      {/* Target price */}
      <div className="form-group">
        <label htmlFor="target-price">Target Price (USD)</label>
        <input
          id="target-price"
          type="number"
          value={targetPrice}
          onChange={(e) => setTargetPrice(e.target.value)}
          placeholder={pair === 'BTC/USD' ? '68000' : pair === 'ETH/USD' ? '3500' : '150'}
          disabled={isSubmitting}
          step="0.01"
        />
      </div>

      {/* Confidence + Price row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label htmlFor="signal-confidence">Confidence (%)</label>
          <input
            id="signal-confidence"
            type="number"
            value={confidence}
            onChange={(e) => setConfidence(e.target.value)}
            min="1"
            max="100"
            disabled={isSubmitting}
          />
        </div>
        <div className="form-group">
          <label htmlFor="signal-price">Price (tNight)</label>
          <input
            id="signal-price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            min="1"
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Submit */}
      <button
        className="btn btn-primary"
        style={{ width: '100%', marginTop: 8 }}
        onClick={handleSubmit}
        disabled={isSubmitting || !targetPrice}
      >
        {isSubmitting ? (
          <><span className="spinner" /> Committing on-chain…</>
        ) : (
          '🔒 Commit Signal to Marketplace'
        )}
      </button>

      {/* Last committed hash */}
      {lastHash && (
        <div className="commitment-receipt">
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-green)', marginBottom: 4 }}>
            ✓ Signal committed
          </div>
          <code style={{ fontSize: '0.7rem', wordBreak: 'break-all' }}>{lastHash}</code>
        </div>
      )}

      {/* Success */}
      {successMsg && !lastHash && (
        <div className="status status-success" style={{ marginTop: 12 }}>✓ {successMsg}</div>
      )}

      {/* Error */}
      {error && (
        <div className="status status-error" style={{ marginTop: 12 }}>✗ {error}</div>
      )}
    </div>
  );
}
