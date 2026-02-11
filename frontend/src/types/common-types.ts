// GhostSignal — Common types
// Mirrors: example-counter/counter-cli/src/common-types.ts
//
// example-counter defines:
//   CounterCircuits, CounterPrivateStateId, CounterProviders, CounterContract, DeployedCounterContract
// We follow the exact same pattern with Marketplace-specific types.

import { GhostMarketplace, type GhostMarketplacePrivateState } from '@midnight-ntwrk/ghostsignal-contract';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import type { DeployedContract, FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { ImpureCircuitId } from '@midnight-ntwrk/compact-js';

/**
 * Union of all impure circuit IDs in the GhostMarketplace contract.
 * Mirrors: CounterCircuits = ImpureCircuitId<Counter.Contract<CounterPrivateState>>
 */
export type MarketplaceCircuits = ImpureCircuitId<GhostMarketplace.Contract<GhostMarketplacePrivateState>>;

/**
 * Private state ID used as the key in the private state provider.
 * Mirrors: CounterPrivateStateId = 'counterPrivateState'
 */
export const MarketplacePrivateStateId = 'ghostMarketplacePrivateState';

/**
 * Full provider configuration type for the marketplace contract.
 * Mirrors: CounterProviders = MidnightProviders<CounterCircuits, typeof CounterPrivateStateId, CounterPrivateState>
 */
export type MarketplaceProviders = MidnightProviders<
  MarketplaceCircuits,
  typeof MarketplacePrivateStateId,
  GhostMarketplacePrivateState
>;

/**
 * The contract instance type (parameterized with private state).
 * Mirrors: CounterContract = Counter.Contract<CounterPrivateState>
 */
export type MarketplaceContract = GhostMarketplace.Contract<GhostMarketplacePrivateState>;

/**
 * Deployed or found contract instance (result of deploy or join).
 * Mirrors: DeployedCounterContract = DeployedContract<CounterContract> | FoundContract<CounterContract>
 */
export type DeployedMarketplaceContract = DeployedContract<MarketplaceContract> | FoundContract<MarketplaceContract>;
