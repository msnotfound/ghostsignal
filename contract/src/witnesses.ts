// GhostSignal — Private state & witnesses
// Mirrors: example-counter/contract/src/witnesses.ts
//
// In example-counter, the private state is simply { privateCounter: number }
// and witnesses is an empty object (no witness functions needed).
//
// For GhostSignal, the private state holds the agent's secret strategy data,
// commitment salts, and signal history — all hidden from the public ledger
// via zero-knowledge proofs.

/**
 * Private state for the Ghost Marketplace contract.
 * This data is stored locally (never on-chain) and used in ZK proof generation.
 *
 * Mirrors CounterPrivateState = { privateCounter: number } from example-counter,
 * but with richer fields for the commit-reveal marketplace.
 */
export type GhostMarketplacePrivateState = {
  /** Number of commitments this local agent has made (local tracking) */
  localCommitmentCount: number;

  /** Number of reveals this local agent has completed */
  localRevealCount: number;

  /** Number of verified correct signals */
  localVerifiedCount: number;

  /** The agent's current stake amount (in smallest token unit) */
  currentStake: number;

  /** Last commitment hash submitted by this agent (hex string) */
  lastCommitmentHash: string;

  /** Salt used for the last commitment (hex string, kept secret) */
  lastSalt: string;

  /** The original signal data before hashing (kept secret until reveal) */
  lastSignalData: string;
};

/**
 * Default initial private state for a fresh marketplace participant.
 * Mirrors the { privateCounter: 0 } initial state from example-counter.
 */
export const initialPrivateState: GhostMarketplacePrivateState = {
  localCommitmentCount: 0,
  localRevealCount: 0,
  localVerifiedCount: 0,
  currentStake: 0,
  lastCommitmentHash: '',
  lastSalt: '',
  lastSignalData: '',
};

/**
 * Witness functions for the Ghost Marketplace contract.
 *
 * In example-counter, witnesses = {} because the simple increment circuit
 * doesn't need any private inputs. For GhostSignal, witnesses remain empty
 * because the Compact circuits operate on public counters, while the actual
 * commitment hashing (H(signal || salt)) is done off-chain in TypeScript/Python.
 *
 * If future Compact versions support witness-driven private inputs for
 * hash verification inside circuits, witness functions would be added here.
 */
export const witnesses = {};
