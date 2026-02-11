// GhostSignal — Formatting utilities

/**
 * Truncate a hex string for display: "abc123def456" → "abc1...f456"
 */
export const truncateHash = (hash: string, startLen = 6, endLen = 4): string => {
  if (hash.length <= startLen + endLen + 3) return hash;
  return `${hash.slice(0, startLen)}...${hash.slice(-endLen)}`;
};

/**
 * Format a bigint balance with locale separators.
 */
export const formatBalance = (balance: bigint): string => balance.toLocaleString();

/**
 * Format a timestamp as a relative time string ("2 minutes ago", "just now").
 */
export const formatRelativeTime = (isoString: string): string => {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;

  if (diffMs < 60_000) return 'just now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return `${Math.floor(diffMs / 86_400_000)}d ago`;
};

/**
 * Format a percentage with 1 decimal place.
 */
export const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

/**
 * Format a contract address for display.
 */
export const formatContractAddress = (address: string): string => truncateHash(address, 8, 6);
