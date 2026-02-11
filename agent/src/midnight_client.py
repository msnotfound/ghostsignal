"""
GhostSignal — Midnight network HTTP client.

Makes HTTP calls to the GhostSignal frontend API and/or directly to the
Midnight indexer to submit commitments, reveal signals, and query state.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Optional

import requests

logger = logging.getLogger(__name__)


class MidnightClient:
    """
    HTTP client for interacting with the GhostSignal marketplace.

    In production, this communicates with:
      1. The frontend API (for commitment/reveal operations that go through the wallet)
      2. The Midnight indexer directly (for read-only queries)
    """

    def __init__(self, api_url: str, timeout: int = 30) -> None:
        self.api_url = api_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "User-Agent": "GhostSignal-Agent/1.0",
        })

    def commit_signal(self, commitment_hash: str, stake: int) -> dict:
        """
        Submit a commitment hash on-chain via the frontend API.

        Args:
            commitment_hash: SHA-256 hash of (signal || salt).
            stake: Amount of tNight to stake.

        Returns:
            Response dict with commitment_id and tx details.
        """
        payload = {
            "commitment_hash": commitment_hash,
            "stake_amount": stake,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

        try:
            response = self.session.post(
                f"{self.api_url}/api/commit",
                json=payload,
                timeout=self.timeout,
            )
            response.raise_for_status()
            result = response.json()
            logger.info(f"Commitment submitted: {result}")
            return result

        except requests.exceptions.ConnectionError:
            logger.warning("Frontend API not reachable — running in offline mode")
            # Return a mock response for offline development
            return {
                "commitment_id": str(int(time.time())),
                "tx_id": "offline-mock",
                "status": "offline",
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to submit commitment: {e}")
            raise

    def reveal_signal(self, commitment_id: str, signal: dict, salt: str) -> dict:
        """
        Reveal a previously committed signal on-chain.

        Args:
            commitment_id: The on-chain commitment ID.
            signal: The original signal data.
            salt: The salt used in the commitment.

        Returns:
            Response dict with reveal status.
        """
        payload = {
            "commitment_id": commitment_id,
            "signal": signal,
            "salt": salt,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

        try:
            response = self.session.post(
                f"{self.api_url}/api/reveal",
                json=payload,
                timeout=self.timeout,
            )
            response.raise_for_status()
            result = response.json()
            logger.info(f"Signal revealed: {result}")
            return result

        except requests.exceptions.ConnectionError:
            logger.warning("Frontend API not reachable — running in offline mode")
            return {
                "commitment_id": commitment_id,
                "status": "offline",
                "verified": False,
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to reveal signal: {e}")
            raise

    def get_market_data(self, pair: str) -> Optional[dict]:
        """
        Fetch market data for a trading pair.

        In production, this would query a price oracle or exchange API.
        For development, returns synthetic data.

        Args:
            pair: Trading pair string (e.g., "BTC/USD").

        Returns:
            Market data dict with prices, volumes, etc.
        """
        # TODO: Integrate with a real price feed (CoinGecko, Binance, etc.)
        # For now, generate synthetic price data for development
        import random

        base_prices = {
            "BTC/USD": 65000.0,
            "ETH/USD": 3500.0,
            "SOL/USD": 150.0,
        }

        base = base_prices.get(pair, 1000.0)
        prices = [base * (1 + random.gauss(0, 0.02)) for _ in range(30)]
        volumes = [random.uniform(100, 10000) for _ in range(30)]

        return {
            "pair": pair,
            "prices": prices,
            "volumes": volumes,
            "current_price": prices[-1],
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

    def get_marketplace_stats(self) -> Optional[dict]:
        """
        Query marketplace statistics from the frontend API.

        Returns:
            Marketplace stats dict, or None on failure.
        """
        try:
            response = self.session.get(
                f"{self.api_url}/api/stats",
                timeout=self.timeout,
            )
            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException:
            logger.debug("Could not fetch marketplace stats (API may be offline)")
            return None
