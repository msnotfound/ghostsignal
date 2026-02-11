// GhostSignal — useContract hook
// Wraps the midnight.ts service for React components.

import { useState, useCallback } from 'react';
import {
  configureProviders,
  deploy,
  joinContract,
  commitSignal,
  revealSignal,
  verifySignal,
  registerAgent,
  getMarketplaceLedgerState,
} from '../services/midnight';
import type { WalletContext } from '../services/wallet';
import type { Config } from '../services/config';
import type { MarketplaceProviders, DeployedMarketplaceContract } from '../types/common-types';
import type { MarketplaceStats } from '../types';
import type { FinalizedTxData } from '@midnight-ntwrk/midnight-js-types';

type ContractStatus = 'idle' | 'configuring' | 'deploying' | 'joining' | 'ready' | 'error';

export function useContract() {
  const [providers, setProviders] = useState<MarketplaceProviders | null>(null);
  const [contract, setContract] = useState<DeployedMarketplaceContract | null>(null);
  const [contractAddress, setContractAddress] = useState<string>('');
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [status, setStatus] = useState<ContractStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  /** Configure providers (must be called first) */
  const configure = useCallback(async (walletContext: WalletContext, config: Config) => {
    setStatus('configuring');
    try {
      const prov = await configureProviders(walletContext, config);
      setProviders(prov);
      setStatus('idle');
      return prov;
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to configure providers');
      throw err;
    }
  }, []);

  /** Deploy a new contract */
  const deployContract = useCallback(async () => {
    if (!providers) throw new Error('Providers not configured');
    setStatus('deploying');
    setError(null);
    try {
      const deployed = await deploy(providers);
      const address = deployed.deployTxData.public.contractAddress;
      setContract(deployed);
      setContractAddress(address);
      setStatus('ready');
      return { contract: deployed, address };
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Deployment failed');
      throw err;
    }
  }, [providers]);

  /** Join an existing contract */
  const join = useCallback(
    async (address: string) => {
      if (!providers) throw new Error('Providers not configured');
      setStatus('joining');
      setError(null);
      try {
        const found = await joinContract(providers, address);
        setContract(found);
        setContractAddress(found.deployTxData.public.contractAddress);
        setStatus('ready');
        return found;
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to join contract');
        throw err;
      }
    },
    [providers],
  );

  /** Commit a signal (no parameters per contract spec) */
  const commit = useCallback(async (): Promise<FinalizedTxData> => {
    if (!contract) throw new Error('Contract not deployed');
    return commitSignal(contract);
  }, [contract]);

  /** Reveal a signal */
  const reveal = useCallback(async (): Promise<FinalizedTxData> => {
    if (!contract) throw new Error('Contract not deployed');
    return revealSignal(contract);
  }, [contract]);

  /** Verify a signal */
  const verify = useCallback(async (): Promise<FinalizedTxData> => {
    if (!contract) throw new Error('Contract not deployed');
    return verifySignal(contract);
  }, [contract]);

  /** Register as agent */
  const register = useCallback(async (): Promise<FinalizedTxData> => {
    if (!contract) throw new Error('Contract not deployed');
    return registerAgent(contract);
  }, [contract]);

  /** Refresh marketplace stats */
  const refreshStats = useCallback(async () => {
    if (!providers || !contractAddress) return null;
    try {
      const result = await getMarketplaceLedgerState(providers, contractAddress);
      if (result) setStats(result);
      return result;
    } catch (err) {
      console.error('Failed to refresh stats:', err);
      return null;
    }
  }, [providers, contractAddress]);

  return {
    providers,
    contract,
    contractAddress,
    stats,
    status,
    error,
    configure,
    deployContract,
    join,
    commit,
    reveal,
    verify,
    register,
    refreshStats,
  };
}
