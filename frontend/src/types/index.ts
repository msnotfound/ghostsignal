// GhostSignal — Type re-exports and application-level types

export type {
  MarketplaceCircuits,
  MarketplaceProviders,
  MarketplaceContract,
  DeployedMarketplaceContract,
} from './common-types';

export { MarketplacePrivateStateId } from './common-types';

/** Wallet connection mode */
export type WalletMode = 'lace' | 'manual';

/** Wallet connection state tracked in the React UI */
export interface WalletState {
  /** Connection mode: 'lace' for browser users, 'manual' for CLI/agent */
  mode: WalletMode;
  /** The hex-encoded seed used to derive wallet keys (manual mode only) */
  seed: string | null;
  /** Whether the wallet has synced with the network */
  isSynced: boolean;
  /** Unshielded tNight balance (smallest unit) */
  balance: bigint;
  /** DUST token balance */
  dustBalance: bigint;
  /** Bech32m-encoded unshielded address */
  unshieldedAddress: string;
  /** Bech32m-encoded shielded address */
  shieldedAddress: string;
  /** Whether funds have been received */
  hasFunds: boolean;
}

/** Signal direction: BUY or SELL */
export type SignalDirection = 'BUY' | 'SELL';

/** A trading signal before commitment */
export interface TradingSignal {
  /** Unique signal ID (generated client-side) */
  id: string;
  /** BUY or SELL */
  direction: SignalDirection;
  /** Trading pair, e.g. "BTC/USD" */
  pair: string;
  /** Target price */
  targetPrice: number;
  /** Confidence level 0-100 */
  confidence: number;
  /** ISO timestamp of signal generation */
  timestamp: string;
}

/** A commitment to a signal (on-chain) */
export interface SignalCommitment {
  /** On-chain commitment ID (counter value at time of commit) */
  commitmentId: bigint;
  /** SHA-256 hash of (signal || salt) */
  commitmentHash: string;
  /** Stake amount in tNight */
  stakeAmount: bigint;
  /** ISO timestamp of commitment */
  committedAt: string;
  /** Whether this commitment has been revealed */
  isRevealed: boolean;
  /** Whether this commitment has been verified */
  isVerified: boolean;
}

/** An agent's public profile (from on-chain ledger) */
export interface AgentProfile {
  /** Total signals committed */
  totalCommitments: bigint;
  /** Total signals revealed */
  totalReveals: bigint;
  /** Total signals verified as correct */
  totalVerified: bigint;
  /** Win rate percentage (verified / reveals * 100) */
  winRate: number;
  /** Current stake at risk */
  currentStake: bigint;
}

/** Marketplace-level statistics (from on-chain ledger) */
export interface MarketplaceStats {
  totalCommitments: bigint;
  totalReveals: bigint;
  totalVerified: bigint;
  activeAgents: bigint;
  totalStakeLocked: bigint;
}

// ============================================================================
// Marketplace Signal Types — for the buy/sell signal flow
// ============================================================================

/** Status of a signal through its lifecycle */
export type SignalStatus = 'committed' | 'revealed' | 'verified' | 'expired';

/** A listed signal on the marketplace (visible to buyers) */
export interface MarketplaceSignal {
  /** Unique ID (auto-generated) */
  id: string;
  /** Seller display name */
  sellerName: string;
  /** Trading pair */
  pair: string;
  /** SHA-256 commitment hash (always visible) */
  commitmentHash: string;
  /** Salt used (revealed only after purchase/reveal) */
  salt: string;
  /** The actual signal data (hidden until revealed) */
  signal: TradingSignal | null;
  /** Price to purchase this signal (in tNight) */
  price: number;
  /** Lifecycle status */
  status: SignalStatus;
  /** When the signal was committed */
  committedAt: string;
  /** When it was revealed (null if not yet) */
  revealedAt: string | null;
  /** Whether the signal was correct */
  isCorrect: boolean | null;
  /** Actual market outcome (for display after verification) */
  actualOutcome: number | null;
}

/** Seller profile with performance track record */
export interface SellerProfile {
  id: string;
  name: string;
  totalSignals: number;
  correctSignals: number;
  winRate: number;
  avgConfidence: number;
  totalStaked: number;
  totalEarned: number;
  activeSince: string;
  pairs: string[];
}

/** A purchase record for the buyer's history */
export interface PurchaseRecord {
  signalId: string;
  buyerPaid: number;
  purchasedAt: string;
  revealed: boolean;
  signal: TradingSignal | null;
}
