// GhostSignal — CommitmentTimeline component
// Visualizes the commit-reveal lifecycle as a timeline.
// Shows committed → revealed → verified states for recent signals.

import { useState, useEffect, useCallback } from 'react';
import { getMarketplaceLedgerState } from '../services/midnight';
import type { DeployedMarketplaceContract, MarketplaceProviders } from '../types/common-types';
import type { MarketplaceStats } from '../types';

interface CommitmentTimelineProps {
  contract: DeployedMarketplaceContract;
  providers: MarketplaceProviders;
}

interface TimelineEvent {
  id: string;
  type: 'committed' | 'revealed' | 'verified';
  label: string;
  timestamp: string;
  details: string;
}

export default function CommitmentTimeline({ contract, providers }: CommitmentTimelineProps) {
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  const refreshStats = useCallback(async () => {
    try {
      const address = contract.deployTxData.public.contractAddress;
      const result = await getMarketplaceLedgerState(providers, address);
      if (result) {
        setStats(result);

        // Build timeline events from aggregate stats
        // In production, this would come from indexer subscriptions
        const newEvents: TimelineEvent[] = [];
        const now = new Date();

        for (let i = 0; i < Math.min(Number(result.totalCommitments), 5); i++) {
          newEvents.push({
            id: `commit-${i}`,
            type: 'committed',
            label: `Signal #${i + 1} Committed`,
            timestamp: new Date(now.getTime() - (5 - i) * 60000).toLocaleTimeString(),
            details: `Stake locked on-chain via ZK proof`,
          });

          if (i < Number(result.totalReveals)) {
            newEvents.push({
              id: `reveal-${i}`,
              type: 'revealed',
              label: `Signal #${i + 1} Revealed`,
              timestamp: new Date(now.getTime() - (5 - i) * 60000 + 30000).toLocaleTimeString(),
              details: `Preimage verified: H(signal||salt) matches commitment`,
            });
          }

          if (i < Number(result.totalVerified)) {
            newEvents.push({
              id: `verify-${i}`,
              type: 'verified',
              label: `Signal #${i + 1} Verified ✓`,
              timestamp: new Date(now.getTime() - (5 - i) * 60000 + 60000).toLocaleTimeString(),
              details: `Signal accuracy confirmed against market outcome`,
            });
          }
        }

        setEvents(newEvents.reverse());
      }
    } catch (err) {
      console.error('[CommitmentTimeline] Failed to fetch stats:', err);
    }
  }, [contract, providers]);

  useEffect(() => {
    void refreshStats();
    const interval = setInterval(() => void refreshStats(), 15_000);
    return () => clearInterval(interval);
  }, [refreshStats]);

  return (
    <div className="card">
      <h3 className="card-title">⏱️ Commitment Timeline</h3>

      {/* Aggregate stats bar */}
      {stats && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, fontSize: '0.8rem' }}>
          <span className="badge badge-info">{Number(stats.totalCommitments)} committed</span>
          <span className="badge badge-warning">{Number(stats.totalReveals)} revealed</span>
          <span className="badge badge-success">{Number(stats.totalVerified)} verified</span>
        </div>
      )}

      {/* Timeline */}
      {events.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: 24 }}>
          No signals yet. Commit your first signal to start the timeline.
        </div>
      ) : (
        <div className="timeline">
          {events.map((event) => (
            <div key={event.id} className={`timeline-item ${event.type}`}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{event.label}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {event.timestamp}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                {event.details}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
