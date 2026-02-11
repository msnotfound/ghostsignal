"""
GhostSignal AI Agent — Main agent class.

The GhostAgent orchestrates the commit-reveal lifecycle:
  1. Generate a trading signal using the configured strategy
  2. Create a cryptographic commitment: H(signal || salt)
  3. Submit the commitment on-chain with a stake
  4. Wait for the reveal period
  5. Reveal the original signal and salt on-chain
  6. Track performance metrics
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import yaml
from dotenv import load_dotenv

from .commit_reveal import CommitReveal
from .midnight_client import MidnightClient
from .strategy import TradingStrategy, MomentumStrategy, MeanReversionStrategy, RandomStrategy

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)


@dataclass
class AgentConfig:
    """Agent configuration loaded from YAML and environment."""

    name: str = "GhostAgent-Alpha"
    signal_interval: int = 300
    default_stake: int = 100
    reveal_delay: int = 60
    max_active_commitments: int = 5
    strategy_type: str = "momentum"
    min_confidence: int = 60
    pairs: list[str] = field(default_factory=lambda: ["BTC/USD", "ETH/USD"])
    api_url: str = "http://localhost:5173"

    @classmethod
    def from_yaml(cls, config_path: str) -> AgentConfig:
        """Load configuration from a YAML file, with env var overrides."""
        config = cls()

        if Path(config_path).exists():
            with open(config_path, "r") as f:
                raw = yaml.safe_load(f)

            if raw and "agent" in raw:
                agent = raw["agent"]
                config.name = agent.get("name", config.name)
                config.signal_interval = agent.get("signal_interval", config.signal_interval)
                config.default_stake = agent.get("default_stake", config.default_stake)
                config.reveal_delay = agent.get("reveal_delay", config.reveal_delay)
                config.max_active_commitments = agent.get("max_active_commitments", config.max_active_commitments)

            if raw and "strategy" in raw:
                strategy = raw["strategy"]
                config.strategy_type = strategy.get("type", config.strategy_type)
                config.min_confidence = strategy.get("min_confidence", config.min_confidence)
                config.pairs = strategy.get("pairs", config.pairs)

            if raw and "network" in raw:
                network = raw["network"]
                config.api_url = network.get("api_url", config.api_url)

        # Environment variable overrides
        config.api_url = os.getenv("GHOSTSIGNAL_API_URL", config.api_url)
        config.default_stake = int(os.getenv("STAKE_AMOUNT", str(config.default_stake)))
        config.reveal_delay = int(os.getenv("REVEAL_DELAY_SECONDS", str(config.reveal_delay)))

        return config


@dataclass
class ActiveCommitment:
    """Tracks an active commitment awaiting reveal."""

    commitment_id: str
    commitment_hash: str
    salt: str
    signal: dict
    stake: int
    committed_at: float
    reveal_after: float


class GhostAgent:
    """
    Main AI trading agent for the GhostSignal marketplace.

    Lifecycle:
      1. generate_signal() → Creates a BUY/SELL signal from market data
      2. create_commitment() → Hashes the signal with a salt
      3. submit_commitment() → Sends the hash on-chain via the frontend API
      4. (wait for reveal period)
      5. reveal_signal() → Reveals the original signal on-chain
    """

    def __init__(self, config: AgentConfig) -> None:
        self.config = config
        self.strategy = self._create_strategy(config.strategy_type)
        self.commit_reveal = CommitReveal()
        self.client = MidnightClient(config.api_url)
        self.active_commitments: list[ActiveCommitment] = []
        self.total_committed: int = 0
        self.total_revealed: int = 0
        self.total_verified: int = 0

        logger.info(f"GhostAgent '{config.name}' initialized with {config.strategy_type} strategy")

    @staticmethod
    def _create_strategy(strategy_type: str) -> TradingStrategy:
        """Factory for trading strategy instances."""
        strategies: dict[str, type[TradingStrategy]] = {
            "momentum": MomentumStrategy,
            "mean_reversion": MeanReversionStrategy,
            "random": RandomStrategy,
        }
        cls = strategies.get(strategy_type, RandomStrategy)
        return cls()

    def generate_signal(self, market_data: dict) -> dict:
        """
        Generate a BUY/SELL signal from market data using the configured strategy.

        Args:
            market_data: Dict containing price history, volume, etc.

        Returns:
            Signal dict with direction, pair, target_price, confidence, timestamp.
        """
        signal = self.strategy.analyze(market_data)
        logger.info(
            f"Generated signal: {signal['direction']} {signal['pair']} "
            f"@ {signal['target_price']} (confidence: {signal['confidence']}%)"
        )
        return signal

    def create_commitment(self, signal: dict) -> tuple[str, str]:
        """
        Create a cryptographic commitment: H(signal || salt).

        The signal is JSON-serialized with sorted keys, concatenated with a
        random 32-byte salt, then SHA-256 hashed. This ensures:
          - The commitment is binding (can't change the signal after committing)
          - The commitment is hiding (salt prevents brute-force guessing)

        Args:
            signal: The trading signal dict to commit.

        Returns:
            Tuple of (commitment_hash, salt) both as hex strings.
        """
        commitment_hash, salt = self.commit_reveal.create_commitment(signal)
        logger.info(f"Created commitment: {commitment_hash[:16]}... (salt: {salt[:8]}...)")
        return commitment_hash, salt

    def submit_commitment(self, commitment_hash: str, stake: int) -> Optional[str]:
        """
        Submit a commitment hash on-chain via the frontend API.

        Args:
            commitment_hash: The SHA-256 hash to commit.
            stake: Amount of tNight to stake on this signal.

        Returns:
            Commitment ID from the chain, or None on failure.
        """
        try:
            result = self.client.commit_signal(commitment_hash, stake)
            commitment_id = result.get("commitment_id", str(self.total_committed))

            self.total_committed += 1
            logger.info(f"Submitted commitment #{commitment_id} with stake {stake}")
            return commitment_id

        except Exception as e:
            logger.error(f"Failed to submit commitment: {e}")
            return None

    def reveal_signal(self, commitment_id: str, signal: dict, salt: str) -> Optional[dict]:
        """
        Reveal a previously committed signal on-chain.

        The chain will verify that H(signal || salt) matches the original
        commitment hash. If valid, the reveal is recorded and the agent's
        score can be updated.

        Args:
            commitment_id: The on-chain commitment ID.
            signal: The original signal data.
            salt: The salt used in the commitment.

        Returns:
            Reveal result from the chain, or None on failure.
        """
        try:
            result = self.client.reveal_signal(commitment_id, signal, salt)
            self.total_revealed += 1
            logger.info(f"Revealed signal for commitment #{commitment_id}")
            return result

        except Exception as e:
            logger.error(f"Failed to reveal signal: {e}")
            return None

    async def run_cycle(self, market_data: dict) -> None:
        """
        Run one complete signal generation + commitment cycle.

        Steps:
          1. Check if we can accept new commitments
          2. Generate a signal from market data
          3. Filter by confidence threshold
          4. Create commitment and submit on-chain
          5. Schedule reveal for later
        """
        # Check commitment limit
        if len(self.active_commitments) >= self.config.max_active_commitments:
            logger.warning(
                f"Max active commitments ({self.config.max_active_commitments}) reached, skipping cycle"
            )
            return

        # Generate signal
        signal = self.generate_signal(market_data)

        # Filter by confidence
        if signal["confidence"] < self.config.min_confidence:
            logger.info(
                f"Signal confidence {signal['confidence']}% below threshold "
                f"{self.config.min_confidence}%, skipping"
            )
            return

        # Create and submit commitment
        commitment_hash, salt = self.create_commitment(signal)
        commitment_id = self.submit_commitment(commitment_hash, self.config.default_stake)

        if commitment_id is not None:
            now = time.time()
            self.active_commitments.append(
                ActiveCommitment(
                    commitment_id=commitment_id,
                    commitment_hash=commitment_hash,
                    salt=salt,
                    signal=signal,
                    stake=self.config.default_stake,
                    committed_at=now,
                    reveal_after=now + self.config.reveal_delay,
                )
            )

    async def process_reveals(self) -> None:
        """Process any commitments that are ready to be revealed."""
        now = time.time()
        ready = [c for c in self.active_commitments if now >= c.reveal_after]

        for commitment in ready:
            result = self.reveal_signal(commitment.commitment_id, commitment.signal, commitment.salt)
            if result is not None:
                self.active_commitments.remove(commitment)
                logger.info(
                    f"Processed reveal for commitment #{commitment.commitment_id}"
                )

    async def run(self) -> None:
        """Main agent loop: generate signals, submit commitments, process reveals."""
        logger.info(f"Starting {self.config.name} — monitoring {self.config.pairs}")

        while True:
            try:
                # Process pending reveals first
                await self.process_reveals()

                # Generate new signals for each pair
                for pair in self.config.pairs:
                    market_data = self.client.get_market_data(pair)
                    if market_data:
                        await self.run_cycle(market_data)

                # Wait for next cycle
                logger.info(
                    f"Cycle complete. Active commitments: {len(self.active_commitments)}. "
                    f"Next cycle in {self.config.signal_interval}s"
                )
                await asyncio.sleep(self.config.signal_interval)

            except KeyboardInterrupt:
                logger.info("Agent stopped by user")
                break
            except Exception as e:
                logger.error(f"Error in agent loop: {e}", exc_info=True)
                await asyncio.sleep(30)

    def get_stats(self) -> dict:
        """Get agent performance statistics."""
        return {
            "name": self.config.name,
            "total_committed": self.total_committed,
            "total_revealed": self.total_revealed,
            "total_verified": self.total_verified,
            "active_commitments": len(self.active_commitments),
            "win_rate": (
                (self.total_verified / self.total_revealed * 100)
                if self.total_revealed > 0
                else 0.0
            ),
        }


def main() -> None:
    """Entry point for the GhostSignal agent."""
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )

    config_path = str(Path(__file__).parent.parent / "config" / "agent_config.yaml")
    config = AgentConfig.from_yaml(config_path)
    agent = GhostAgent(config)

    asyncio.run(agent.run())


if __name__ == "__main__":
    main()
