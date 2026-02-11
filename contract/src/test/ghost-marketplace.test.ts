// GhostSignal — Contract unit tests
// Mirrors: example-counter/contract/src/test/counter.test.ts
//
// The counter.test.ts pattern:
//   1. setNetworkId('undeployed') at module level
//   2. describe() block with it() tests
//   3. Tests cover: deterministic init, initial state, circuit execution
//
// We follow this pattern, testing each GhostMarketplace circuit.

import { GhostMarketplaceSimulator } from './ghost-marketplace-simulator.js';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { describe, it, expect } from 'vitest';

// Required for contract simulation outside a real network
setNetworkId('undeployed');

describe('GhostMarketplace smart contract', () => {
  // Mirrors: "generates initial ledger state deterministically"
  it('generates initial ledger state deterministically', () => {
    const simulator0 = new GhostMarketplaceSimulator();
    const simulator1 = new GhostMarketplaceSimulator();
    expect(simulator0.getLedger()).toEqual(simulator1.getLedger());
  });

  // Mirrors: "properly initializes ledger state and private state"
  it('properly initializes ledger state and private state', () => {
    const simulator = new GhostMarketplaceSimulator();
    const initialLedger = simulator.getLedger();

    // All counters should start at 0 (like round starting at 0n in counter)
    expect(initialLedger.total_commitments).toEqual(0n);
    expect(initialLedger.total_reveals).toEqual(0n);
    expect(initialLedger.total_verified).toEqual(0n);
    expect(initialLedger.active_agents).toEqual(0n);
    expect(initialLedger.total_stake_locked).toEqual(0n);

    // Private state should match initialPrivateState
    const initialPrivate = simulator.getPrivateState();
    expect(initialPrivate.localCommitmentCount).toEqual(0);
    expect(initialPrivate.localRevealCount).toEqual(0);
    expect(initialPrivate.localVerifiedCount).toEqual(0);
    expect(initialPrivate.currentStake).toEqual(0);
    expect(initialPrivate.lastCommitmentHash).toEqual('');
    expect(initialPrivate.lastSalt).toEqual('');
    expect(initialPrivate.lastSignalData).toEqual('');
  });

  // Mirrors: "increments the counter correctly" — but for commit_signal
  it('commits a signal and updates ledger counters', () => {
    const simulator = new GhostMarketplaceSimulator();

    // Commit a signal with stake of 100
    const ledgerAfterCommit = simulator.commitSignal(100n);
    expect(ledgerAfterCommit.total_commitments).toEqual(1n);
    expect(ledgerAfterCommit.total_stake_locked).toEqual(100n);

    // Second commitment with different stake
    const ledgerAfterSecond = simulator.commitSignal(200n);
    expect(ledgerAfterSecond.total_commitments).toEqual(2n);
    expect(ledgerAfterSecond.total_stake_locked).toEqual(300n);
  });

  it('reveals a signal and updates reveal counter', () => {
    const simulator = new GhostMarketplaceSimulator();

    // First commit, then reveal
    simulator.commitSignal(100n);
    const ledgerAfterReveal = simulator.revealSignal();

    expect(ledgerAfterReveal.total_commitments).toEqual(1n);
    expect(ledgerAfterReveal.total_reveals).toEqual(1n);
  });

  it('verifies a signal and updates verified counter', () => {
    const simulator = new GhostMarketplaceSimulator();

    // Commit → Reveal → Verify lifecycle
    simulator.commitSignal(50n);
    simulator.revealSignal();
    const ledgerAfterVerify = simulator.verifySignal();

    expect(ledgerAfterVerify.total_commitments).toEqual(1n);
    expect(ledgerAfterVerify.total_reveals).toEqual(1n);
    expect(ledgerAfterVerify.total_verified).toEqual(1n);
  });

  it('registers agents and tracks count', () => {
    const simulator = new GhostMarketplaceSimulator();

    simulator.registerAgent();
    const ledger1 = simulator.getLedger();
    expect(ledger1.active_agents).toEqual(1n);

    simulator.registerAgent();
    const ledger2 = simulator.getLedger();
    expect(ledger2.active_agents).toEqual(2n);
  });

  it('reads marketplace stats without modifying counters', () => {
    const simulator = new GhostMarketplaceSimulator();

    // Perform some operations first
    simulator.registerAgent();
    simulator.commitSignal(100n);
    simulator.revealSignal();

    // get_marketplace_stats should not change any counter values
    const ledgerBefore = simulator.getLedger();
    simulator.getMarketplaceStats();
    const ledgerAfter = simulator.getLedger();

    expect(ledgerAfter.total_commitments).toEqual(ledgerBefore.total_commitments);
    expect(ledgerAfter.total_reveals).toEqual(ledgerBefore.total_reveals);
    expect(ledgerAfter.active_agents).toEqual(ledgerBefore.active_agents);
  });

  it('handles full commit-reveal-verify lifecycle for multiple signals', () => {
    const simulator = new GhostMarketplaceSimulator();

    // Agent registers
    simulator.registerAgent();

    // Signal 1: commit → reveal → verify
    simulator.commitSignal(100n);
    simulator.revealSignal();
    simulator.verifySignal();

    // Signal 2: commit → reveal (not yet verified)
    simulator.commitSignal(200n);
    simulator.revealSignal();

    // Signal 3: commit only (not yet revealed)
    simulator.commitSignal(50n);

    const finalLedger = simulator.getLedger();
    expect(finalLedger.active_agents).toEqual(1n);
    expect(finalLedger.total_commitments).toEqual(3n);
    expect(finalLedger.total_reveals).toEqual(2n);
    expect(finalLedger.total_verified).toEqual(1n);
    expect(finalLedger.total_stake_locked).toEqual(350n); // 100 + 200 + 50
  });
});
