# GhostSignal — Architecture

## Overview

GhostSignal is a **Ghost Signal Marketplace** built on the Midnight network.
AI trading agents publish buy/sell signals with cryptographic proof of accuracy
while keeping their strategies completely private — thanks to Midnight's
zero-knowledge proof infrastructure.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GhostSignal Stack                          │
├─────────────────────┬─────────────────────┬─────────────────────────┤
│   React Frontend    │   Compact Contract  │   Python AI Agent       │
│   (frontend/)       │   (contract/)       │   (agent/)              │
│                     │                     │                         │
│ • Wallet setup      │ • Ledger state      │ • Strategy engine       │
│ • Contract deploy   │ • ZK circuits       │ • Commit-reveal crypto  │
│ • Signal browsing   │ • Commitment store  │ • Midnight HTTP client  │
│ • Proof verification│ • Verification      │ • Market data feed      │
└────────┬────────────┴──────────┬──────────┴────────────┬────────────┘
         │                       │                       │
         │  wallet SDK           │  proof server         │  REST API
         │                       │                       │
┌────────▼───────────────────────▼───────────────────────▼────────────┐
│                     Midnight Local DevNet                           │
│                                                                     │
│  Node (:9944)    Indexer (:8088)    Proof Server (:6300)           │
└─────────────────────────────────────────────────────────────────────┘
```

## Layer-by-Layer

### 1. Compact Contract  (`contract/`)

The on-chain brain of GhostSignal. Written in [Compact](https://docs.midnight.network/develop/reference/compact),
Midnight's domain-specific language for zero-knowledge smart contracts.

| Ledger Counter       | Purpose                              |
|----------------------|--------------------------------------|
| `total_commitments`  | Global commitment count              |
| `total_reveals`      | Global reveal count                  |
| `total_verified`     | Signals whose proofs checked out     |
| `active_agents`      | Registered agent count               |
| `total_stake_locked` | Sum of all staked tNight             |

| Circuit               | What it does                                    |
|------------------------|-------------------------------------------------|
| `commit_signal`        | Hashes signal, records commitment, locks stake   |
| `reveal_signal`        | Reveals the original signal + salt               |
| `verify_signal`        | On-chain proof that reveal matches commitment    |
| `register_agent`       | Adds a new agent to the marketplace              |
| `get_marketplace_stats`| Read-only stats query                            |

**Pattern origin:** The contract is modelled after `counter.compact` from the
Midnight `example-counter` project. Each circuit increments/reads counters in
the same style, with private witness state for agent-local bookkeeping.

### 2. React Frontend  (`frontend/`)

A single-page React + TypeScript app (Vite) that replaces the CLI from
`example-counter`. The UI flows through three steps:

1. **Wallet** — user supplies a seed phrase (or generates one). No genesis
   wallet auto-login.
2. **Contract** — deploy a new marketplace or join an existing one by address.
3. **Marketplace** — browse agents, view commitments, purchase signals, verify
   proofs.

Key service files are direct ports of the `api.ts` patterns from
`counter-cli`:

| Frontend service      | Maps to (example-counter)             |
|-----------------------|---------------------------------------|
| `services/wallet.ts`  | Wallet / key derivation / sync logic  |
| `services/midnight.ts`| Contract deployment / interaction     |
| `services/config.ts`  | Network configuration (static ports)  |

### 3. Python AI Agent  (`agent/`)

A headless trading agent that:

1. Pulls market data (synthetic for now, real feeds later).
2. Runs a pluggable strategy (Momentum, Mean-Reversion, Random).
3. Commits a signal hash on-chain (commit phase).
4. Waits a configurable delay, then reveals the signal (reveal phase).
5. On-chain verification proves accuracy.

```
  Market Data ──▶ Strategy ──▶ Signal ──▶ Commit (SHA-256)
                                              │
                                         (delay)
                                              │
                                          Reveal ──▶ On-chain Verify
```

## Commit-Reveal Protocol

The core mechanism that enables **provable accuracy without exposing strategy**:

1. **Commit:** `hash = SHA-256( JSON.stringify(signal, sorted_keys) + salt )`
   - Hash is published on-chain; signal and salt stay private.
2. **Wait:** A configurable delay (e.g., 60 s) passes.
3. **Reveal:** Agent publishes the original signal + salt.
4. **Verify:** Anyone can recompute `SHA-256(signal + salt)` and check it
   matches the on-chain hash.

Both TypeScript (`utils/verification.ts`) and Python (`src/commit_reveal.py`)
use identical serialisation (JSON with sorted keys) to ensure cross-language
compatibility.

## Mapping to example-counter

| example-counter           | GhostSignal equivalent          |
|---------------------------|---------------------------------|
| `counter.compact`         | `ghost-marketplace.compact`     |
| `counter-cli/`            | `frontend/` (React)             |
| `counter-simulator.ts`    | `ghost-marketplace-simulator.ts`|
| `counter.test.ts`         | `ghost-marketplace.test.ts`     |
| `api.ts`                  | `services/midnight.ts`          |
| `common-types.ts`         | `types/common-types.ts`         |
| `config.ts`               | `services/config.ts`            |
| `witnesses.ts`            | `witnesses.ts`                  |
| `index.ts`                | `index.ts`                      |
| *(none)*                  | `agent/` (new — Python)         |

## Static Ports (DevNet)

| Service       | Port  | Protocol |
|---------------|-------|----------|
| Proof Server  | 6300  | HTTP     |
| Indexer       | 8088  | HTTP/WS  |
| Node          | 9944  | WS       |
| Frontend      | 5173  | HTTP     |

No testcontainers, no dynamic port mapping — everything is statically wired.
