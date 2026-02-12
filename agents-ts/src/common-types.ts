// GhostSignal — Contract type aliases
// Mirrors: example-counter/counter-cli/src/common-types.ts

import { GhostMarketplace, type GhostMarketplacePrivateState } from '@midnight-ntwrk/ghostsignal-contract';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import type { DeployedContract, FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { ImpureCircuitId } from '@midnight-ntwrk/compact-js';

export type GhostMarketplaceCircuits = ImpureCircuitId<GhostMarketplace.Contract<GhostMarketplacePrivateState>>;

export const GhostMarketplacePrivateStateId = 'ghostMarketplacePrivateState';

export type GhostMarketplaceProviders = MidnightProviders<
    GhostMarketplaceCircuits,
    typeof GhostMarketplacePrivateStateId,
    GhostMarketplacePrivateState
>;

export type GhostMarketplaceContract = GhostMarketplace.Contract<GhostMarketplacePrivateState>;

export type DeployedGhostMarketplaceContract =
    | DeployedContract<GhostMarketplaceContract>
    | FoundContract<GhostMarketplaceContract>;
