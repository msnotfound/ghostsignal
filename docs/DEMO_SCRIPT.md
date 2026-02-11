# GhostSignal — Demo Script

A step-by-step walkthrough for demonstrating the Ghost Signal Marketplace.

---

## Prerequisites

| Requirement        | Version    | Check                          |
|--------------------|------------|--------------------------------|
| Node.js            | ≥ 18       | `node -v`                      |
| npm                | ≥ 9        | `npm -v`                       |
| Docker             | ≥ 24       | `docker -v`                    |
| Python (optional)  | ≥ 3.10     | `python3 --version`            |
| Compact compiler   | ≥ 0.20     | `compactc --version`           |

---

## Part 1 — Setup (5 min)

### 1.1 Start the Local DevNet

```bash
./scripts/start-devnet.sh
```

Wait for the three services to report ✅:
- Node at `ws://localhost:9944`
- Indexer at `http://localhost:8088`
- Proof Server at `http://localhost:6300`

### 1.2 Install & Build

```bash
./scripts/setup.sh
```

This runs `npm install`, compiles the Compact contract, and opens the
frontend at `http://localhost:5173`.

---

## Part 2 — Wallet Setup (2 min)

1. Open the browser at **http://localhost:5173**
2. You'll see the **Wallet Setup** screen.
3. Click **"Generate New Seed"** to create a fresh wallet.
4. Copy the seed phrase (you can paste it back later to restore).
5. Click **"Set Up Wallet"**.
6. Wait for the wallet to synchronise with the devnet (status shows
   "Syncing…" → "Ready").

> **Note:** There is no genesis wallet auto-login. You always start by
> providing or generating a seed.

### Fund the Wallet

Use the local network's funding script:

```bash
cd ../../../midnight-local-network
npx ts-node fund.mjs <your-wallet-address>
```

---

## Part 3 — Deploy the Contract (2 min)

1. After wallet setup, the **Deploy Contract** panel appears.
2. Click **"Deploy New Marketplace"**.
3. Wait for the transaction to confirm (ZK proof generation may take 30–60 s
   on the first call).
4. The contract address appears. **Copy it** — other participants will need
   it to join.

### Joining an Existing Marketplace

If someone else has already deployed:

1. Paste their contract address in the **"Join Existing"** field.
2. Click **"Join Marketplace"**.

---

## Part 4 — The Marketplace (5 min)

Once the contract is live, the full marketplace UI loads:

### 4.1 Agent Scoreboard

- Shows all registered agents, win rates, and stakes.
- Initially empty — agents register themselves when they commit.

### 4.2 Commit a Signal

1. In the **Agent Card** panel, click **"Commit Signal"**.
2. Under the hood:
   - A random trading signal is generated.
   - `SHA-256(signal + salt)` is computed.
   - The hash is submitted on-chain via `commit_signal()`.
   - Your stake is locked.
3. The commitment appears in the **Commitment Timeline**.

### 4.3 Reveal the Signal

1. After the reveal delay, click **"Reveal Signal"**.
2. The original signal and salt are published on-chain.
3. The timeline updates to show the revealed signal.

### 4.4 Verify a Proof

1. Navigate to the **Verification Proof** panel.
2. Enter a commitment hash, signal JSON, and salt.
3. Click **"Verify"**.
4. The UI computes `SHA-256(signal + salt)` locally and compares to the hash.
5. Green ✅ = verified, Red ❌ = mismatch.

---

## Part 5 — AI Agent (Optional, 3 min)

### 5.1 Start the Python Agent

```bash
cd agent
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m src.ghost_agent
```

The agent will:
1. Pull (synthetic) market data.
2. Run its strategy.
3. Commit a signal hash.
4. Wait for the reveal delay.
5. Reveal the signal.
6. Loop.

### 5.2 Watch the Timeline

Switch back to the browser — you'll see the agent's commitments and reveals
appearing in real-time on the **Commitment Timeline**.

### 5.3 Generate Demo Data

For a quick demo with multiple agents:

```bash
python scripts/generate-demo-data.py --count 5
```

This outputs JSON with 5 agents, their signals, and verifiable commitments.

---

## Part 6 — Key Talking Points

### "Why Midnight?"

> Traditional signal marketplaces require agents to reveal their strategies.
> Midnight's ZK proofs let agents **prove they had a correct signal** without
> revealing **how they generated it**.

### "How does the commit-reveal work?"

> 1. Agent computes `hash(signal + salt)` and publishes the hash.
> 2. Later, agent reveals the signal and salt.
> 3. Anyone can verify: recompute the hash and compare.
> 4. The ZK proof ensures the agent can't change the signal after the fact.

### "What's on-chain vs off-chain?"

> | On-chain (public)                 | Off-chain (private)              |
> |-----------------------------------|----------------------------------|
> | Commitment hashes                 | Trading strategy                 |
> | Stake amounts                     | Signal generation logic          |
> | Reveal data (after reveal phase)  | Salt (until reveal)              |
> | Agent count, stats                | Per-agent private state           |

### "Is this production-ready?"

> This is a **reference implementation** and demo scaffold. For production:
> - Integrate real market data feeds (CoinGecko, Binance).
> - Add economic incentive mechanisms (slashing, rewards).
> - Implement proper agent authentication.
> - Harden the Python agent against network failures.

---

## Cleanup

```bash
# Stop the frontend
Ctrl+C  (in the terminal running vite)

# Stop the devnet
cd midnight-local-network && docker compose down

# Deactivate the Python venv
deactivate
```
