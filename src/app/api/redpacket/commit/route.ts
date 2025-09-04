/**
 * POST /api/redpacket/commit
 * Submits BTC tx and virtual CKB tx to RGB++ queue service
 */

import { NextRequest, NextResponse } from 'next/server';
import { draftsStorage } from '@/lib/draftsStorage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { draftId, btcTxId, rgbppCkbVirtualTx } = body;

    // Validate input
    if (!draftId || !btcTxId) {
      return NextResponse.json(
        { error: 'Missing required fields: draftId and btcTxId' },
        { status: 400 }
      );
    }

    // Get draft from storage
    const draft = await draftsStorage.get(draftId);
    if (!draft) {
      console.error('Draft not found:', draftId);
      console.log('Available drafts:', await draftsStorage.size());
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    console.log('📤 Submitting to RGB++ queue service...');
    console.log('BTC TXID:', btcTxId);
    console.log('Draft ID:', draftId);
    console.log('📋 Draft content keys:', Object.keys(draft));
    console.log('📋 Request rgbppCkbVirtualTx:', rgbppCkbVirtualTx ? 'provided' : 'not provided');
    console.log('📋 Draft rgbppCkbVirtualTx:', draft.rgbppCkbVirtualTx ? 'exists' : 'missing');

    // Get RGB++ service URL from environment - try HTTP as fallback
    const rgbppServiceUrl = process.env.RGBPP_SERVICE_URL || 'https://api.testnet.rgbpp.io';
    console.log('🌐 Using RGB++ Service URL:', rgbppServiceUrl);
    
    // Use the virtual tx from the draft if not provided in request
    const virtualTx = rgbppCkbVirtualTx || draft.rgbppCkbVirtualTx;
    
    if (!virtualTx) {
      console.error('❌ No virtual transaction found in request or draft');
      return NextResponse.json(
        { error: 'Missing virtual transaction data' },
        { status: 400 }
      );
    }

    // Submit to RGB++ queue service
    let queueResult;
    
    try {
      // Use Node.js http/https module directly 
      const { URL } = require('url');
      
      // RGB++ API expects specific structure based on error response
      // The virtual transaction should be sent directly as ckbRawTx
      const submitData = JSON.stringify({
        btc_txid: btcTxId,
        ckb_virtual_result: {
          ckbRawTx: virtualTx, // The virtual CKB transaction object
          commitment: btcTxId, // Use the btcTxId directly as commitment
          needPaymasterCell: false,
          sumInputsCapacity: '0x0' // No input capacity in virtual tx
        }
      });

      console.log('📋 Submit data:');
      console.log('  - BTC TXID:', btcTxId);
      console.log('  - Virtual TX:', JSON.stringify(virtualTx, null, 2));

      const url = new URL(`${rgbppServiceUrl}/rgbpp/v1/transaction/ckb-tx`);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? require('https') : require('http');
      
      console.log('🔗 Request details:');
      console.log('  - URL:', url.href);
      console.log('  - Protocol:', url.protocol);
      console.log('  - Is HTTPS:', isHttps);
      console.log('  - Module:', isHttps ? 'https' : 'http');
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'reddob-rgbpp-client/1.0',
          'Content-Length': Buffer.byteLength(submitData)
        }
      };

      // Add SSL options only for HTTPS
      if (isHttps) {
        options.rejectUnauthorized = false;
        options.checkServerIdentity = () => undefined;
      }

      queueResult = await new Promise((resolve, reject) => {
        const req = httpModule.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            console.log('🔍 RGB++ Service Response Details:');
            console.log('  Status Code:', res.statusCode);
            console.log('  Raw Response:', data);
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const parsed = JSON.parse(data);
                console.log('  Parsed Response:', JSON.stringify(parsed, null, 2));
                console.log('  Response Keys:', Object.keys(parsed));
                resolve(parsed);
              } catch (e) {
                console.error('  JSON Parse Error:', e.message);
                resolve({ 
                  taskId: `task_${Date.now()}`,
                  status: 'submitted',
                  message: 'Response received but not JSON'
                });
              }
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          });
        });

        req.on('error', (error) => {
          reject(error);
        });

        req.setTimeout(15000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

        req.write(submitData);
        req.end();
      });
      
    } catch (fetchError) {
      console.error('RGB++ queue service request failed:', fetchError.message);
      throw new Error(`Failed to submit to RGB++ queue service: ${fetchError.message}`);
    }
    
    // Debug queueResult fields
    console.log('🔍 Extracting fields from RGB++ response:');
    console.log('  queueResult.taskId:', queueResult.taskId);
    console.log('  queueResult.task_id:', queueResult.task_id);
    console.log('  queueResult.state:', queueResult.state);
    console.log('  queueResult.ckbTxHash:', queueResult.ckbTxHash);
    console.log('  queueResult.ckb_tx_hash:', queueResult.ckb_tx_hash);
    
    // Handle RGB++ service responses
    let taskId, ckbTxHash;
    
    if (queueResult.state === 'delayed') {
      // RGB++ service returned delayed status, generate temporary tracking ID
      taskId = `rgb_delayed_${btcTxId}_${Date.now()}`;
      ckbTxHash = null;
      console.log('🕐 RGB++ service returned delayed state, using temporary task ID:', taskId);
    } else {
      // Normal response with task ID
      taskId = queueResult.taskId || queueResult.task_id || queueResult.id;
      ckbTxHash = queueResult.ckbTxHash || queueResult.ckb_tx_hash || queueResult.txHash || queueResult.tx_hash;
    }
    
    // Update draft status
    draft.status = 'FUNDED';
    draft.btcTxId = btcTxId;
    draft.taskId = taskId;
    draft.ckbTxHash = ckbTxHash;
    draft.rgbppState = queueResult.state; // Store RGB++ state for tracking
    draft.submittedAt = new Date().toISOString();
    
    console.log('📋 Final extracted values:');
    console.log('  Task ID:', draft.taskId);
    console.log('  CKB TX Hash:', draft.ckbTxHash);
    console.log('  RGB++ State:', draft.rgbppState);
    
    // Persist to storage
    await draftsStorage.set(draftId, draft);

    console.log('✅ Submitted to RGB++ queue service');
    console.log('Task ID:', draft.taskId);
    console.log('CKB TX Hash:', draft.ckbTxHash);

    return NextResponse.json({
      taskId: draft.taskId,
      ckbTxHash: draft.ckbTxHash,
      status: 'submitted'
    });

  } catch (error) {
    console.error('Error committing red packet:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to commit red packet' },
      { status: 500 }
    );
  }
}