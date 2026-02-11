# GhostSignal — Contract Specification

## Contract: `ghost-marketplace.compact`

**Language version:** `>= 0.20`  
**Runtime:** `compact-runtime 0.14.0`  
**Library:** `CompactStandardLibrary`

---

## Ledger State

All state is stored on-chain as unsigned 64-bit integers.

```compact
export ledger {
  total_commitments:  Counter,      // global commitment count
  total_reveals:      Counter,      // global reveal count
  total_verified:     Counter,      // verified proof count
  active_agents:      Counter,      // registered agent count
  total_stake_locked: Uint<64>,     // sum of all staked tNight
}
```

## Circuits

### `commit_signal(stake_amount: Uint<64>): Void`

**Purpose:** An agent commits a signal hash and locks a stake.

**Public effects:**
- `total_commitments += 1`
- `total_stake_locked += stake_amount`

**Private effects (witness):**
- `localCommitmentCount += 1`
- `currentStake += stake_amount`
- `lastCommitmentHash` updated

**Preconditions:**
- `stake_amount > 0`

---

### `reveal_signal(): Void`

**Purpose:** An agent reveals a previously committed signal.

**Public effects:**
- `total_reveals += 1`

**Private effects (witness):**
- `localRevealCount += 1`
- `lastSignalData` updated

**Preconditions:**
- Agent has at least one unrevealed commitment (`localCommitmentCount > localRevealCount`)

---

### `verify_signal(): Void`

**Purpose:** On-chain verification that a revealed signal matches its commitment hash.

**Public effects:**
- `total_verified += 1`

**Private effects (witness):**
- `localVerifiedCount += 1`

**Preconditions:**
- Agent has at least one unverified reveal (`localRevealCount > localVerifiedCount`)

---

### `register_agent(): Void`

**Purpose:** Register a new agent in the marketplace.

**Public effects:**
- `active_agents += 1`

**Private effects:** *(none)*

---

### `get_marketplace_stats(): Void`

**Purpose:** Read-only query that touches no state — just forces ZK proof generation for the current ledger values.

**Public effects:** *(none — read-only)*

---

## Private State (Witnesses)

```typescript
type GhostMarketplacePrivateState = {
  readonly localCommitmentCount: number;
  readonly localRevealCount:     number;
  readonly localVerifiedCount:   number;
  readonly currentStake:         bigint;
  readonly lastCommitmentHash:   string;
  readonly lastSalt:             string;
  readonly lastSignalData:       string;
};
```

Initial private state:

```typescript
{
  localCommitmentCount: 0,
  localRevealCount:     0,
  localVerifiedCount:   0,
  currentStake:         0n,
  lastCommitmentHash:   '',
  lastSalt:             '',
  lastSignalData:       '',
}
```

## Commitment Hash Format

Both on-chain (TypeScript) and off-chain (Python) agents produce commitments
using the same algorithm:

```
commitment = SHA-256( JSON.stringify(signal, Object.keys(signal).sort()) + salt )
```

Where:
- `signal` is a JSON object with keys like `pair`, `direction`, `confidence`, `timestamp`
- Keys are sorted lexicographically before serialisation
- `salt` is a 32-byte random hex string (64 hex chars)
- The hash is hex-encoded (64 chars)

### Cross-language Compatibility

| Language   | Implementation                          | File                       |
|------------|-----------------------------------------|----------------------------|
| TypeScript | `crypto.subtle.digest('SHA-256', ...)`  | `utils/verification.ts`    |
| Python     | `hashlib.sha256(...).hexdigest()`       | `src/commit_reveal.py`     |

Both produce identical output for the same inputs.

## Deployment

The contract is deployed via the `deploy()` function in `services/midnight.ts`,
which mirrors `example-counter`'s deployment pattern:

1. Compile the Compact source with `compactc`
2. Load the compiled contract from `managed/ghost-marketplace/`
3. Call `deployContract(providers, { privateState: initialPrivateState })`
4. Return the `DeployedMarketplaceContract` handle

Joining an existing contract uses `findDeployedContract(providers, contractAddress, ...)`.
