# GhostSignal — Ghost Signal Marketplace

A **zero-knowledge trading signal marketplace** built on Midnight blockchain where AI agents sell buy/sell signals with cryptographic proof while keeping their strategies private.

## Architecture

```
ghostsignal/
├── contract/       # Midnight Compact smart contract (ZK commit-reveal marketplace)
├── frontend/       # React + Vite frontend (replaces CLI from example-counter)
├── agent/          # Python AI signal generator
├── scripts/        # Setup and DevNet scripts
└── docs/           # Architecture & demo documentation
```

## How It Works

1. **AI Agent** generates a trading signal (BUY/SELL) using a private strategy
2. **Commit Phase**: Agent creates `H(signal || salt)` and submits the hash on-chain with a stake
3. **Market Waits**: The commitment is visible but the signal is hidden (zero-knowledge)
4. **Reveal Phase**: Agent reveals the original signal + salt; the chain verifies `H(signal || salt) == commitment`
5. **Scoring**: On-chain scoreboard tracks agent accuracy without exposing strategies

## Prerequisites

- Node.js >= 18
- Midnight local devnet (bricktowers Docker containers)
- Python >= 3.10 (for the AI agent)
- `compact` CLI (Midnight Compact compiler)

## Quick Start

```bash
# 1. Install dependencies (workspace root)
npm install

# 2. Compile and build the Compact contract
cd contract
npm run compact
npm run build
cd ..

# 3. Start the frontend
cd frontend
npm run dev
# Open http://localhost:5173

# 4. (Optional) Start the AI agent
cd agent
pip install -r requirements.txt
python src/ghost_agent.py
```

## DevNet Setup

Ensure the bricktowers containers are running at static ports:

| Service       | Port  | URL                                    |
|---------------|-------|----------------------------------------|
| Proof Server  | 6300  | http://localhost:6300                   |
| Indexer       | 8088  | http://localhost:8088/api/v3/graphql    |
| Node          | 9944  | http://localhost:9944                   |

```bash
# Check running containers
./scripts/start-devnet.sh
```

## Contract Testing

```bash
cd contract
npm run test          # Run simulator tests
npm run test:compile  # Recompile + test
```

## Project Structure (mirrors example-counter)

| example-counter         | GhostSignal               | Notes                                |
|------------------------|---------------------------|--------------------------------------|
| `counter-cli/`         | `frontend/`               | React replaces CLI                    |
| `contract/`            | `contract/`               | Same structure, richer Compact logic  |
| `counter.compact`      | `ghost-marketplace.compact`| Commit-reveal circuits               |
| `witnesses.ts`         | `witnesses.ts`            | GhostMarketplace private state        |
| `api.ts`               | `services/midnight.ts`    | Provider/contract logic in React      |
| `config.ts`            | `services/config.ts`      | Static ports, no testcontainers       |
| `common-types.ts`      | `types/common-types.ts`   | Marketplace-specific types            |

## License

Apache-2.0
