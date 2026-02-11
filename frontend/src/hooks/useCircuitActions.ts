// GhostSignal — useCircuitActions hook
// Wraps circuit calls with marketplace state updates.
//
// This hook provides functions that:
//   1. Call the on-chain circuit (commit_signal, reveal_signal, verify_signal)
//   2. Update the marketplace state accordingly
//   3. Handle Lace popup approval flow
//
// For browser users with Lace, the balanceTx call triggers a user approval popup.

import { useCallback, useState } from 'react';
import { commitSignal, revealSignal, verifySignal, registerAgent } from '../services/midnight';
import type { DeployedMarketplaceContract } from '../types/common-types';
import type { FinalizedTxData } from '@midnight-ntwrk/midnight-js-types';

interface UseCircuitActionsOptions {
  contract: DeployedMarketplaceContract | null;
  onRevealSuccess?: (signalId: string) => void;
  onVerifySuccess?: (signalId: string, isCorrect: boolean) => void;
}

interface UseCircuitActionsResult {
  // Actions
  doCommit: () => Promise<FinalizedTxData>;
  doReveal: (signalId: string) => Promise<FinalizedTxData>;
  doVerify: (signalId: string, actualOutcome: number) => Promise<FinalizedTxData>;
  doRegisterAgent: () => Promise<FinalizedTxData>;
  // State
  isCommitting: boolean;
  isRevealing: boolean;
  isVerifying: boolean;
  isRegistering: boolean;
  lastTx: FinalizedTxData | null;
  error: string | null;
}

/**
 * Hook for calling circuits with state management.
 */
export function useCircuitActions({
  contract,
  onRevealSuccess,
  onVerifySuccess,
}: UseCircuitActionsOptions): UseCircuitActionsResult {
  const [isCommitting, setIsCommitting] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [lastTx, setLastTx] = useState<FinalizedTxData | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Call commit_signal circuit.
   * Increments total_commitments and total_stake_locked on-chain.
   */
  const doCommit = useCallback(async (): Promise<FinalizedTxData> => {
    if (!contract) throw new Error('Contract not connected');
    
    setIsCommitting(true);
    setError(null);
    
    try {
      const txData = await commitSignal(contract);
      setLastTx(txData);
      return txData;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Commit failed';
      setError(msg);
      throw err;
    } finally {
      setIsCommitting(false);
    }
  }, [contract]);

  /**
   * Call reveal_signal circuit.
   * Increments total_reveals on-chain.
   * The actual signal data reveal happens in the marketplace hook (off-chain).
   */
  const doReveal = useCallback(async (signalId: string): Promise<FinalizedTxData> => {
    if (!contract) throw new Error('Contract not connected');
    
    setIsRevealing(true);
    setError(null);
    
    try {
      const txData = await revealSignal(contract);
      setLastTx(txData);
      onRevealSuccess?.(signalId);
      return txData;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Reveal failed';
      setError(msg);
      throw err;
    } finally {
      setIsRevealing(false);
    }
  }, [contract, onRevealSuccess]);

  /**
   * Call verify_signal circuit.
   * Increments total_verified on-chain.
   * The correctness calculation happens off-chain based on actual vs target price.
   */
  const doVerify = useCallback(async (
    signalId: string,
    _actualOutcome: number,
  ): Promise<FinalizedTxData> => {
    if (!contract) throw new Error('Contract not connected');
    
    setIsVerifying(true);
    setError(null);
    
    try {
      const txData = await verifySignal(contract);
      setLastTx(txData);
      // Determine if correct (would come from actual signal data)
      // For now, assume success
      onVerifySuccess?.(signalId, true);
      return txData;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verify failed';
      setError(msg);
      throw err;
    } finally {
      setIsVerifying(false);
    }
  }, [contract, onVerifySuccess]);

  /**
   * Call register_agent circuit.
   * Increments active_agents on-chain.
   */
  const doRegisterAgent = useCallback(async (): Promise<FinalizedTxData> => {
    if (!contract) throw new Error('Contract not connected');
    
    setIsRegistering(true);
    setError(null);
    
    try {
      const txData = await registerAgent(contract);
      setLastTx(txData);
      return txData;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setError(msg);
      throw err;
    } finally {
      setIsRegistering(false);
    }
  }, [contract]);

  return {
    doCommit,
    doReveal,
    doVerify,
    doRegisterAgent,
    isCommitting,
    isRevealing,
    isVerifying,
    isRegistering,
    lastTx,
    error,
  };
}
