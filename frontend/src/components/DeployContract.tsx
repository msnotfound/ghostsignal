// GhostSignal — DeployContract component
// Replaces: CLI deploy/join menu from example-counter/counter-cli/src/cli.ts
//
// The CLI flow was:
//   Choice: [1] Deploy new | [2] Join existing → enter address
//
// This React component provides the same flow visually:
//   [Button] Deploy New Marketplace Contract
//   [Text input] Contract Address
//   [Button] Join Existing Contract
//   [Status] Deploying... / Deployed at: 0x...

import { useState, useCallback } from 'react';
import { deploy, joinContract } from '../services/midnight';
import type { MarketplaceProviders, DeployedMarketplaceContract } from '../types/common-types';

interface DeployContractProps {
  providers: MarketplaceProviders;
  onContractReady: (contract: DeployedMarketplaceContract, address: string) => void;
}

type DeployStatus = 'idle' | 'deploying' | 'joining' | 'ready' | 'error';

export default function DeployContract({ providers, onContractReady }: DeployContractProps) {
  const [contractAddress, setContractAddress] = useState('');
  const [status, setStatus] = useState<DeployStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');

  /**
   * Deploy a new marketplace contract.
   * Mirrors: the deploy path in CLI menu → calls deploy() from api.ts
   */
  const handleDeploy = useCallback(async () => {
    setError('');
    setStatus('deploying');
    setStatusMessage('Deploying marketplace contract... (this may take a few minutes)');

    try {
      const contract = await deploy(providers);
      const address = contract.deployTxData.public.contractAddress;
      setStatus('ready');
      setStatusMessage(`Deployed at: ${address}`);
      onContractReady(contract, address);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Deployment failed');
      setStatusMessage('');
    }
  }, [providers, onContractReady]);

  /**
   * Join an existing marketplace contract by address.
   * Mirrors: the join path in CLI menu → calls joinContract() from api.ts
   */
  const handleJoin = useCallback(async () => {
    const address = contractAddress.trim();
    if (!address) {
      setError('Please enter a contract address');
      return;
    }

    setError('');
    setStatus('joining');
    setStatusMessage(`Joining contract at ${address}...`);

    try {
      const contract = await joinContract(providers, address);
      const deployedAddress = contract.deployTxData.public.contractAddress;
      setStatus('ready');
      setStatusMessage(`Joined contract at: ${deployedAddress}`);
      onContractReady(contract, deployedAddress);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to join contract');
      setStatusMessage('');
    }
  }, [contractAddress, providers, onContractReady]);

  const isWorking = status === 'deploying' || status === 'joining';

  return (
    <div className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
      <h2 className="card-title">📜 Contract Setup</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: '0.9rem' }}>
        Deploy a new GhostSignal marketplace contract or join an existing one.
      </p>

      {/* Deploy new contract */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: '1rem', marginBottom: 12, color: 'var(--accent-green)' }}>
          🚀 Deploy New Contract
        </h3>
        <button className="btn btn-success" onClick={handleDeploy} disabled={isWorking}>
          {status === 'deploying' ? (
            <>
              <span className="spinner" /> Deploying...
            </>
          ) : (
            'Deploy Marketplace Contract'
          )}
        </button>
      </div>

      {/* Divider */}
      <div
        style={{
          borderTop: '1px solid var(--border)',
          margin: '24px 0',
          position: 'relative',
          textAlign: 'center',
        }}
      >
        <span
          style={{
            position: 'relative',
            top: -10,
            background: 'var(--bg-card)',
            padding: '0 12px',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
          }}
        >
          OR
        </span>
      </div>

      {/* Join existing contract */}
      <div>
        <h3 style={{ fontSize: '1rem', marginBottom: 12, color: 'var(--accent-blue)' }}>
          🔗 Join Existing Contract
        </h3>
        <div className="form-group">
          <label htmlFor="contract-address">Contract Address</label>
          <input
            id="contract-address"
            type="text"
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
            placeholder="Enter contract address (0x...)"
            disabled={isWorking}
          />
        </div>
        <button className="btn btn-primary" onClick={handleJoin} disabled={isWorking || !contractAddress.trim()}>
          {status === 'joining' ? (
            <>
              <span className="spinner" /> Joining...
            </>
          ) : (
            'Join Contract'
          )}
        </button>
      </div>

      {/* Status display */}
      {statusMessage && status !== 'error' && (
        <div className={`status ${status === 'ready' ? 'status-success' : 'status-syncing'}`}>
          {isWorking && <span className="spinner" />}
          {status === 'ready' && '✓'}
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="status status-error">
          <span>✗ {error}</span>
        </div>
      )}
    </div>
  );
}
