// GhostSignal — WalletSetup component
// Replaces: example-counter CLI wallet menu (readline prompts in cli.ts)
//
// Supports TWO wallet modes:
//   1. LACE WALLET (recommended for users)
//      - Connects to Lace browser extension
//      - User approves transactions via popup
//      - More secure: keys never leave extension
//
//   2. MANUAL SEED (for CLI/agent/testing)
//      - Enter seed or generate new
//      - Build wallet, wait for sync, wait for funds
//
// The CLI flow was:
//   1. Enter seed or generate new → 2. Build wallet → 3. Wait for sync → 4. Wait for funds
//
// This React component provides both flows with a visual UI.

import { useState, useCallback, useEffect } from 'react';
import { StandaloneConfig } from '../services/config';
import { buildWalletAndWaitForFunds, generateNewSeed, formatBalance } from '../services/wallet';
import { configureProviders } from '../services/midnight';
import { isLaceAvailable, connectLace, createLaceProviders, type LaceWalletState } from '../services/lace';
import type { WalletState, MarketplaceProviders } from '../types';

interface WalletSetupProps {
  onWalletReady: (walletState: WalletState, providers: MarketplaceProviders) => void;
}

type WalletStatus = 'idle' | 'building' | 'syncing' | 'waiting-funds' | 'connecting-lace' | 'ready' | 'error';

export default function WalletSetup({ onWalletReady }: WalletSetupProps) {
  const [seed, setSeed] = useState('');
  const [status, setStatus] = useState<WalletStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [generatedSeed, setGeneratedSeed] = useState('');
  const [laceAvailable, setLaceAvailable] = useState(false);
  const [showManualMode, setShowManualMode] = useState(false);

  // Check if Lace is available on mount
  useEffect(() => {
    const checkLace = () => setLaceAvailable(isLaceAvailable());
    checkLace();
    // Poll in case Lace loads after page
    const interval = setInterval(checkLace, 1000);
    return () => clearInterval(interval);
  }, []);

  /** Status callback from wallet service (replaces CLI spinners) */
  const onStatusUpdate = useCallback((message: string) => {
    setStatusMessage(message);
    if (message.includes('Syncing')) setStatus('syncing');
    else if (message.includes('Waiting for incoming')) setStatus('waiting-funds');
    else if (message.includes('ready')) setStatus('ready');
  }, []);

  /** Connect using Lace wallet (RECOMMENDED) */
  const handleLaceConnect = useCallback(async () => {
    setError('');
    setStatus('connecting-lace');
    setStatusMessage('Connecting to Lace wallet...');

    try {
      // Connect to Lace (triggers permission popup)
      const laceState: LaceWalletState = await connectLace('undeployed');
      setStatusMessage('Building providers...');

      // Create providers from Lace connection
      const providers = await createLaceProviders(laceState);

      const walletState: WalletState = {
        mode: 'lace',
        seed: null, // No seed in Lace mode
        isSynced: true,
        balance: 0n, // Lace manages balances internally
        dustBalance: laceState.dustBalance,
        unshieldedAddress: laceState.unshieldedAddress,
        shieldedAddress: laceState.shieldedAddress,
        hasFunds: laceState.dustBalance > 0n,
      };

      setStatus('ready');
      setStatusMessage('Lace wallet connected!');
      onWalletReady(walletState, providers);
    } catch (err) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : 'Failed to connect Lace wallet';
      if (msg.includes('LACE_NOT_FOUND')) {
        setError('Lace wallet not detected. Please install the Lace browser extension.');
      } else {
        setError(msg);
      }
      setStatusMessage('');
    }
  }, [onWalletReady]);

  /** Restore wallet from user-provided seed (MANUAL MODE) */
  const handleRestore = useCallback(async () => {
    const targetSeed = seed.trim();
    if (!targetSeed) {
      setError('Please enter a wallet seed (hex string)');
      return;
    }

    setError('');
    setStatus('building');
    setStatusMessage('Building wallet...');

    try {
      const config = new StandaloneConfig();
      const ctx = await buildWalletAndWaitForFunds(config, targetSeed, onStatusUpdate);

      // Configure providers (mirrors configureProviders() call in CLI)
      setStatusMessage('Configuring providers...');
      const providers = await configureProviders(ctx, config);

      const walletState: WalletState = {
        mode: 'manual',
        seed: targetSeed,
        isSynced: true,
        balance: ctx.balance,
        dustBalance: 0n,
        unshieldedAddress: ctx.unshieldedAddress,
        shieldedAddress: ctx.shieldedAddress,
        hasFunds: ctx.balance > 0n,
      };

      setStatus('ready');
      setStatusMessage(`Wallet ready! Balance: ${formatBalance(ctx.balance)} tNight`);
      onWalletReady(walletState, providers);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to build wallet');
      setStatusMessage('');
    }
  }, [seed, onStatusUpdate, onWalletReady]);

  /** Generate a fresh random seed and show it to the user */
  const handleGenerate = useCallback(() => {
    const newSeed = generateNewSeed();
    setGeneratedSeed(newSeed);
    setSeed(newSeed);
    setError('');
  }, []);

  const isWorking = status === 'building' || status === 'syncing' || status === 'waiting-funds' || status === 'connecting-lace';

  return (
    <div className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
      <h2 className="card-title">🔐 Wallet Setup</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: '0.9rem' }}>
        Connect your wallet to interact with the GhostSignal marketplace.
      </p>

      {/* Lace Wallet Section (Primary) */}
      <div style={{
        background: laceAvailable ? 'rgba(170, 136, 255, 0.1)' : 'var(--bg-secondary)',
        border: `1px solid ${laceAvailable ? 'var(--accent-ghost)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: 16,
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: '1.5rem' }}>🌙</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Lace Wallet</h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Recommended — secure browser wallet
            </p>
          </div>
          {laceAvailable && (
            <span className="badge badge-success" style={{ marginLeft: 'auto' }}>✓ Detected</span>
          )}
        </div>

        {laceAvailable ? (
          <button
            className="btn btn-primary"
            onClick={handleLaceConnect}
            disabled={isWorking}
            style={{ width: '100%' }}
          >
            {status === 'connecting-lace' ? (
              <>
                <span className="spinner" /> Connecting...
              </>
            ) : (
              '🔗 Connect Lace Wallet'
            )}
          </button>
        ) : (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <p style={{ marginBottom: 8 }}>
              Lace wallet not detected. Install it from{' '}
              <a
                href="https://www.lace.io/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent-blue)' }}
              >
                lace.io
              </a>
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Or use manual seed mode below for testing.
            </p>
          </div>
        )}
      </div>

      {/* Manual Seed Toggle */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <button
          onClick={() => setShowManualMode(!showManualMode)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '0.8rem',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          {showManualMode ? '▲ Hide manual mode' : '▼ Use manual seed (for testing/CLI)'}
        </button>
      </div>

      {/* Manual Seed Section */}
      {showManualMode && (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 16,
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '0.9rem' }}>🔑 Manual Seed Mode</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            For testing or agent use. Requires a funded wallet seed.
          </p>

          {/* Seed input */}
          <div className="form-group">
            <label htmlFor="seed-input">Wallet Seed (hex)</label>
            <input
              id="seed-input"
              type="text"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="Enter your hex-encoded wallet seed..."
              disabled={isWorking}
            />
          </div>

          {/* Generated seed display */}
          {generatedSeed && (
            <div
              style={{
                background: 'rgba(255, 136, 68, 0.1)',
                border: '1px solid var(--accent-orange)',
                borderRadius: 'var(--radius)',
                padding: 12,
                marginBottom: 16,
              }}
            >
              <p style={{ fontSize: '0.8rem', color: 'var(--accent-orange)', marginBottom: 4 }}>
                ⚠️ Save this seed! It cannot be recovered.
              </p>
              <code style={{ fontSize: '0.7rem', wordBreak: 'break-all' }}>{generatedSeed}</code>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={handleRestore}
              disabled={isWorking}
              style={{ flex: 1 }}
            >
              {status === 'building' || status === 'syncing' || status === 'waiting-funds' ? (
                <>
                  <span className="spinner" /> {statusMessage || 'Working...'}
                </>
              ) : (
                '🔑 Restore'
              )}
            </button>

            <button
              className="btn"
              onClick={handleGenerate}
              disabled={isWorking}
            >
              🎲 Generate
            </button>
          </div>
        </div>
      )}

      {/* Status display */}
      {statusMessage && status !== 'error' && (
        <div className={`status ${status === 'ready' ? 'status-success' : 'status-syncing'}`} style={{ marginTop: 16 }}>
          {status !== 'ready' && <span className="spinner" />}
          {status === 'ready' && '✓'}
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="status status-error" style={{ marginTop: 16 }}>
          <span>✗ {error}</span>
        </div>
      )}
    </div>
  );
}
