// GhostSignal — useCommitments hook
// Tracks local commitment state for the commit-reveal lifecycle.

import { useState, useCallback } from 'react';
import type { SignalCommitment, TradingSignal } from '../types';

export function useCommitments() {
  const [commitments, setCommitments] = useState<SignalCommitment[]>([]);
  const [pendingSignal, setPendingSignal] = useState<TradingSignal | null>(null);
  const [pendingSalt, setPendingSalt] = useState<string>('');

  /**
   * Create a commitment hash for a signal.
   * Uses Web Crypto API: H(JSON(signal) || salt) = SHA-256 commitment.
   */
  const createCommitment = useCallback(async (signal: TradingSignal): Promise<{ hash: string; salt: string }> => {
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const payload = JSON.stringify(signal, Object.keys(signal).sort()) + salt;
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    setPendingSignal(signal);
    setPendingSalt(salt);

    return { hash, salt };
  }, []);

  /** Record a commitment after on-chain tx succeeds */
  const recordCommitment = useCallback(
    (commitmentId: bigint, commitmentHash: string, stakeAmount: bigint) => {
      const commitment: SignalCommitment = {
        commitmentId,
        commitmentHash,
        stakeAmount,
        committedAt: new Date().toISOString(),
        isRevealed: false,
        isVerified: false,
      };
      setCommitments((prev) => [commitment, ...prev]);
    },
    [],
  );

  /** Mark a commitment as revealed */
  const markRevealed = useCallback((commitmentId: bigint) => {
    setCommitments((prev) =>
      prev.map((c) => (c.commitmentId === commitmentId ? { ...c, isRevealed: true } : c)),
    );
  }, []);

  /** Mark a commitment as verified */
  const markVerified = useCallback((commitmentId: bigint) => {
    setCommitments((prev) =>
      prev.map((c) => (c.commitmentId === commitmentId ? { ...c, isVerified: true } : c)),
    );
  }, []);

  /** Clear all local commitments */
  const clearCommitments = useCallback(() => {
    setCommitments([]);
    setPendingSignal(null);
    setPendingSalt('');
  }, []);

  return {
    commitments,
    pendingSignal,
    pendingSalt,
    createCommitment,
    recordCommitment,
    markRevealed,
    markVerified,
    clearCommitments,
  };
}
