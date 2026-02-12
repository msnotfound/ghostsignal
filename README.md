# 👻 GhostSignal — AI Agent Signal Marketplace

A **zero-knowledge trading signal marketplace** built on the Midnight blockchain where autonomous AI agents publish, trade, and verify buy/sell signals using cryptographic commitments — keeping strategies completely private while making track records publicly verifiable.

## Why This Matters

In traditional signal marketplaces, there's no way to verify that a provider committed to a prediction *before* the market moved. Providers can cherry-pick winners, fabricate track records, and subscribers have no recourse.

GhostSignal solves this with a **commit-reveal-verify protocol** backed by zero-knowledge proofs:

1. **Private Strategies**: Agent trading logic never touches the blockchain. Only cryptographic hashes are committed on-chain.
2. **Tamper-Proof Commitments**: Every signal is timestamped on-chain *before* the market outcome, making retroactive fabrication impossible.
3. **Public Verifiability**: Track records (success rates, total signals, verified wins) are on-chain and auditable by anyone — without revealing what the strategies are.

## Why ZKPs and Midnight?

Standard blockchains are fully transparent — publishing signals on Ethereum would expose every strategy to front-runners. Fully private chains hide everything, including accountability.

Midnight provides the best of both: **programmable privacy with selective disclosure**. ZK circuits prove that commitments match reveals without exposing the underlying data. This opens up real-world use cases:

- **Signal Marketplaces**: Providers prove accuracy without revealing alpha
- **Prediction Markets**: Commit to outcomes before events resolve
- **Credentialed Trading**: Prove track records to investors without exposing positions

## How It Works

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  💡 Generate │ ──> │  🔒 Commit   │ ──> │  👁️ Reveal   │ ──> ✅ Verify
│  Signal      │     │ Hash on-chain│     │  Prove match │     Score on-chain
│  (off-chain) │     │  (ZK proof)  │     │  (ZK proof)  │
└──────────────┘     └──────────────┘     └──────────────┘
```

1. **Generate** — AI Agent creates a trading signal (LONG/SHORT + pair + price) using its private strategy
2. **Commit** — Agent submits `H(signal || salt)` on-chain with a stake (real ZK-proven transaction)
3. **Reveal** — After a delay, agent reveals the signal; the chain verifies the preimage matches the commitment hash
4. **Verify** — After the market outcome, the signal is scored (WIN/LOSS) and the agent's track record updates on-chain
5. **Purchase** — Other agents can buy revealed signals for tNight tokens

## Project Structure

```
ghostsignal/
├── contract/           # Compact smart contract (ZK commit-reveal marketplace)
│   └── src/ghost-marketplace.compact
├── agents-ts/          # AI agent backend (TypeScript)
│   ├── src/agent.ts          # Agent logic (generate → commit → reveal → verify)
│   ├── src/chain-api.ts      # Midnight SDK integration (wallet, contract, providers)
│   ├── src/api-server.ts     # Express API server for frontend
│   ├── src/deploy.ts         # Contract deployment script
│   ├── src/fund-agents.ts    # Agent wallet funding script
│   └── src/config.ts         # Network endpoints & agent configuration
├── frontend/           # React + Vite dashboard
│   └── src/App.tsx           # Live Market, Leaderboard, Activity, On-Chain Explorer
└── scripts/            # DevNet launcher & utilities
    └── start-devnet.sh       # Auto-starts Docker containers
```

## Prerequisites

| Requirement | Version | Check |
|---|---|---|
| **Node.js** | v22+ | `node --version` |
| **Docker** | Latest (with `docker compose`) | `docker --version` |
| **Compact compiler** | v0.28.0 | `compact --version` |
| **Midnight local network** | Latest | Docker containers |

### Install the Compact compiler

```bash
# Install the Compact version manager
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/download/compact-v0.4.0/compact-installer.sh | sh

# Add to PATH
source $HOME/.local/bin/env

# Install the compiler version required by this project
compact update 0.28.0

# Verify
compact --version   # expect: compact 0.4.0
compact list        # should show 0.28.0 selected
```

### Clone the Midnight local network

```bash
# Clone the local network repo (one level above this project)
git clone https://github.com/midnight-ntwrk/midnight-local-network.git
```

## Quick Start (End-to-End)

### Step 1 — Start the local DevNet

Start the Midnight Docker containers (node, indexer, proof server):

```bash
# Option A: Use the GhostSignal launcher script
chmod +x scripts/start-devnet.sh
./scripts/start-devnet.sh

# Option B: Start manually
cd ../midnight-local-network    # adjust path as needed
docker compose up -d
```

Wait for all three services to be ready:

| Service | Port | URL |
|---------|------|-----|
| Proof Server | 6300 | `http://localhost:6300` |
| Indexer | 8088 | `http://localhost:8088/api/v3/graphql` |
| Node | 9944 | `ws://localhost:9944` |

### Step 2 — Install dependencies

```bash
# From the ghostsignal root directory
npm install
```

This installs dependencies for all workspaces (contract, agents-ts, frontend).

### Step 3 — Build the smart contract

```bash
cd contract
npm run compact     # Compile Compact → ZK circuits
npm run build       # Generate TypeScript bindings
```

Expected output from `npm run compact`:

```
Compiling 5 circuits:
  circuit "commit_signal" ...
  circuit "reveal_signal" ...
  circuit "verify_signal" ...
  circuit "register_agent" ...
  circuit "get_marketplace_stats" ...
```

> **Note**: The first run may download ZK parameters (~500MB). This is a one-time download.

### Step 4 — Deploy the contract

```bash
cd agents-ts
npm run deploy
```

This deploys `ghost-marketplace.compact` to the local network using a genesis wallet. On success, it saves the contract address to `agents-ts/deployment.json`:

```json
{
  "contractAddress": "8e3341b5a4b3aef..."
}
```

### Step 5 — Fund the agent wallets

```bash
cd agents-ts
npm run fund
```

This transfers 100,000 tNight from the genesis wallet to each of the 3 AI agents (AlphaEdge AI, MomentumBot, DeepTrend γ). You'll see each agent's balance after funding.

### Step 6 — Start the frontend

```bash
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

### Step 7 — Start the agents

```bash
cd agents-ts
npm run start
```

You'll see:

```
   ██████╗ ██╗  ██╗ ██████╗ ███████╗████████╗
  ██╔════╝ ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
  ██║  ███╗███████║██║   ██║███████╗   ██║
  ██║   ██║██╔══██║██║   ██║╚════██║   ██║
  ╚██████╔╝██║  ██║╚██████╔╝███████║   ██║
   ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝

  AI Agent Signal Marketplace - API Server (Real Chain)
```

Each agent will:
1. Build its HD wallet from a unique seed
2. Sync with the network and verify balance
3. Join the deployed contract
4. Register on-chain as a marketplace participant
5. Start the autonomous signal loop (generate → commit → reveal → verify)

**Real on-chain transactions** appear as TX hashes starting with `00...` (hex-encoded), while simulated fallbacks start with `0x`.

## Frontend Dashboard

The dashboard (http://localhost:5173) has four views:

| Tab | Description |
|-----|-------------|
| **📊 Live Market** | Real-time signals from all agents — direction, pair, entry/target/stop prices, TX hashes |
| **🏆 Leaderboard** | Agent rankings — signals created, revealed, verified, success rate, balance |
| **🤖 Agent Activity** | Full chronological log of all events with TX hashes |
| **⛓️ On-Chain** | Transaction explorer — click any TX to view block number, block hash, and data payload |

## Available Scripts

| Directory | Script | Description |
|-----------|--------|-------------|
| `contract/` | `npm run compact` | Compile the Compact contract |
| `contract/` | `npm run build` | Generate TypeScript bindings |
| `contract/` | `npm run test` | Run contract simulator tests |
| `agents-ts/` | `npm run deploy` | Deploy contract to local network |
| `agents-ts/` | `npm run fund` | Fund agent wallets from genesis |
| `agents-ts/` | `npm run start` | Start agent API server (real chain) |
| `agents-ts/` | `npm run demo` | Simulated demo (no chain needed) |
| `frontend/` | `npm run dev` | Start frontend dev server |

## Restarting After Shutdown

**Normal restart** (contract + wallets are persistent):
```bash
# Make sure Docker devnet is running, then:
cd agents-ts && npm run start
cd frontend && npm run dev   # in separate terminal
```

**If you see "unable to authenticate data" errors:**
```bash
# Delete stale encrypted stores and restart
cd agents-ts
rm -rf midnight-ldb-ghostsignal-*
npm run start
```

**Full reset** (fresh contract + fresh wallets):
```bash
cd agents-ts
rm -rf midnight-ldb-ghostsignal-* midnight-level-db deployment.json
npm run deploy
npm run fund
npm run start
```

## Technical Architecture

### Smart Contract (`ghost-marketplace.compact`)

Written in Compact, Midnight's ZK-native language. Five public ledger counters, four circuits:

| Circuit | On-Chain Effect |
|---------|----------------|
| `register_agent()` | `active_agents += 1` |
| `commit_signal()` | `total_commitments += 1`, `total_stake_locked += 1` |
| `reveal_signal()` | `total_reveals += 1` |
| `verify_signal()` | `total_verified += 1` |

Each circuit call generates a zero-knowledge proof, meaning the chain validates state transitions without seeing the underlying signal data.

### Agent Architecture

Each agent runs its own:
- **HD Wallet** — derived from a unique 64-char hex seed (deterministic)
- **Encrypted LevelDB** — private state storage, encrypted with the wallet's public key
- **Contract Instance** — joined via the deployed contract address

The agents use Midnight's JavaScript SDK:
- `@midnight-ntwrk/wallet-sdk-facade` for wallet management
- `@midnight-ntwrk/midnight-js-contracts` for ZK circuit calls
- `@midnight-ntwrk/midnight-js-level-private-state-provider` for encrypted storage

### Dust Tokens

Midnight uses **DUST** as a non-transferable fee token (generated from staked tNight). If agents transact faster than dust regenerates, they'll temporarily fall back to simulated transactions and retry automatically after a 15-second cooldown.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `compact: command not found` | Run `source $HOME/.local/bin/env` |
| `connect ECONNREFUSED :6300` | Start the proof server: `./scripts/start-devnet.sh` |
| `Unsupported state or unable to authenticate data` | Delete LevelDB stores: `rm -rf agents-ts/midnight-ldb-ghostsignal-*` |
| `No dust tokens found in the wallet state` | Transient — agents retry automatically. Reduce load by increasing `signalIntervalMs` in `config.ts` |
| `Database failed to open` | Same as dust issue — agents retry after 15s cooldown |
| Proof server hangs on Mac ARM | Docker Desktop → Settings → General → VMM → select **Docker VMM**, restart Docker |
| Agent shows 0 balance | Run `npm run fund` to transfer tNight from genesis wallet |
| `deployment.json` not found | Run `npm run deploy` first to deploy the contract |

## Screenshots
![alt text](<Screenshot from 2026-02-12 18-50-02.png>) ![alt text](<Screenshot from 2026-02-12 18-48-48.png>) ![alt text](<Screenshot from 2026-02-12 18-47-10.png>) ![alt text](<Screenshot from 2026-02-12 18-46-32.png>) ![alt text](<Screenshot from 2026-02-12 18-46-06.png>)


## License

Apache-2.0
