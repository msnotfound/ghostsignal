# GhostSignal — Demo Video Script

**Duration:** ~4-5 mins | **Format:** Screen recording, notepad on side, no voiceover

---

## Setup Before Recording

- Docker devnet running (node, indexer, proof-server)
- Contract deployed (`deployment.json` exists)
- Frontend running at `http://localhost:5173`
- Terminal ready in `agents-ts/` to run `npm run start`
- Notepad open on the right side of screen

---

## SCENE 1 — Intro (30s)

**Type in notepad:**
```
GhostSignal — AI Agent Signal Marketplace
Built on Midnight Blockchain

AI agents publish buy/sell signals using
zero-knowledge commitments.

Strategies stay PRIVATE.
Track records are PUBLIC and verifiable on-chain.
```

**Show on screen:** The frontend dashboard (Live Market tab).

---

## SCENE 2 — How It Works (30s)

**Type in notepad:**
```
How it works:

1. GENERATE — Agent creates a signal (off-chain)
2. COMMIT   — Hash goes on-chain (ZK proof)
3. REVEAL   — Agent proves the preimage matches
4. VERIFY   — Signal scored, track record updated

Nobody sees the signal until the agent reveals it.
```

**Show on screen:** Dashboard or briefly show `ghost-marketplace.compact`.

---

## SCENE 3 — Start the Agents (60s)

**Type in notepad:**
```
Starting 3 AI agents:
  - AlphaEdge AI
  - MomentumBot
  - DeepTrend γ

Each agent has its own HD wallet,
funded with tNight tokens.
```

**Do:** Run `npm run start` in terminal. Let the initialization logs scroll.

**Type when agents connect:**
```
Each agent:
  ✓ Builds wallet from unique seed
  ✓ Syncs with Midnight network
  ✓ Joins the deployed contract
  ✓ Registers on-chain
  ✓ Starts generating signals
```

---

## SCENE 4 — Live Commit-Reveal Cycle (90s)

**Type in notepad:**
```
Watch the terminal:

💡 = Signal generated (private, off-chain)
🔒 = Committed on-chain (ZK proof, hash only)
👁️  = Revealed (chain verifies preimage)
✅ = Verified (WIN/LOSS scored on-chain)
💰 = Another agent purchased the signal

TX hashes starting with "00..." = REAL on-chain
TX hashes starting with "0x..." = simulated (dust cooldown)
```

**Show on screen:** Terminal with live agent activity for ~60-90 seconds.

---

## SCENE 5 — Frontend Walkthrough (60s)

**Switch to browser. Click through each tab:**

### Live Market tab
```
📊 Live Market
Real-time signals from all agents.
Shows: pair, direction, confidence, TX hash
```

### Leaderboard tab
```
🏆 Leaderboard
Agents ranked by verified track record.
All backed by on-chain data.
```

### Agent Activity tab
```
🤖 Full Activity Log
Every event: commits, reveals, verifies, purchases
With timestamps and TX hashes
```

### On-Chain Explorer tab (click a TX)
```
⛓️ On-Chain Explorer
Click any TX → see block number, block hash,
agent, and data payload.
```

---

## SCENE 6 — Closing (30s)

**Type in notepad:**
```
Summary:
- Private strategies via zero-knowledge proofs
- Public, tamper-proof track records on-chain
- Autonomous AI agents trading in real-time
- Built on Midnight blockchain

GhostSignal — where track records speak for themselves.

github.com/msnotfound/ghostsignal
```

Hold for 5 seconds, end recording.

---

## Tips

- Pre-type all notepad text, scroll down to reveal each block
- Start `npm run start` ~30s before Scene 4 so activity is flowing
- Use a large monospace font (Consolas) in notepad
- Notepad right ~30%, terminal/browser left ~70%
