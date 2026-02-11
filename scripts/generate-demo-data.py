#!/usr/bin/env python3
"""
GhostSignal — Generate Demo Data.

Seeds the marketplace with a handful of AI agents so the frontend has
something to display immediately.  Each agent commits a random signal,
waits briefly, then reveals.

Usage:
    python scripts/generate-demo-data.py [--api-url http://localhost:5173]
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import time

# Allow importing from the agent package
sys.path.insert(0, "agent")

from src.commit_reveal import CommitReveal  # noqa: E402


PAIRS = ["BTC/USD", "ETH/USD", "SOL/USD", "ADA/USD"]
DIRECTIONS = ["buy", "sell", "hold"]
AGENT_NAMES = [
    "MomentumBot-α",
    "MeanRevBot-β",
    "VolSurfer-γ",
    "TrendSniper-δ",
    "ArbiTrader-ε",
]


def generate_agents(count: int = 5) -> list[dict]:
    """Create demo agent profiles."""
    agents = []
    for i in range(count):
        name = AGENT_NAMES[i] if i < len(AGENT_NAMES) else f"Agent-{i:03d}"
        agents.append(
            {
                "id": f"demo-agent-{i:03d}",
                "name": name,
                "pair": random.choice(PAIRS),
                "stake": random.choice([50, 100, 200, 500]),
                "strategy_type": random.choice(
                    ["momentum", "mean_reversion", "random"]
                ),
            }
        )
    return agents


def generate_signal(pair: str) -> dict:
    """Generate a random trading signal."""
    return {
        "pair": pair,
        "direction": random.choice(DIRECTIONS),
        "confidence": round(random.uniform(0.5, 0.99), 2),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def generate_commitments(agents: list[dict]) -> list[dict]:
    """Create commit-reveal pairs for each agent."""
    commitments = []
    for agent in agents:
        signal = generate_signal(agent["pair"])
        salt = CommitReveal.generate_salt()
        commitment_hash = CommitReveal.create_commitment(signal, salt)

        commitments.append(
            {
                "agent": agent,
                "signal": signal,
                "salt": salt,
                "commitment_hash": commitment_hash,
                "verified": CommitReveal.verify_commitment(
                    signal, salt, commitment_hash
                ),
            }
        )
    return commitments


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate GhostSignal demo data")
    parser.add_argument(
        "--count", type=int, default=5, help="Number of demo agents"
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Write JSON to file instead of stdout",
    )
    args = parser.parse_args()

    agents = generate_agents(args.count)
    commitments = generate_commitments(agents)

    demo_data = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "agents": agents,
        "commitments": commitments,
        "stats": {
            "total_agents": len(agents),
            "total_commitments": len(commitments),
            "all_verified": all(c["verified"] for c in commitments),
        },
    }

    output = json.dumps(demo_data, indent=2)

    if args.output:
        with open(args.output, "w") as f:
            f.write(output)
        print(f"✅ Demo data written to {args.output}")
    else:
        print(output)

    # Summary
    print("\n--- Demo Data Summary ---", file=sys.stderr)
    print(f"  Agents:      {len(agents)}", file=sys.stderr)
    print(f"  Commitments: {len(commitments)}", file=sys.stderr)
    print(
        f"  All verified: {all(c['verified'] for c in commitments)}",
        file=sys.stderr,
    )
    for c in commitments:
        direction = c["signal"]["direction"].upper()
        conf = c["signal"]["confidence"]
        pair = c["signal"]["pair"]
        name = c["agent"]["name"]
        print(f"  {name}: {direction} {pair} ({conf:.0%})", file=sys.stderr)


if __name__ == "__main__":
    main()
