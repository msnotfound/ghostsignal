"""
GhostSignal — Trading strategy implementations.

Each strategy analyzes market data and produces a trading signal.
Strategies are pluggable via the TradingStrategy base class.
"""

from __future__ import annotations

import random
import time
from abc import ABC, abstractmethod
from typing import Optional


class TradingStrategy(ABC):
    """Base class for trading strategies."""

    @abstractmethod
    def analyze(self, market_data: dict) -> dict:
        """
        Analyze market data and produce a trading signal.

        Args:
            market_data: Dict with keys like 'pair', 'prices', 'volumes', 'timestamp'.

        Returns:
            Signal dict with:
              - direction: "BUY" or "SELL"
              - pair: Trading pair string
              - target_price: Predicted target price
              - confidence: 0-100 confidence score
              - timestamp: ISO format timestamp
        """
        ...


class MomentumStrategy(TradingStrategy):
    """
    Momentum strategy: BUY when price is trending up, SELL when trending down.
    Uses simple moving average crossover with configurable lookback.
    """

    def __init__(self, lookback: int = 14) -> None:
        self.lookback = lookback

    def analyze(self, market_data: dict) -> dict:
        pair: str = market_data.get("pair", "BTC/USD")
        prices: list[float] = market_data.get("prices", [])
        current_price: float = prices[-1] if prices else 50000.0

        if len(prices) >= self.lookback:
            short_ma = sum(prices[-self.lookback // 2 :]) / (self.lookback // 2)
            long_ma = sum(prices[-self.lookback :]) / self.lookback

            if short_ma > long_ma:
                direction = "BUY"
                # Confidence based on MA spread
                spread = (short_ma - long_ma) / long_ma * 100
                confidence = min(95, int(50 + spread * 10))
                target_price = current_price * 1.02  # 2% above current
            else:
                direction = "SELL"
                spread = (long_ma - short_ma) / long_ma * 100
                confidence = min(95, int(50 + spread * 10))
                target_price = current_price * 0.98  # 2% below current
        else:
            # Not enough data — low-confidence signal
            direction = "BUY" if random.random() > 0.5 else "SELL"
            confidence = random.randint(30, 50)
            target_price = current_price * (1.01 if direction == "BUY" else 0.99)

        return {
            "direction": direction,
            "pair": pair,
            "target_price": round(target_price, 2),
            "confidence": confidence,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }


class MeanReversionStrategy(TradingStrategy):
    """
    Mean reversion strategy: BUY when price is below average, SELL when above.
    Assumes prices will revert to the mean.
    """

    def __init__(self, lookback: int = 20, threshold: float = 2.0) -> None:
        self.lookback = lookback
        self.threshold = threshold  # Standard deviations from mean

    def analyze(self, market_data: dict) -> dict:
        pair: str = market_data.get("pair", "BTC/USD")
        prices: list[float] = market_data.get("prices", [])
        current_price: float = prices[-1] if prices else 50000.0

        if len(prices) >= self.lookback:
            mean = sum(prices[-self.lookback :]) / self.lookback
            variance = sum((p - mean) ** 2 for p in prices[-self.lookback :]) / self.lookback
            std_dev = variance**0.5

            if std_dev > 0:
                z_score = (current_price - mean) / std_dev
            else:
                z_score = 0.0

            if z_score < -self.threshold:
                direction = "BUY"  # Price below mean → expect reversion up
                confidence = min(95, int(50 + abs(z_score) * 15))
                target_price = mean
            elif z_score > self.threshold:
                direction = "SELL"  # Price above mean → expect reversion down
                confidence = min(95, int(50 + abs(z_score) * 15))
                target_price = mean
            else:
                # Within normal range — low confidence
                direction = "BUY" if z_score < 0 else "SELL"
                confidence = random.randint(20, 45)
                target_price = mean
        else:
            direction = "BUY" if random.random() > 0.5 else "SELL"
            confidence = random.randint(20, 40)
            target_price = current_price

        return {
            "direction": direction,
            "pair": pair,
            "target_price": round(target_price, 2),
            "confidence": confidence,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }


class RandomStrategy(TradingStrategy):
    """
    Random strategy: Generates signals with random direction.
    Useful for testing and as a baseline.
    """

    def analyze(self, market_data: dict) -> dict:
        pair: str = market_data.get("pair", "BTC/USD")
        prices: list[float] = market_data.get("prices", [])
        current_price: float = prices[-1] if prices else 50000.0

        direction = "BUY" if random.random() > 0.5 else "SELL"
        confidence = random.randint(40, 80)
        multiplier = 1.0 + random.uniform(-0.03, 0.03)
        target_price = current_price * multiplier

        return {
            "direction": direction,
            "pair": pair,
            "target_price": round(target_price, 2),
            "confidence": confidence,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
