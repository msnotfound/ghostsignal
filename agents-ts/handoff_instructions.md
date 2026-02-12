# GhostSignal Real Chain Integration — AI Agent Handoff Instructions

## Objective
Update the GhostSignal agent simulation to use the real Midnight blockchain, so that all agent actions (commit, reveal, verify, purchase) produce actual on-chain transaction hashes from the local Midnight node.

---

## Step-by-Step Instructions

### 1. **Install Midnight SDK and Contract Packages**
- Ensure all Midnight SDK packages are installed in `agents-ts/package.json` (do not remove any wallet dependencies).
- The contract package should reference the local contract folder:
  ```json
  "@midnight-ntwrk/ghostsignal-contract": "file:../contract"
  ```
- Run `npm install` in `agents-ts`.

### 2. **Update Agent Class for Real Chain**
- In `src/agent.ts`, import the Midnight SDK and contract:
  ```typescript
  import { Contract } from '@midnight-ntwrk/ghostsignal-contract';
  import { createWallet, WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
  import { CompactRuntime } from '@midnight-ntwrk/compact-runtime';
  // ...other SDK imports as needed
  ```
- In the agent constructor:
  - Initialize a wallet using the agent's seed (use HD wallet or DustWallet as appropriate).
  - Connect the wallet to the local node (`config.nodeUri`).
  - Load the contract instance using the deployed address from `config.contractAddress`.

### 3. **Replace Simulated Transactions with Real Calls**
- For each agent action:
  - **commit_signal**: Call the contract's `commit_signal` circuit, passing the commitment hash and wallet.
  - **reveal_signal**: Call the contract's `reveal_signal` circuit, passing the signal and salt.
  - **verify_signal**: Call the contract's `verify_signal` circuit, passing the outcome.
  - **purchase_signal**: Call the contract's purchase circuit, passing the seller and signal hash.
- Each call should:
  - Submit a real transaction to the node.
  - Await confirmation (or at least get the tx hash from the response).
  - Store the real tx hash in the commitment or activity log.

### 4. **Update API and Frontend**
- Ensure the API server and frontend display the real tx hashes from the chain.
- Optionally, add a chain explorer view to show block info and allow verification.

### 5. **Testing**
- Start the Midnight local network (`docker compose up -d`).
- Deploy the contract and update `config.contractAddress` with the deployed address.
- Run the agent API server (`npm run start`).
- Run the frontend (`npm run dev`).
- Confirm that all hashes shown in the UI are real on-chain hashes from the node.

---

## Notes
- Do not remove any wallet dependencies from package.json.
- Use the local contract package, not npm registry.
- All agent actions must use the real SDK and node, not simulated hashes.
- If you need to add new SDK imports, do so as required.
- Document any changes in this file for future handoff.
