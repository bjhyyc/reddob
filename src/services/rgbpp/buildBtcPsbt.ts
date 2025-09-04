/**
 * RGB++ BTC PSBT Builder
 * Creates BTC PSBTs based on virtual CKB transactions
 */

import * as bitcoin from 'bitcoinjs-lib';
import { Buffer } from 'buffer';

export interface BtcUtxo {
  txid: string;
  vout: number;
  value: number;
  scriptPubKey?: string;
}

/**
 * Create a BTC PSBT from a virtual CKB transaction
 * This PSBT will carry the RGB++ commitment in OP_RETURN
 */
export async function createBtcPsbt({
  rgbppCkbVirtualTx,
  btcUtxos,
  changeAddress,
  amountSats
}: {
  rgbppCkbVirtualTx: any;
  btcUtxos: BtcUtxo[];
  changeAddress: string;
  amountSats: number;
}): Promise<{ psbtBase64: string }> {
  console.log('🔨 Building BTC PSBT from virtual CKB transaction...');
  
  const network = bitcoin.networks.testnet;
  const psbt = new bitcoin.Psbt({ network });

  // Calculate total input amount
  let totalInput = 0;
  
  // Add inputs from UTXOs
  for (const utxo of btcUtxos) {
    console.log(`Adding input: ${utxo.txid}:${utxo.vout} (${utxo.value} sats)`);
    
    // For witness inputs (Native SegWit)
    if (changeAddress.startsWith('tb1q') || changeAddress.startsWith('bc1q')) {
      // Fetch the scriptPubKey if not provided
      let scriptPubKey = utxo.scriptPubKey;
      if (!scriptPubKey) {
        // In production, fetch from mempool API
        // For now, create a P2WPKH scriptPubKey
        const decoded = bitcoin.address.fromBech32(changeAddress);
        scriptPubKey = bitcoin.script.compile([
          bitcoin.opcodes.OP_0,
          decoded.data
        ]).toString('hex');
      }
      
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: Buffer.from(scriptPubKey, 'hex'),
          value: utxo.value
        }
      });
    } else {
      // For non-witness inputs, we'd need the full transaction
      // This is simplified - in production, fetch the full tx
      throw new Error('Non-witness UTXOs not yet supported in this implementation');
    }
    
    totalInput += utxo.value;
  }

  // RGB++ commitment data
  const rgbppCommitment = generateRgbppCommitment(rgbppCkbVirtualTx);
  const opReturnData = Buffer.concat([
    Buffer.from('5247422b2b01', 'hex'), // RGB++ tag
    Buffer.from(rgbppCommitment, 'hex')
  ]);

  // Add OP_RETURN output for RGB++ commitment
  const opReturnScript = bitcoin.script.compile([
    bitcoin.opcodes.OP_RETURN,
    opReturnData
  ]);
  
  psbt.addOutput({
    script: opReturnScript,
    value: 0
  });

  // Add payment output (for the DoB amount)
  psbt.addOutput({
    address: changeAddress,
    value: amountSats
  });

  // Calculate fee and change
  const feeRate = 2; // sats per byte
  const estimatedSize = 250; // Approximate transaction size
  const fee = feeRate * estimatedSize;
  const changeAmount = totalInput - amountSats - fee;

  // Add change output if needed
  if (changeAmount > 546) { // Dust threshold
    psbt.addOutput({
      address: changeAddress,
      value: changeAmount
    });
  }

  const psbtBase64 = psbt.toBase64();
  console.log('✅ BTC PSBT created');
  console.log('📊 PSBT size:', psbtBase64.length, 'chars');
  
  return { psbtBase64 };
}

/**
 * Generate RGB++ commitment from virtual CKB transaction
 */
function generateRgbppCommitment(virtualTx: any): string {
  // Simplified commitment generation
  // In production, use proper RGB++ commitment algorithm
  const commitment = {
    version: 1,
    inputs: virtualTx.inputs.length,
    outputs: virtualTx.outputs.length,
    timestamp: Date.now()
  };
  
  return Buffer.from(JSON.stringify(commitment)).toString('hex').slice(0, 32);
}