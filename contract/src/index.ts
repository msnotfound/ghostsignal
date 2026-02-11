// GhostSignal — Contract re-exports
// Mirrors: example-counter/contract/src/index.ts
//
// example-counter does:
//   export * as Counter from "./managed/counter/contract/index.js";
//   export * from "./witnesses";
//
// We follow the exact same pattern, pointing to the Compact-compiled output
// for ghost-marketplace instead of counter.

export * as GhostMarketplace from './managed/ghost-marketplace/contract/index.js';
export * from './witnesses';
