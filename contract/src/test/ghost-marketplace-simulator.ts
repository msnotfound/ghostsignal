// GhostSignal — Contract simulator for unit testing
// Mirrors: example-counter/contract/src/test/counter-simulator.ts
//
// The CounterSimulator pattern:
//   1. Instantiates Contract<PrivateState>(witnesses)
//   2. Creates initial state via contract.initialState(createConstructorContext(...))
//   3. Provides getLedger(), getPrivateState(), and circuit-calling methods
//   4. Each circuit call updates circuitContext in place
//
// We follow this pattern exactly, adding methods for each GhostMarketplace circuit.

import {
  type CircuitContext,
  sampleContractAddress,
  createConstructorContext,
  createCircuitContext,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, type Ledger, ledger } from '../managed/ghost-marketplace/contract/index.js';
import { type GhostMarketplacePrivateState, initialPrivateState, witnesses } from '../witnesses.js';

/**
 * Simulator for the GhostMarketplace contract.
 * Used in unit tests to exercise circuits without deploying to a real network.
 *
 * Mirrors CounterSimulator from example-counter exactly:
 *   - constructor() sets up contract + initial context
 *   - getLedger() reads public ledger state
 *   - getPrivateState() reads private state
 *   - circuit methods (commitSignal, revealSignal, etc.) advance state
 */
export class GhostMarketplaceSimulator {
  readonly contract: Contract<GhostMarketplacePrivateState>;
  circuitContext: CircuitContext<GhostMarketplacePrivateState>;

  constructor() {
    // Instantiate the contract with witness functions (mirrors: new Contract<CounterPrivateState>(witnesses))
    this.contract = new Contract<GhostMarketplacePrivateState>(witnesses);

    // Create the initial state (mirrors: contract.initialState(createConstructorContext({ privateCounter: 0 }, "0"...)))
    const { currentPrivateState, currentContractState, currentZswapLocalState } = this.contract.initialState(
      createConstructorContext(initialPrivateState, '0'.repeat(64)),
    );

    // Build the circuit context for subsequent circuit calls
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      currentZswapLocalState,
      currentContractState,
      currentPrivateState,
    );
  }

  /**
   * Read the current public ledger state.
   * Mirrors: CounterSimulator.getLedger()
   */
  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  /**
   * Read the current private state.
   * Mirrors: CounterSimulator.getPrivateState()
   */
  public getPrivateState(): GhostMarketplacePrivateState {
    return this.circuitContext.currentPrivateState;
  }

  /**
   * Submit a signal commitment with a stake amount.
   * Mirrors: CounterSimulator.increment() — calls an impure circuit and updates context.
   *
   * @param stakeAmount - The amount to stake on this signal commitment
   */
  public commitSignal(stakeAmount: bigint): Ledger {
    this.circuitContext = this.contract.impureCircuits.commit_signal(this.circuitContext, stakeAmount).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  /**
   * Reveal a previously committed signal.
   * Verifies the preimage matches the commitment hash.
   */
  public revealSignal(): Ledger {
    this.circuitContext = this.contract.impureCircuits.reveal_signal(this.circuitContext).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  /**
   * Verify a revealed signal against market outcome.
   * Updates the verified counter for agent scoring.
   */
  public verifySignal(): Ledger {
    this.circuitContext = this.contract.impureCircuits.verify_signal(this.circuitContext).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  /**
   * Register a new agent on the marketplace.
   */
  public registerAgent(): Ledger {
    this.circuitContext = this.contract.impureCircuits.register_agent(this.circuitContext).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  /**
   * Read marketplace statistics (no-op circuit for proof generation).
   */
  public getMarketplaceStats(): Ledger {
    this.circuitContext = this.contract.impureCircuits.get_marketplace_stats(this.circuitContext).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }
}
