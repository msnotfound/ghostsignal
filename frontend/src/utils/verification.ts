// GhostSignal — Verification utilities
// Client-side cryptographic operations for the commit-reveal protocol.

/**
 * Create a SHA-256 commitment hash from signal data and a random salt.
 * Commitment = SHA-256(JSON.stringify(signal, sorted keys) + salt)
 *
 * @param signal - The signal data to commit
 * @param salt - Optional hex salt (generated if not provided)
 * @returns The commitment hash and salt used
 */
export const createCommitmentHash = async (
  signal: Record<string, unknown>,
  salt?: string,
): Promise<{ hash: string; salt: string }> => {
  const actualSalt =
    salt ??
    Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

  const payload = JSON.stringify(signal, Object.keys(signal).sort()) + actualSalt;
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return { hash, salt: actualSalt };
};

/**
 * Verify a commitment by recomputing the hash from the revealed signal and salt.
 * Returns true if H(signal || salt) matches the original commitment hash.
 *
 * @param commitmentHash - The original commitment hash from the chain
 * @param signal - The revealed signal data
 * @param salt - The revealed salt
 * @returns Whether the commitment is valid
 */
export const verifyCommitment = async (
  commitmentHash: string,
  signal: Record<string, unknown>,
  salt: string,
): Promise<boolean> => {
  const { hash } = await createCommitmentHash(signal, salt);
  return hash === commitmentHash;
};

/**
 * Generate a random 32-byte salt as a hex string.
 */
export const generateSalt = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

/**
 * Validate that a string is a valid 64-character hex hash.
 */
export const isValidHash = (hash: string): boolean => /^[0-9a-f]{64}$/i.test(hash);
