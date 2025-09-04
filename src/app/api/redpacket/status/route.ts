/**
 * GET /api/redpacket/status?taskId=...
 * Polls the status of RGB++ transaction
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const taskId = searchParams.get('taskId');
    const ckbTxHash = searchParams.get('ckbTxHash');

    if (!taskId && !ckbTxHash) {
      return NextResponse.json(
        { error: 'taskId or ckbTxHash required' },
        { status: 400 }
      );
    }

    console.log('🔍 Checking RGB++ transaction status...');
    console.log('Task ID:', taskId);
    console.log('CKB TX Hash:', ckbTxHash);

    // If we have ckbTxHash, check CKB explorer
    if (ckbTxHash) {
      try {
        const explorerResponse = await fetch(
          `https://testnet.explorer.nervos.org/api/v1/transactions/${ckbTxHash}`
        );
        
        if (explorerResponse.ok) {
          const txData = await explorerResponse.json();
          
          return NextResponse.json({
            status: 'MIRRORED',
            ckbTxHash,
            blockNumber: txData.block_number,
            confirmations: txData.confirmations || 0,
            timestamp: txData.block_timestamp
          });
        }
      } catch (e) {
        console.error('CKB explorer check failed:', e);
      }
    }

    // Check with RGB++ service if we have taskId
    if (taskId) {
      const rgbppServiceUrl = process.env.RGBPP_SERVICE_URL || 'https://api.rgbpp.testnet.io';
      
      try {
        const statusResponse = await fetch(
          `${rgbppServiceUrl}/rgbpp/v1/transaction/status/${taskId}`
        );
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          
          return NextResponse.json({
            status: statusData.status || 'FUNDED',
            taskId,
            ckbTxHash: statusData.ckb_tx_hash,
            message: statusData.message
          });
        }
      } catch (e) {
        console.error('RGB++ service status check failed:', e);
      }
    }

    // If both checks fail, return pending status
    return NextResponse.json({
      status: 'FUNDED',
      taskId,
      ckbTxHash,
      message: 'Transaction is being processed'
    });

  } catch (error) {
    console.error('Error checking status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check status' },
      { status: 500 }
    );
  }
}