// GhostSignal — AgentActivityFeed component
// Shows real-time activity stream of AI agents trading signals

import type { MarketplaceSignal, SellerProfile } from '../types';

interface AgentActivityFeedProps {
  signals: MarketplaceSignal[];
  sellers: SellerProfile[];
}

export default function AgentActivityFeed({ signals, sellers }: AgentActivityFeedProps) {
  // Build activity timeline from signals
  const activities = signals
    .map((sig) => ({
      id: sig.id,
      agent: sig.sellerName,
      action: sig.status as 'committed' | 'revealed' | 'verified',
      pair: sig.pair,
      price: sig.price,
      timestamp: new Date(sig.committedAt),
      isCorrect: sig.isCorrect,
      commitment: sig.commitmentHash,
    }))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Agent stats lookup (available for hover tooltips if needed)
  const _agentStats = new Map(sellers.map((s) => [s.name, s]));

  return (
    <div className="agent-activity-container">
      <div className="dashboard-grid-2col">
        {/* Activity Feed */}
        <div className="dashboard-main">
          <div className="card">
            <h3 className="card-title">🤖 Agent Activity Feed</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Real-time stream of agent signal transactions
            </p>

            <div className="activity-timeline">
              {activities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  No agent activity yet
                </div>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="timeline-item">
                    <div className="timeline-marker">
                      {activity.action === 'committed' && '🔒'}
                      {activity.action === 'revealed' && '👁️'}
                      {activity.action === 'verified' && (activity.isCorrect ? '✅' : '❌')}
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span className="agent-name">{activity.agent}</span>
                        <span className={`action-badge action-${activity.action}`}>
                          {activity.action}
                        </span>
                      </div>
                      <div className="timeline-details">
                        <span className="signal-pair">{activity.pair}</span>
                        <span className="signal-price">{activity.price} tNight</span>
                      </div>
                      <div className="timeline-meta">
                        <code className="commitment-preview">
                          {activity.commitment.slice(0, 24)}...
                        </code>
                        <span className="timestamp">
                          {formatRelativeTime(activity.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Agent Directory */}
        <div className="dashboard-side">
          <div className="card">
            <h3 className="card-title">📋 Active Agents</h3>
            <div className="agent-directory">
              {sellers.map((agent) => (
                <div key={agent.id} className="agent-card">
                  <div className="agent-header">
                    <span className="agent-avatar">🤖</span>
                    <div className="agent-info">
                      <span className="agent-name">{agent.name}</span>
                      <span className="agent-pairs">
                        {agent.pairs.join(' • ')}
                      </span>
                    </div>
                  </div>
                  <div className="agent-stats">
                    <div className="agent-stat">
                      <span className="stat-value">{agent.totalSignals}</span>
                      <span className="stat-label">Signals</span>
                    </div>
                    <div className="agent-stat">
                      <span className={`stat-value ${agent.winRate >= 70 ? 'text-success' : agent.winRate >= 50 ? 'text-warning' : 'text-error'}`}>
                        {agent.winRate.toFixed(1)}%
                      </span>
                      <span className="stat-label">Win Rate</span>
                    </div>
                    <div className="agent-stat">
                      <span className="stat-value">{agent.totalEarned}</span>
                      <span className="stat-label">Earned</span>
                    </div>
                  </div>
                  <div className="agent-activity-indicator">
                    {getRecentActivity(agent.name, signals) > 0 ? (
                      <span className="active-badge">
                        🟢 {getRecentActivity(agent.name, signals)} signals today
                      </span>
                    ) : (
                      <span className="inactive-badge">⚪ Inactive</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="card" style={{ marginTop: 16 }}>
            <h3 className="card-title">📊 Activity Summary</h3>
            <div className="summary-stats">
              <div className="summary-item">
                <span className="summary-icon">🔒</span>
                <span className="summary-count">
                  {signals.filter((s) => s.status === 'committed').length}
                </span>
                <span className="summary-label">Pending Reveals</span>
              </div>
              <div className="summary-item">
                <span className="summary-icon">👁️</span>
                <span className="summary-count">
                  {signals.filter((s) => s.status === 'revealed').length}
                </span>
                <span className="summary-label">Awaiting Outcome</span>
              </div>
              <div className="summary-item">
                <span className="summary-icon">✅</span>
                <span className="summary-count">
                  {signals.filter((s) => s.status === 'verified' && s.isCorrect).length}
                </span>
                <span className="summary-label">Correct Today</span>
              </div>
              <div className="summary-item">
                <span className="summary-icon">❌</span>
                <span className="summary-count">
                  {signals.filter((s) => s.status === 'verified' && !s.isCorrect).length}
                </span>
                <span className="summary-label">Incorrect Today</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Format relative time */
function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Get recent activity count for an agent */
function getRecentActivity(agentName: string, signals: MarketplaceSignal[]): number {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return signals.filter(
    (s) => s.sellerName === agentName && new Date(s.committedAt).getTime() > oneDayAgo
  ).length;
}
