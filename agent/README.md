# GhostSignal AI Agent

Python-based AI trading signal generator for the GhostSignal marketplace.

## Overview

The agent:
1. Generates BUY/SELL signals using a configurable trading strategy
2. Creates cryptographic commitments: `H(signal || salt)`
3. Submits commitments on-chain via the frontend API
4. Reveals signals after a configurable delay
5. Tracks performance metrics locally

## Setup

```bash
cd agent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your configuration
```

## Usage

```bash
# Run the agent
python src/ghost_agent.py

# Run tests
python -m pytest tests/
```

## Configuration

See `config/agent_config.yaml` for strategy parameters and ``.env.example`` for environment variables.
