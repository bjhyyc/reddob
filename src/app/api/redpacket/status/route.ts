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
    const btcTxId = searchParams.get('btcTxId');

    if (!taskId && !ckbTxHash) {
      return NextResponse.json(
        { error: 'taskId or ckbTxHash required' },
        { status: 400 }
      );
    }

    console.log('🔍 Checking RGB++ transaction status...');
    console.log('Task ID:', taskId);
    console.log('CKB TX Hash:', ckbTxHash);
    console.log('BTC TX ID:', btcTxId);

    // 首先检查BTC交易确认状态（如果提供了btcTxId）
    let btcConfirmations = 0;
    let btcStatus = 'unknown';
    
    if (btcTxId) {
      try {
        const btcStatusResponse = await fetch(`https://mempool.space/testnet/api/tx/${btcTxId}`);
        if (btcStatusResponse.ok) {
          const btcData = await btcStatusResponse.json();
          console.log('🔍 BTC API Response:', btcData.status);
          
          // 修复确认数和状态检测逻辑
          if (btcData.status && btcData.status.confirmed) {
            btcConfirmations = btcData.status.block_height ? 
              (btcData.status.block_height > 0 ? Math.max(1, btcData.status.confirmations || 1) : 0) : 0;
            btcStatus = 'confirmed';
          } else {
            btcConfirmations = 0;
            btcStatus = 'pending';
          }
          
          console.log(`🔗 BTC交易状态: ${btcStatus}, 确认数: ${btcConfirmations}`);
        }
      } catch (btcError) {
        console.warn('BTC状态查询失败:', btcError);
      }
    }

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
            stage: 'completed',
            ckbTxHash,
            blockNumber: txData.block_number,
            confirmations: txData.confirmations || 0,
            timestamp: txData.block_timestamp,
            btcConfirmations,
            btcStatus,
            message: '✅ CKB镜像交易已确认，RGB++强绑定完成',
            progressPercent: 100,
            estimatedTimeRemaining: '0分钟'
          });
        }
      } catch (e) {
        console.error('CKB explorer check failed:', e);
      }
    }

    // Check with RGB++ service if we have taskId
    if (taskId) {
      const rgbppServiceUrl = process.env.RGBPP_SERVICE_URL || 'https://api.testnet.rgbpp.io';
      
      // Handle delayed RGB++ tasks - wait for real completion
      if (taskId.startsWith('rgb_delayed_')) {
        console.log('🕐 Handling delayed RGB++ task:', taskId);
        
        // Extract BTC TxID from delayed task ID format: rgb_delayed_[btcTxId]_[timestamp]
        const parts = taskId.split('_');
        const extractedBtcTxId = parts.slice(2, -1).join('_'); // Handle TxIDs that might contain underscores
        console.log('📋 Extracted BTC TxID:', extractedBtcTxId);
        
        // Try to query RGB++ service with the BTC TxID to get real status
        const rgbppServiceUrl = process.env.RGBPP_SERVICE_URL || 'https://api.testnet.rgbpp.io';
        let realStatus = null;
        
        try {
          // Try to find the real task by BTC TxID
          const searchResponse = await fetch(
            `${rgbppServiceUrl}/rgbpp/v1/transaction/btc-tx/${extractedBtcTxId}`,
            { signal: AbortSignal.timeout(5000) }
          );
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            if (searchData.taskId || searchData.task_id) {
              realStatus = searchData;
              console.log('✅ Found real RGB++ task:', searchData);
            }
          }
        } catch (e) {
          console.log('⚠️ Could not query RGB++ service for real status:', e.message);
        }
        
        // If we found real status, return it
        if (realStatus && realStatus.status === 'MIRRORED') {
          return NextResponse.json({
            status: 'MIRRORED',
            stage: 'completed',
            taskId: realStatus.taskId || realStatus.task_id || taskId,
            ckbTxHash: realStatus.ckb_tx_hash || realStatus.ckbTxHash,
            btcConfirmations,
            btcStatus,
            message: '✅ RGB++ 交易已完成，CKB镜像交易已确认',
            progressPercent: 100,
            estimatedTimeRemaining: '0分钟',
            rgbppState: 'completed'
          });
        }
        
        // Still waiting - return persistent waiting status
        return NextResponse.json({
          status: 'PROCESSING',
          stage: 'rgb_processing',
          taskId,
          message: '⏳ RGB++ 交易正在队列中处理，请耐心等待...',
          progressPercent: 55, // Keep at a fixed progress
          estimatedTimeRemaining: '处理时间视网络情况而定',
          rgbppState: 'delayed',
          btcConfirmations,
          btcStatus,
          details: btcConfirmations > 0 
            ? 'BTC交易已确认，正在等待RGB++服务处理CKB镜像交易'
            : '等待BTC交易确认及RGB++服务处理'
        });
      }
      
      // Mock response for testing if taskId starts with 'mock_'
      if (taskId.startsWith('mock_')) {
        console.log('📋 Returning mock status for testing taskId:', taskId);
        
        // Simulate progression: after 30 seconds, change to MIRRORED
        const taskTimestamp = parseInt(taskId.split('_')[2] || '0');
        const isOlderThan30Seconds = (Date.now() - taskTimestamp) > 30000;
        
        const mockStage = isOlderThan30Seconds ? 'completed' : 'processing';
        const mockProgress = isOlderThan30Seconds ? 100 : Math.min(90, (Date.now() - taskTimestamp) / 30000 * 90);
        
        return NextResponse.json({
          status: isOlderThan30Seconds ? 'MIRRORED' : 'FUNDED',
          stage: mockStage,
          taskId,
          ckbTxHash: isOlderThan30Seconds ? `0x${'b'.repeat(64)}` : null,
          btcConfirmations,
          btcStatus,
          message: isOlderThan30Seconds ? 'Mock CKB transaction created' : 'Mock processing...',
          progressPercent: Math.round(mockProgress),
          estimatedTimeRemaining: isOlderThan30Seconds ? '0分钟' : `${Math.ceil((30000 - (Date.now() - taskTimestamp)) / 60000)}分钟`
        });
      }
      
      try {
        const statusResponse = await fetch(
          `${rgbppServiceUrl}/rgbpp/v1/transaction/status/${taskId}`,
          { signal: AbortSignal.timeout(5000) } // 5 second timeout
        );
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          
          // 根据status推断处理阶段和进度
          let stage = 'processing';
          let progressPercent = 50;
          let estimatedTimeRemaining = '20分钟';
          let detailedMessage = statusData.message || 'RGB++队列处理中...';
          
          if (statusData.status === 'MIRRORED') {
            stage = 'completed';
            progressPercent = 100;
            estimatedTimeRemaining = '0分钟';
            detailedMessage = '✅ CKB镜像交易已创建，RGB++强绑定完成';
          } else if (statusData.status === 'PROCESSING') {
            stage = 'spv_generation';
            progressPercent = 70;
            estimatedTimeRemaining = '10分钟';
            detailedMessage = '🔄 正在生成SPV证明和创建CKB镜像交易';
          } else if (btcConfirmations === 0) {
            stage = 'btc_confirmation';
            progressPercent = 30;
            estimatedTimeRemaining = '15分钟';
            detailedMessage = `⏳ 等待BTC交易确认中 (${btcConfirmations}/1确认)`;
          }
          
          return NextResponse.json({
            status: statusData.status || 'FUNDED',
            stage,
            taskId,
            ckbTxHash: statusData.ckb_tx_hash,
            btcConfirmations,
            btcStatus,
            message: detailedMessage,
            progressPercent,
            estimatedTimeRemaining
          });
        }
      } catch (e) {
        console.error('RGB++ service status check failed:', e);
        
        // Return enhanced processing status on service failure
        let fallbackStage = 'processing';
        let fallbackProgress = 40;
        let fallbackMessage = 'RGB++ service unavailable, status unknown';
        
        if (btcConfirmations === 0) {
          fallbackStage = 'btc_confirmation';
          fallbackProgress = 30;
          fallbackMessage = `⏳ BTC交易待确认 (${btcConfirmations}/1确认)，RGB++服务暂时无法访问`;
        } else if (btcConfirmations > 0) {
          fallbackStage = 'spv_generation';
          fallbackProgress = 60;
          fallbackMessage = '🔄 BTC已确认，RGB++队列处理中（服务暂时无法访问）';
        }
        
        return NextResponse.json({
          status: 'FUNDED',
          stage: fallbackStage,
          taskId,
          ckbTxHash: null,
          btcConfirmations,
          btcStatus,
          message: fallbackMessage,
          progressPercent: fallbackProgress,
          estimatedTimeRemaining: '15分钟'
        });
      }
    }

    // If both checks fail, return enhanced pending status
    let defaultStage = 'processing';
    let defaultProgress = 50;
    let defaultMessage = 'Transaction is being processed';
    
    if (btcConfirmations === 0) {
      defaultStage = 'btc_confirmation';
      defaultProgress = 30;
      defaultMessage = `⏳ 等待BTC交易确认中 (${btcConfirmations}/1确认)`;
    } else if (btcConfirmations > 0) {
      defaultStage = 'rgb_processing';
      defaultProgress = 70;
      defaultMessage = '🔄 BTC已确认，RGB++队列处理中...';
    }
    
    return NextResponse.json({
      status: 'FUNDED',
      stage: defaultStage,
      taskId,
      ckbTxHash,
      btcConfirmations,
      btcStatus,
      message: defaultMessage,
      progressPercent: defaultProgress,
      estimatedTimeRemaining: '15分钟'
    });

  } catch (error) {
    console.error('Error checking status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check status' },
      { status: 500 }
    );
  }
}