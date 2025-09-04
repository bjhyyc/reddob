'use client';

import { useState } from 'react';
import { connectBtcWallet, createFundingTx } from '@/lib/joyid/bitcoin';
import psbtGuard from '@/lib/psbtGuard';

export default function TestPsbtPage() {
  const [address, setAddress] = useState('');
  const [txResult, setTxResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [testResults, setTestResults] = useState<string[]>([]);

  const connectWallet = async () => {
    try {
      setError('');
      setLoading(true);
      const result = await connectBtcWallet();
      setAddress(result.address);
      addTestResult(`✅ Wallet connected: ${result.address}`);
    } catch (err) {
      setError(`Failed to connect: ${err.message}`);
      addTestResult(`❌ Wallet connection failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addTestResult = (message: string) => {
    setTestResults(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const testPsbtGuard = () => {
    addTestResult('🧪 Testing PSBT Guard...');
    
    // Test 1: Valid base64 PSBT
    const validBase64 = 'cHNidP8BAHUCAAAAAaQJJZ3VaQI0W8F5XAuPNmNt9g/2dYt8wH3GZMD8ER6CAAAAAAD/////AuDIAAAAAAAAFgAUQRjWTApIjv2Z8VKNbwhqrx8CdKmAGgYAAAAAABYAFLtqB6sWVXPCMiU6A7ifXrWV9Y6nAAAAAAABASuAlAEAAAAAABYAFHFPZUJvNJFKvDXLxLdkZW7d/VQNAAA=';
    const result1 = psbtGuard.toHex(validBase64);
    if (result1.isValid) {
      addTestResult(`✅ Test 1 passed: Base64 converted to hex`);
      addTestResult(`   Hex prefix: ${result1.psbtHex.substring(0, 16)}...`);
    } else {
      addTestResult(`❌ Test 1 failed: ${result1.error}`);
    }

    // Test 2: Already hex format
    const validHex = '70736274ff01007502000000a409259dd569023458c1795c0b8f36636df60ff6758b7cc07dc664c0fc111e8200000000ffffffffff02e0c8000000000016001441c5d4c0a488efdd9f1528d6f086aaf1f0274a980061a0600000000160014bb6a07ab165573c232253a03b89f5eb595f58ea700000000010112b80940100000000160014714f65426f349144bc32cbc4b764656edfd5443d0000';
    const result2 = psbtGuard.toHex(validHex);
    if (result2.isValid) {
      addTestResult(`✅ Test 2 passed: Hex format recognized`);
    } else {
      addTestResult(`❌ Test 2 failed: ${result2.error}`);
    }

    // Test 3: Invalid data
    const invalidData = 'not-a-valid-psbt';
    const result3 = psbtGuard.toHex(invalidData);
    if (!result3.isValid) {
      addTestResult(`✅ Test 3 passed: Invalid data rejected`);
      addTestResult(`   Error: ${result3.error}`);
    } else {
      addTestResult(`❌ Test 3 failed: Invalid data was accepted`);
    }

    addTestResult('✅ PSBT Guard tests completed');
  };

  const testRealTransaction = async () => {
    if (!address) {
      setError('Please connect wallet first');
      return;
    }

    try {
      setError('');
      setLoading(true);
      addTestResult('🚀 Creating test transaction...');
      
      // Create a small test transaction (0.0001 BTC)
      const amountSats = BigInt(10000);
      const result = await createFundingTx(amountSats, '5247422b2b01'); // RGB++ tag
      
      setTxResult(result);
      addTestResult(`✅ Transaction created successfully!`);
      addTestResult(`   TXID: ${result.txid}`);
      addTestResult(`   Output index: ${result.vout}`);
      addTestResult(`   View on Mempool: https://mempool.space/testnet/tx/${result.txid}`);
      
    } catch (err) {
      setError(`Transaction failed: ${err.message}`);
      addTestResult(`❌ Transaction failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">PSBT Guard Test Page</h1>
      
      <div className="space-y-4">
        {/* Wallet Connection */}
        <div className="border rounded p-4">
          <h2 className="font-bold mb-2">Step 1: Connect Wallet</h2>
          <button
            onClick={connectWallet}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            {loading ? 'Connecting...' : 'Connect JoyID'}
          </button>
          {address && (
            <div className="mt-2 text-sm">
              <span className="font-mono bg-gray-100 p-1 rounded">{address}</span>
            </div>
          )}
        </div>

        {/* PSBT Guard Tests */}
        <div className="border rounded p-4">
          <h2 className="font-bold mb-2">Step 2: Test PSBT Guard</h2>
          <button
            onClick={testPsbtGuard}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            Run PSBT Guard Tests
          </button>
        </div>

        {/* Real Transaction Test */}
        <div className="border rounded p-4">
          <h2 className="font-bold mb-2">Step 3: Test Real Transaction</h2>
          <button
            onClick={testRealTransaction}
            disabled={loading || !address}
            className="px-4 py-2 bg-purple-500 text-white rounded disabled:opacity-50"
          >
            {loading ? 'Creating Transaction...' : 'Create Test Transaction (0.0001 BTC)'}
          </button>
          {txResult && (
            <div className="mt-2 text-sm">
              <div>TXID: <span className="font-mono bg-gray-100 p-1 rounded">{txResult.txid}</span></div>
              <a 
                href={`https://mempool.space/testnet/tx/${txResult.txid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                View on Mempool →
              </a>
            </div>
          )}
        </div>

        {/* Test Results Log */}
        <div className="border rounded p-4 bg-black text-green-400">
          <h2 className="font-bold mb-2 text-white">Test Results:</h2>
          <div className="font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
            {testResults.map((result, i) => (
              <div key={i}>{result}</div>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="border border-red-500 rounded p-4 bg-red-50">
            <p className="text-red-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}