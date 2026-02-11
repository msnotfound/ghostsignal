"""
GhostSignal — Commit-reveal cryptographic operations.

Implements the commitment scheme:
  commitment = SHA-256(JSON.stringify(signal, sorted_keys) + salt)

This matches the TypeScript implementation in frontend/src/utils/verification.ts,
ensuring cross-language compatibility for on-chain verification.
"""

from __future__ import annotations

import hashlib
import json
import os
from typing import Optional


class CommitReveal:
    """
    Handles cryptographic commitment creation and verification.

    The commitment scheme:
      1. Serialize signal as JSON with sorted keys
      2. Concatenate with a random 32-byte hex salt
      3. SHA-256 hash the concatenation
      4. The hash is the commitment; the salt is kept secret until reveal
    """

    @staticmethod
    def generate_salt() -> str:
        """Generate a random 32-byte salt as a hex string."""
        return os.urandom(32).hex()

    @staticmethod
    def create_commitment(signal: dict, salt: Optional[str] = None) -> tuple[str, str]:
        """
        Create a commitment hash: H(signal || salt).

        Args:
            signal: The trading signal dict to commit.
            salt: Optional hex salt (generated if not provided).

        Returns:
            Tuple of (commitment_hash, salt) both as hex strings.
        """
        if salt is None:
            salt = os.urandom(32).hex()

        # Serialize signal with sorted keys (matches JS: JSON.stringify(signal, Object.keys(signal).sort()))
        payload = json.dumps(signal, sort_keys=True) + salt
        commitment = hashlib.sha256(payload.encode("utf-8")).hexdigest()

        return commitment, salt

    @staticmethod
    def verify_commitment(commitment_hash: str, signal: dict, salt: str) -> bool:
        """
        Verify a commitment by recomputing H(signal || salt).

        Args:
            commitment_hash: The original commitment hash.
            signal: The revealed signal data.
            salt: The revealed salt.

        Returns:
            True if the recomputed hash matches the commitment.
        """
        payload = json.dumps(signal, sort_keys=True) + salt
        recomputed = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        return recomputed == commitment_hash

    @staticmethod
    def hash_signal(signal: dict, salt: str) -> str:
        """
        Compute the SHA-256 hash of a signal with a salt.

        Args:
            signal: The signal dict.
            salt: The hex salt.

        Returns:
            The hex-encoded SHA-256 hash.
        """
        payload = json.dumps(signal, sort_keys=True) + salt
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()
