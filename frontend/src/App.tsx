// GhostSignal — Main App component
// Replaces the CLI menu from example-counter/counter-cli/src/cli.ts
// with a React-based UI that provides the same workflow:
//   1. Connect/restore wallet → 2. Deploy/join contract → 3. Interact with marketplace

import { useState, useCallback } from 'react';
import WalletSetup from './components/WalletSetup';
import DeployContract from './components/DeployContract';
import SignalCreator from './components/SignalCreator';
import SignalMarketplace from './components/SignalMarketplace';
import ScoreboardTable from './components/ScoreboardTable';
import CommitmentTimeline from './components/CommitmentTimeline';
import VerificationProof from './components/VerificationProof';
import { useMarketplace } from './hooks/useMarketplace';
import { useLedgerState } from './hooks/useLedgerState';
import { revealSignal } from './services/midnight';
import type { WalletState } from './types';
import type { DeployedMarketplaceContract, MarketplaceProviders } from './types/common-types';

/** Application state mirrors the step-by-step CLI flow */
type AppStep = 'wallet' | 'contract' | 'marketplace';

/** Which marketplace panel is active */
type MarketView = 'browse' | 'sell' | 'leaderboard' | 'verify';

function App() {
  const [step, setStep] = useState<AppStep>('wallet');
  const [walletState, setWalletState] = useState<WalletState | null>(null);
  const [providers, setProviders] = useState<MarketplaceProviders | null>(null);
  const [contract, setContract] = useState<DeployedMarketplaceContract | null>(null);
  const [contractAddress, setContractAddress] = useState<string>('');
  const [view, setView] = useState<MarketView>('browse');
  const [revealingId, setRevealingId] = useState<string | null>(null);

  // Shared marketplace state
  const marketplace = useMarketplace();

  // Ledger state from indexer (refresh function used in handleReveal)
  const { refresh: refreshLedger } = useLedgerState({
    providers,
    contractAddress,
    pollInterval: 15000,
  });

  // Current user's seller name (derived from wallet address)
  const sellerName = walletState
    ? `User-${walletState.unshieldedAddress.slice(0, 6)}`
    : 'Anonymous';

  /** Called when wallet is successfully restored or connected */
  const handleWalletReady = (state: WalletState, prov: MarketplaceProviders) => {
    setWalletState(state);
    setProviders(prov);
    setStep('contract');
  };

  /** Called when contract is deployed or joined */
  const handleContractReady = (deployed: DeployedMarketplaceContract, address: string) => {
    setContract(deployed);
    setContractAddress(address);
    setStep('marketplace');
  };

  /** 
   * Handle reveal with on-chain circuit call.
   * 1. Calls reveal_signal() circuit (triggers Lace popup)
   * 2. Updates marketplace state to show revealed signal
   */
  const handleReveal = useCallback(async (signalId: string) => {
    if (!contract) return;
    
    setRevealingId(signalId);
    try {
      // Call the on-chain circuit
      await revealSignal(contract);
      // Update marketplace state
      marketplace.revealSignalById(signalId);
      // Refresh ledger state
      await refreshLedger();
    } catch (err) {
      console.error('[App] Reveal failed:', err);
      // Don't update state on error
    } finally {
      setRevealingId(null);
    }
  }, [contract, marketplace, refreshLedger]);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <h1>👻 GhostSignal</h1>
        <p className="subtitle">Zero-Knowledge Signal Marketplace on Midnight</p>
        <div className="step-indicator">
          <span className={step === 'wallet' ? 'active' : 'completed'}>
            1. Wallet
          </span>
          <span className="separator">→</span>
          <span className={step === 'contract' ? 'active' : step === 'marketplace' ? 'completed' : ''}>
            2. Contract
          </span>
          <span className="separator">→</span>
          <span className={step === 'marketplace' ? 'active' : ''}>
            3. Marketplace
          </span>
        </div>
      </header>

      <main className="app-main">
        {/* Step 1: Wallet Setup */}
        {step === 'wallet' && (
          <WalletSetup onWalletReady={handleWalletReady} />
        )}

        {/* Step 2: Contract Deploy/Join */}
        {step === 'contract' && providers && (
          <DeployContract
            providers={providers}
            onContractReady={handleContractReady}
          />
        )}

        {/* Step 3: Marketplace */}
        {step === 'marketplace' && providers && contract && walletState && (
          <div className="marketplace-dashboard">
            {/* Dashboard header with nav */}
            <div className="dashboard-header">
              <div>
                <h2>📊 Ghost Signal Marketplace</h2>
                <p className="contract-address">
                  Contract: <code>{contractAddress}</code>
                  {' • '}Seller: <strong>{sellerName}</strong>
                </p>
              </div>

              {/* Navigation tabs */}
              <nav className="marketplace-nav">
                <button
                  className={`nav-btn ${view === 'browse' ? 'nav-btn-active' : ''}`}
                  onClick={() => setView('browse')}
                >
                  🛒 Browse & Buy
                </button>
                <button
                  className={`nav-btn ${view === 'sell' ? 'nav-btn-active' : ''}`}
                  onClick={() => setView('sell')}
                >
                  📡 Sell Signal
                </button>
                <button
                  className={`nav-btn ${view === 'leaderboard' ? 'nav-btn-active' : ''}`}
                  onClick={() => setView('leaderboard')}
                >
                  🏆 Leaderboard
                </button>
                <button
                  className={`nav-btn ${view === 'verify' ? 'nav-btn-active' : ''}`}
                  onClick={() => setView('verify')}
                >
                  🔍 Verify
                </button>
              </nav>
            </div>

            {/* Browse & Buy view */}
            {view === 'browse' && (
              <div className="dashboard-grid-2col">
                <div className="dashboard-main">
                  <SignalMarketplace
                    committedSignals={marketplace.committedSignals}
                    revealedSignals={marketplace.revealedSignals}
                    verifiedSignals={marketplace.verifiedSignals}
                    purchases={marketplace.purchases}
                    onPurchase={marketplace.purchaseSignal}
                    onReveal={handleReveal}
                    getSellerByName={marketplace.getSellerByName}
                    currentSeller={sellerName}
                    revealingId={revealingId}
                  />
                </div>
                <div className="dashboard-side">
                  <CommitmentTimeline
                    contract={contract}
                    providers={providers}
                  />
                </div>
              </div>
            )}

            {/* Sell Signal view */}
            {view === 'sell' && (
              <div className="dashboard-grid-2col">
                <div className="dashboard-main">
                  <SignalCreator
                    contract={contract}
                    sellerName={sellerName}
                    onSignalCreated={marketplace.createSignal}
                  />
                </div>
                <div className="dashboard-side">
                  {/* Show the user's own listed signals */}
                  <div className="card">
                    <h3 className="card-title">📋 Your Listed Signals</h3>
                    {marketplace.signals.filter((s) => s.sellerName === sellerName).length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: 20 }}>
                        You haven't listed any signals yet. Create one on the left!
                      </p>
                    ) : (
                      marketplace.signals
                        .filter((s) => s.sellerName === sellerName)
                        .map((s) => (
                          <div
                            key={s.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 0',
                              borderBottom: '1px solid var(--border)',
                              fontSize: '0.8rem',
                            }}
                          >
                            <div>
                              <span className="signal-pair" style={{ marginRight: 8 }}>{s.pair}</span>
                              <code style={{ fontSize: '0.65rem' }}>{s.commitmentHash.slice(0, 16)}…</code>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>{s.price} tNight</span>
                              {s.status === 'committed' ? (
                                <button
                                  className="btn btn-success"
                                  style={{ padding: '3px 10px', fontSize: '0.75rem' }}
                                  onClick={() => handleReveal(s.id)}
                                  disabled={revealingId === s.id}
                                >
                                  {revealingId === s.id ? (
                                    <><span className="spinner" style={{ width: 12, height: 12 }} /></>
                                  ) : (
                                    '👁️ Reveal'
                                  )}
                                </button>
                              ) : (
                                <span className={`badge badge-${s.status === 'verified' ? (s.isCorrect ? 'success' : 'error') : 'warning'}`}>
                                  {s.status}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Leaderboard view */}
            {view === 'leaderboard' && (
              <ScoreboardTable
                sellers={marketplace.sellers}
                marketStats={marketplace.marketStats}
              />
            )}

            {/* Verify view */}
            {view === 'verify' && (
              <div className="dashboard-grid-2col">
                <div className="dashboard-main">
                  <VerificationProof
                    contract={contract}
                    providers={providers}
                    contractAddress={contractAddress}
                  />
                </div>
                <div className="dashboard-side">
                  <CommitmentTimeline
                    contract={contract}
                    providers={providers}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>GhostSignal • Built on Midnight • Zero-Knowledge Proofs</p>
      </footer>
    </div>
  );
}

export default App;
