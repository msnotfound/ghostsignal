// GhostSignal — Main App component
// Live marketplace dashboard for AI agent signal trading
// Connects to the agent API server for real-time data with transaction hashes

import { useState } from 'react';
import { useAgentAPI, ActivityEvent, LeaderboardEntry, RevealedSignal } from './hooks/useAgentAPI';

/** Which marketplace panel is active */
type MarketView = 'live' | 'leaderboard' | 'agents' | 'chain';

function App() {
  const [view, setView] = useState<MarketView>('live');
  
  // Connect to agent API
  const api = useAgentAPI();

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-main">
          <h1>👻 GhostSignal</h1>
          <p className="subtitle">AI Agent Signal Marketplace • Zero-Knowledge Proofs</p>
        </div>
        
        {/* Connection status */}
        <div className="connection-status">
          <span className={`status-dot status-${api.connected ? 'connected' : api.error ? 'error' : 'connecting'}`} />
          <span className="status-text">
            {!api.connected && !api.error && 'Connecting to agents...'}
            {api.connected && `Live • ${api.lastUpdate?.toLocaleTimeString() || ''}`}
            {api.error && `Error: ${api.error}`}
          </span>
        </div>
      </header>

      {/* Live stats bar */}
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-value">{api.stats?.totalSignals || 0}</span>
          <span className="stat-label">Total Signals</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{api.stats?.verifiedSignals || 0}</span>
          <span className="stat-label">Verified</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{api.stats?.activeCommitments || 0}</span>
          <span className="stat-label">Pending</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{api.stats?.agentCount || 0}</span>
          <span className="stat-label">Active Agents</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{(api.stats?.totalVolume || 0).toLocaleString()}</span>
          <span className="stat-label">Volume (tNight)</span>
        </div>
        <div className="stat-item highlight">
          <span className="stat-value">{api.activity.length}</span>
          <span className="stat-label">Events</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="main-nav">
        <button
          className={`nav-btn ${view === 'live' ? 'nav-btn-active' : ''}`}
          onClick={() => setView('live')}
        >
          📊 Live Market
        </button>
        <button
          className={`nav-btn ${view === 'leaderboard' ? 'nav-btn-active' : ''}`}
          onClick={() => setView('leaderboard')}
        >
          🏆 Leaderboard
        </button>
        <button
          className={`nav-btn ${view === 'agents' ? 'nav-btn-active' : ''}`}
          onClick={() => setView('agents')}
        >
          🤖 Agent Activity
        </button>
        <button
          className={`nav-btn ${view === 'chain' ? 'nav-btn-active' : ''}`}
          onClick={() => setView('chain')}
        >
          ⛓️ On-Chain
        </button>
      </nav>

      <main className="app-main">
        {/* Live Market view */}
        {view === 'live' && (
          <div className="dashboard-grid-2col">
            <div className="dashboard-main">
              <LiveSignalFeed signals={api.signals} />
            </div>
            <div className="dashboard-side">
              <RecentActivityFeed activity={api.activity.slice(0, 15)} />
            </div>
          </div>
        )}

        {/* Leaderboard view */}
        {view === 'leaderboard' && (
          <AgentLeaderboard leaderboard={api.leaderboard} />
        )}

        {/* Agent Activity view */}
        {view === 'agents' && (
          <FullActivityFeed activity={api.activity} />
        )}

        {/* On-Chain view */}
        {view === 'chain' && (
          <OnChainExplorer 
            activity={api.activity} 
            lookupTx={api.lookupTx}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <p>GhostSignal • AI Agent Signal Marketplace • Built on Midnight</p>
          <p style={{ fontSize: '12px', opacity: 0.7 }}>
            {api.connected ? '🟢 Connected to agent simulation' : '🔴 Disconnected'}
          </p>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// Live Signal Feed - Shows revealed signals from agents
// ============================================================================

function LiveSignalFeed({ signals }: { signals: RevealedSignal[] }) {
  if (signals.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">📊 Live Signals</h3>
        <div className="empty-state">
          <p>No signals yet. Start the agent simulation to see live trading activity.</p>
          <code>cd agents-ts && npm run start</code>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-title">📊 Live Signals ({signals.length})</h3>
      <div className="signal-grid">
        {signals.map((item) => (
          <div key={item.signal.id} className="signal-card">
            <div className="signal-header">
              <span className={`signal-direction ${item.signal.direction.toLowerCase()}`}>
                {item.signal.direction === 'LONG' ? '📈' : '📉'} {item.signal.direction}
              </span>
              <span className="signal-pair">{item.signal.pair}</span>
              <span className={`signal-confidence conf-${item.signal.confidence}`}>
                {item.signal.confidence}
              </span>
            </div>
            <div className="signal-body">
              <div className="signal-prices">
                <div className="price-item">
                  <span className="price-label">Entry</span>
                  <span className="price-value">${item.signal.entry.toLocaleString()}</span>
                </div>
                <div className="price-item">
                  <span className="price-label">Target</span>
                  <span className="price-value target">${item.signal.target.toLocaleString()}</span>
                </div>
                <div className="price-item">
                  <span className="price-label">Stop</span>
                  <span className="price-value stop">${item.signal.stopLoss.toLocaleString()}</span>
                </div>
              </div>
              <div className="signal-meta">
                <span className="signal-agent">🤖 {item.agent}</span>
                <span className="signal-timeframe">{item.signal.timeframe}</span>
              </div>
              {item.commitment?.txHash && (
                <div className="signal-tx">
                  <span className="tx-label">TX:</span>
                  <code className="tx-hash">{item.commitment.txHash.substring(0, 20)}...</code>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Recent Activity Feed - Shows commit/reveal/verify events
// ============================================================================

function RecentActivityFeed({ activity }: { activity: ActivityEvent[] }) {
  const getIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'generate': return '💡';
      case 'commit': return '🔒';
      case 'reveal': return '👁️';
      case 'verify': return '✅';
      case 'purchase': return '💰';
      default: return '•';
    }
  };

  const getLabel = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'generate': return 'generated signal';
      case 'commit': return 'committed';
      case 'reveal': return 'revealed';
      case 'verify': return 'verified';
      case 'purchase': return 'purchased';
      default: return type;
    }
  };

  return (
    <div className="card">
      <h3 className="card-title">⚡ Recent Activity</h3>
      {activity.length === 0 ? (
        <div className="empty-state">
          <p>No activity yet...</p>
        </div>
      ) : (
        <div className="activity-feed">
          {activity.map((evt) => (
            <div key={evt.id} className={`activity-item type-${evt.type}`}>
              <div className="activity-icon">{getIcon(evt.type)}</div>
              <div className="activity-details">
                <span className="activity-agent">{evt.agent}</span>
                <span className="activity-action">{getLabel(evt.type)}</span>
                {evt.data.signal && (
                  <span className="activity-pair">
                    {evt.data.signal.direction} {evt.data.signal.pair}
                  </span>
                )}
                {evt.data.outcome && (
                  <span className={`activity-outcome outcome-${evt.data.outcome}`}>
                    {evt.data.outcome.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="activity-meta">
                <span className="activity-time">
                  {formatTimeAgo(new Date(evt.timestamp))}
                </span>
                {evt.txHash && (
                  <code className="activity-tx" title={evt.txHash}>
                    {evt.txHash.substring(0, 10)}...
                  </code>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Full Activity Feed - Detailed view of all events
// ============================================================================

function FullActivityFeed({ activity }: { activity: ActivityEvent[] }) {
  return (
    <div className="card full-width">
      <h3 className="card-title">🤖 Full Agent Activity Log ({activity.length} events)</h3>
      <div className="activity-table-container">
        <table className="activity-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>Agent</th>
              <th>Details</th>
              <th>TX Hash</th>
            </tr>
          </thead>
          <tbody>
            {activity.map((evt) => (
              <tr key={evt.id} className={`row-type-${evt.type}`}>
                <td className="col-time">
                  {new Date(evt.timestamp).toLocaleTimeString()}
                </td>
                <td className="col-type">
                  <span className={`type-badge type-${evt.type}`}>
                    {evt.type}
                  </span>
                </td>
                <td className="col-agent">{evt.agent}</td>
                <td className="col-details">
                  {evt.data.signal && (
                    <span>
                      {evt.data.signal.direction} {evt.data.signal.pair} @ ${evt.data.signal.entry}
                    </span>
                  )}
                  {evt.data.commitment && !evt.data.signal && (
                    <code className="hash-preview">
                      {evt.data.commitment.hash.substring(0, 18)}...
                    </code>
                  )}
                  {evt.data.outcome && (
                    <span className={`outcome-${evt.data.outcome}`}>
                      {evt.data.outcome.toUpperCase()}
                    </span>
                  )}
                  {evt.data.seller && evt.data.price && (
                    <span>
                      from {evt.data.seller} for {evt.data.price} tNight
                    </span>
                  )}
                </td>
                <td className="col-tx">
                  {evt.txHash ? (
                    <code className="tx-link" title={evt.txHash}>
                      {evt.txHash.substring(0, 18)}...
                    </code>
                  ) : (
                    <span className="no-tx">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// Agent Leaderboard
// ============================================================================

function AgentLeaderboard({ leaderboard }: { leaderboard: LeaderboardEntry[] }) {
  return (
    <div className="card full-width">
      <h3 className="card-title">🏆 Agent Leaderboard</h3>
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Agent</th>
            <th>Address</th>
            <th>Signals</th>
            <th>Revealed</th>
            <th>Verified</th>
            <th>Success Rate</th>
            <th>Earned</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((agent, idx) => (
            <tr key={agent.name} className={idx < 3 ? 'top-rank' : ''}>
              <td className="col-rank">
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
              </td>
              <td className="col-name">{agent.name}</td>
              <td className="col-address">
                <code title={agent.address}>
                  {agent.address.substring(0, 20)}...
                </code>
              </td>
              <td className="col-num">{agent.stats.signalsCreated}</td>
              <td className="col-num">{agent.stats.signalsRevealed}</td>
              <td className="col-num">{agent.stats.signalsVerified}</td>
              <td className={`col-rate ${agent.stats.successRate >= 60 ? 'rate-good' : agent.stats.successRate >= 40 ? 'rate-ok' : 'rate-bad'}`}>
                {agent.stats.successRate}%
              </td>
              <td className="col-earned">{agent.stats.totalEarned} tNight</td>
              <td className="col-balance">{agent.balance.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// On-Chain Explorer - View transaction details
// ============================================================================

interface TxDetails {
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

function OnChainExplorer({ 
  activity, 
  lookupTx 
}: { 
  activity: ActivityEvent[];
  lookupTx: (hash: string) => Promise<TxDetails | null>;
}) {
  const [selectedTx, setSelectedTx] = useState<string | null>(null);
  const [txDetails, setTxDetails] = useState<TxDetails | null>(null);
  const [loading, setLoading] = useState(false);

  const txEvents = activity.filter(e => e.txHash);

  const handleTxClick = async (hash: string) => {
    setSelectedTx(hash);
    setLoading(true);
    const details = await lookupTx(hash);
    setTxDetails(details);
    setLoading(false);
  };

  return (
    <div className="chain-explorer">
      <div className="card explorer-list">
        <h3 className="card-title">⛓️ Transaction Log ({txEvents.length})</h3>
        <p className="card-subtitle">
          All transactions are verifiable on-chain. Click a TX to view details.
        </p>
        <div className="tx-list">
          {txEvents.map((evt) => (
            <div 
              key={evt.id} 
              className={`tx-item ${selectedTx === evt.txHash ? 'selected' : ''}`}
              onClick={() => evt.txHash && handleTxClick(evt.txHash)}
            >
              <div className="tx-type">
                <span className={`type-badge type-${evt.type}`}>{evt.type}</span>
              </div>
              <div className="tx-info">
                <code className="tx-hash-full">{evt.txHash}</code>
                <span className="tx-agent">{evt.agent}</span>
              </div>
              <div className="tx-time">
                {new Date(evt.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card explorer-details">
        <h3 className="card-title">📋 Transaction Details</h3>
        {!selectedTx && (
          <div className="empty-state">
            <p>Select a transaction to view details</p>
          </div>
        )}
        {loading && (
          <div className="loading-state">
            <p>Loading transaction...</p>
          </div>
        )}
        {txDetails && !loading && (
          <div className="tx-details">
            <div className="detail-row">
              <span className="detail-label">TX Hash</span>
              <code className="detail-value hash">{txDetails.txHash}</code>
            </div>
            <div className="detail-row">
              <span className="detail-label">Type</span>
              <span className={`detail-value type-badge type-${txDetails.type}`}>
                {txDetails.type}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Agent</span>
              <span className="detail-value">{txDetails.agent}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Timestamp</span>
              <span className="detail-value">
                {new Date(txDetails.timestamp).toLocaleString()}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Block #</span>
              <span className="detail-value">{txDetails.block.number}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Block Hash</span>
              <code className="detail-value hash">{txDetails.block.hash}</code>
            </div>
            <div className="detail-section">
              <span className="detail-label">Data</span>
              <pre className="detail-json">
                {JSON.stringify(txDetails.data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default App;
