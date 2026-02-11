"""
Unit tests for the GhostSignal Python agent.

Covers:
  - CommitReveal hashing & verification
  - Strategy signal generation
  - GhostAgent lifecycle (mocked network calls)
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

from src.commit_reveal import CommitReveal
from src.strategy import MomentumStrategy, MeanReversionStrategy, RandomStrategy
from src.ghost_agent import GhostAgent


# ---------------------------------------------------------------------------
# CommitReveal
# ---------------------------------------------------------------------------

class TestCommitReveal:
    """Tests for the commit-reveal cryptography module."""

    def test_generate_salt_length(self) -> None:
        salt = CommitReveal.generate_salt()
        # 32 random bytes → 64 hex chars
        assert len(salt) == 64
        assert all(c in "0123456789abcdef" for c in salt)

    def test_generate_salt_unique(self) -> None:
        salts = {CommitReveal.generate_salt() for _ in range(50)}
        assert len(salts) == 50, "Salts should be unique"

    def test_create_and_verify_commitment(self) -> None:
        signal = {"pair": "BTC/USD", "direction": "buy", "confidence": 0.85}
        salt = CommitReveal.generate_salt()
        commitment = CommitReveal.create_commitment(signal, salt)

        assert isinstance(commitment, str)
        assert len(commitment) == 64  # SHA-256 hex digest

        assert CommitReveal.verify_commitment(signal, salt, commitment) is True

    def test_verify_commitment_wrong_salt(self) -> None:
        signal = {"pair": "BTC/USD", "direction": "sell", "confidence": 0.9}
        salt = CommitReveal.generate_salt()
        wrong_salt = CommitReveal.generate_salt()
        commitment = CommitReveal.create_commitment(signal, salt)

        assert CommitReveal.verify_commitment(signal, wrong_salt, commitment) is False

    def test_verify_commitment_wrong_signal(self) -> None:
        signal = {"pair": "BTC/USD", "direction": "buy", "confidence": 0.85}
        salt = CommitReveal.generate_salt()
        commitment = CommitReveal.create_commitment(signal, salt)

        tampered = {"pair": "BTC/USD", "direction": "sell", "confidence": 0.85}
        assert CommitReveal.verify_commitment(tampered, salt, commitment) is False

    def test_deterministic_hash(self) -> None:
        """Same inputs must always produce the same hash."""
        signal = {"direction": "buy", "pair": "ETH/USD", "confidence": 0.7}
        salt = "deadbeef" * 8  # fixed salt
        h1 = CommitReveal.create_commitment(signal, salt)
        h2 = CommitReveal.create_commitment(signal, salt)
        assert h1 == h2

    def test_sorted_key_order(self) -> None:
        """Key order in the dict should not matter (sorted internally)."""
        salt = "cafebabe" * 8
        sig_a = {"pair": "BTC/USD", "direction": "buy", "confidence": 0.5}
        sig_b = {"confidence": 0.5, "direction": "buy", "pair": "BTC/USD"}
        assert CommitReveal.create_commitment(sig_a, salt) == CommitReveal.create_commitment(sig_b, salt)

    def test_hash_signal_raw(self) -> None:
        raw = CommitReveal.hash_signal("hello")
        assert len(raw) == 64


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

class TestStrategies:
    """Tests for the trading strategy implementations."""

    def _make_market_data(self, prices: list[float]) -> dict:
        return {
            "pair": "BTC/USD",
            "prices": prices,
            "volumes": [100.0] * len(prices),
            "current_price": prices[-1],
            "timestamp": "2025-01-01T00:00:00Z",
        }

    def test_momentum_rising_prices(self) -> None:
        strat = MomentumStrategy()
        data = self._make_market_data([float(i) for i in range(1, 31)])
        sig = strat.generate_signal(data)
        assert sig["pair"] == "BTC/USD"
        assert sig["direction"] in ("buy", "sell", "hold")
        assert 0.0 <= sig["confidence"] <= 1.0
        assert sig["strategy_type"] == "momentum"

    def test_mean_reversion_signal(self) -> None:
        strat = MeanReversionStrategy()
        # Stable prices then a spike → should lean sell
        prices = [100.0] * 28 + [100.0, 120.0]
        data = self._make_market_data(prices)
        sig = strat.generate_signal(data)
        assert sig["direction"] in ("buy", "sell", "hold")
        assert sig["strategy_type"] == "mean_reversion"

    def test_random_strategy_fields(self) -> None:
        strat = RandomStrategy()
        data = self._make_market_data([42.0] * 30)
        sig = strat.generate_signal(data)
        assert "pair" in sig
        assert "direction" in sig
        assert "confidence" in sig
        assert "strategy_type" in sig

    def test_momentum_not_enough_data(self) -> None:
        strat = MomentumStrategy()
        data = self._make_market_data([1.0, 2.0])
        sig = strat.generate_signal(data)
        # Should still return a valid signal (fallback / hold)
        assert sig["direction"] in ("buy", "sell", "hold")


# ---------------------------------------------------------------------------
# GhostAgent (mocked network)
# ---------------------------------------------------------------------------

class TestGhostAgent:
    """Integration-style tests for the GhostAgent with mocked I/O."""

    def _build_agent(self) -> GhostAgent:
        agent = GhostAgent.__new__(GhostAgent)
        agent.agent_id = "test-agent-001"
        agent.pair = "BTC/USD"
        agent.stake = 100
        agent.reveal_delay = 0
        agent.strategy = RandomStrategy()
        agent.client = MagicMock()
        agent.active_commitments = {}
        agent.stats = {
            "total_commitments": 0,
            "total_reveals": 0,
            "successful_verifications": 0,
        }
        return agent

    def test_generate_signal(self) -> None:
        agent = self._build_agent()
        agent.client.get_market_data.return_value = {
            "pair": "BTC/USD",
            "prices": [float(i) for i in range(1, 31)],
            "volumes": [100.0] * 30,
            "current_price": 30.0,
            "timestamp": "2025-01-01T00:00:00Z",
        }
        signal = agent.generate_signal()
        assert signal is not None
        assert "direction" in signal
        assert "pair" in signal

    def test_create_commitment(self) -> None:
        agent = self._build_agent()
        signal = {"pair": "BTC/USD", "direction": "buy", "confidence": 0.8}
        commitment_hash, salt = agent.create_commitment(signal)
        assert len(commitment_hash) == 64
        assert len(salt) == 64
        # Verify round-trip
        assert CommitReveal.verify_commitment(signal, salt, commitment_hash)

    def test_submit_commitment(self) -> None:
        agent = self._build_agent()
        agent.client.commit_signal.return_value = {
            "commitment_id": "c-123",
            "tx_id": "tx-abc",
            "status": "ok",
        }
        signal = {"pair": "BTC/USD", "direction": "buy", "confidence": 0.8}
        commitment_hash, salt = agent.create_commitment(signal)
        cid = agent.submit_commitment(commitment_hash, signal, salt)
        assert cid == "c-123"
        assert cid in agent.active_commitments
        assert agent.stats["total_commitments"] == 1

    def test_reveal_signal(self) -> None:
        agent = self._build_agent()
        # Setup: submit a commitment first
        agent.client.commit_signal.return_value = {
            "commitment_id": "c-456",
            "tx_id": "tx-def",
            "status": "ok",
        }
        agent.client.reveal_signal.return_value = {
            "commitment_id": "c-456",
            "status": "revealed",
            "verified": True,
        }
        signal = {"pair": "BTC/USD", "direction": "sell", "confidence": 0.6}
        h, salt = agent.create_commitment(signal)
        cid = agent.submit_commitment(h, signal, salt)

        # Force reveal delay to 0 so it's immediately eligible
        agent.active_commitments[cid]["timestamp"] = 0
        agent.process_reveals()

        assert agent.stats["total_reveals"] == 1
        assert cid not in agent.active_commitments

    def test_get_stats(self) -> None:
        agent = self._build_agent()
        stats = agent.get_stats()
        assert stats["agent_id"] == "test-agent-001"
        assert stats["total_commitments"] == 0
