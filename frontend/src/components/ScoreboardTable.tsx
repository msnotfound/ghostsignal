// GhostSignal — ScoreboardTable component
// Displays a trustless scoreboard of seller performance with real track records.

import type { SellerProfile } from '../types';

interface ScoreboardTableProps {
  sellers: SellerProfile[];
  marketStats: {
    totalSignals: number;
    totalVerified: number;
    totalCorrect: number;
    overallWinRate: string;
    totalVolume: number;
    activeSellers: number;
  };
}

export default function ScoreboardTable({ sellers, marketStats }: ScoreboardTableProps) {
  // Sort sellers by win rate descending
  const ranked = [...sellers].sort((a, b) => b.winRate - a.winRate);

  return (
    <div className="card">
      <h3 className="card-title">🏆 Seller Leaderboard</h3>

      {/* Marketplace summary */}
      <div className="market-stats-bar">
        <div className="market-stat">
          <span className="market-stat-value">{marketStats.activeSellers}</span>
          <span className="market-stat-label">Sellers</span>
        </div>
        <div className="market-stat">
          <span className="market-stat-value">{marketStats.totalSignals}</span>
          <span className="market-stat-label">Signals</span>
        </div>
        <div className="market-stat">
          <span className="market-stat-value">{marketStats.overallWinRate}%</span>
          <span className="market-stat-label">Avg Win Rate</span>
        </div>
        <div className="market-stat">
          <span className="market-stat-value">{marketStats.totalVolume.toLocaleString()}</span>
          <span className="market-stat-label">Volume (tNight)</span>
        </div>
      </div>

      {ranked.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: 24 }}>
          No sellers registered yet.
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Seller</th>
              <th>Pairs</th>
              <th>Signals</th>
              <th>Correct</th>
              <th>Win Rate</th>
              <th>Earned</th>
              <th>Since</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((seller, idx) => {
              const rank = idx + 1;
              const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
              return (
                <tr key={seller.id}>
                  <td style={{ fontWeight: 700, color: 'var(--accent-ghost)' }}>
                    {medal || rank}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{seller.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Avg confidence: {seller.avgConfidence}%
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {seller.pairs.map((p) => (
                        <span key={p} className="badge badge-info" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{seller.totalSignals}</td>
                  <td style={{ color: 'var(--accent-green)' }}>{seller.correctSignals}</td>
                  <td>
                    <div className="winrate-cell">
                      <div
                        className="winrate-bar"
                        style={{ width: `${seller.winRate}%` }}
                      />
                      <span
                        className="winrate-text"
                        style={{
                          color: seller.winRate >= 70 ? 'var(--accent-green)' : seller.winRate >= 50 ? 'var(--accent-orange)' : 'var(--accent-red)',
                        }}
                      >
                        {seller.winRate}%
                      </span>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--accent-green)' }}>
                    {seller.totalEarned.toLocaleString()}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(seller.activeSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
