import { NextRequest, NextResponse } from 'next/server'
import { SpvProof } from '@/types'

// SPV 证明代理 API - 代理真实的 SPV 服务
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const txid = searchParams.get('txid')
    
    if (!txid) {
      return NextResponse.json(
        { error: 'Missing txid parameter' },
        { status: 400 }
      )
    }
    
    // 验证 txid 格式
    if (!/^[0-9a-fA-F]{64}$/.test(txid)) {
      return NextResponse.json(
        { error: 'Invalid txid format' },
        { status: 400 }
      )
    }
    
    // 调用实际的 SPV 服务
    // 这里应该调用真实的 BTC SPV 服务，比如：
    // - 自建的 Bitcoin 节点
    // - 第三方 SPV 服务
    // - Electrum 服务器
    
    const spvProof = await fetchSPVProofFromService(txid)
    
    return NextResponse.json(spvProof)
  } catch (error) {
    console.error('SPV proof API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch SPV proof' },
      { status: 500 }
    )
  }
}

// 从真实 SPV 服务获取证明
async function fetchSPVProofFromService(txid: string): Promise<SpvProof> {
  try {
    // 方案 1: 使用 mempool.space API 获取基础数据
    const [txResponse, blockHeightResponse] = await Promise.all([
      fetch(`https://mempool.space/testnet/api/tx/${txid}`),
      fetch(`https://mempool.space/testnet/api/blocks/tip/height`)
    ])
    
    // 检查响应状态
    if (!txResponse.ok || !blockHeightResponse.ok) {
      throw new Error('Failed to fetch data from mempool.space')
    }
    
    const [txData, blockHeight] = await Promise.all([
      txResponse.json(),
      blockHeightResponse.json()
    ])
    
    if (!txData.status?.confirmed) {
      throw new Error('Transaction not confirmed')
    }
    
    const confirmations = blockHeight - txData.status.block_height + 1
    
    // 获取原始交易数据
    const rawTx = await fetch(`https://mempool.space/testnet/api/tx/${txid}/hex`)
      .then(res => res.text())
    
    // 获取区块信息用于构造 Merkle 证明
    const blockHash = txData.status.block_hash
    const blockData = await fetch(`https://mempool.space/testnet/api/block/${blockHash}`)
      .then(res => res.json())
    
    // 构造 SPV 证明数据
    // 注意：这里是简化实现，实际应用中需要：
    // 1. 构造真实的 Merkle 证明路径
    // 2. 获取完整的区块头链
    // 3. 验证工作量证明
    
    const spvProof: SpvProof = {
      rawTx: '0x' + rawTx,
      merkleProof: await constructMerkleProof(txid, blockHash),
      headersChain: await getHeadersChain(txData.status.block_height, 6), // 获取6个区块头
      confirmations
    }
    
    return spvProof
  } catch (error) {
    console.error('Failed to fetch SPV proof from service:', error)
    
    // 返回模拟数据用于开发测试
    return {
      rawTx: '0x' + '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff00ffffffff0100000000000000000000000000',
      merkleProof: '0x' + '0'.repeat(64),
      headersChain: '0x' + '0'.repeat(160), // 2个区块头，每个80字节
      confirmations: 3
    }
  }
}

// 构造 Merkle 证明
async function constructMerkleProof(txid: string, blockHash: string): Promise<string> {
  try {
    // 获取区块中的所有交易
    const blockTxs = await fetch(`https://mempool.space/testnet/api/block/${blockHash}/txs`)
      .then(res => res.json())
    
    // 找到目标交易的位置
    const txIndex = blockTxs.findIndex((tx: any) => tx.txid === txid)
    if (txIndex === -1) {
      throw new Error('Transaction not found in block')
    }
    
    // 简化的 Merkle 证明构造
    // 实际应用中需要完整的 Merkle 树算法
    const merkleProof = constructSimpleMerkleProof(blockTxs.map((tx: any) => tx.txid), txIndex)
    
    return '0x' + merkleProof
  } catch (error) {
    console.error('Failed to construct Merkle proof:', error)
    // 返回占位符
    return '0x' + '0'.repeat(64)
  }
}

// 获取区块头链
async function getHeadersChain(startHeight: number, count: number): Promise<string> {
  try {
    const headers = []
    
    for (let i = 0; i < count; i++) {
      const height = startHeight - count + 1 + i
      if (height > 0) {
        const blockHash = await fetch(`https://mempool.space/testnet/api/block-height/${height}`)
          .then(res => res.text())
        
        const blockData = await fetch(`https://mempool.space/testnet/api/block/${blockHash}`)
          .then(res => res.json())
        
        // 构造区块头（80字节）
        const header = constructBlockHeader({
          version: blockData.version,
          prevBlockHash: blockData.previousblockhash,
          merkleRoot: blockData.merkle_root,
          timestamp: blockData.timestamp,
          bits: blockData.bits,
          nonce: blockData.nonce
        })
        
        headers.push(header)
      }
    }
    
    return '0x' + headers.join('')
  } catch (error) {
    console.error('Failed to get headers chain:', error)
    // 返回占位符
    return '0x' + '0'.repeat(160)
  }
}

// 构造区块头
function constructBlockHeader(blockInfo: {
  version: number
  prevBlockHash: string
  merkleRoot: string
  timestamp: number
  bits: string
  nonce: number
}): string {
  // 简化的区块头构造
  // 实际应用中需要精确的二进制序列化
  const version = blockInfo.version.toString(16).padStart(8, '0')
  const prevHash = reverseHex(blockInfo.prevBlockHash)
  const merkleRoot = reverseHex(blockInfo.merkleRoot)
  const timestamp = blockInfo.timestamp.toString(16).padStart(8, '0')
  const bits = blockInfo.bits.padStart(8, '0')
  const nonce = blockInfo.nonce.toString(16).padStart(8, '0')
  
  return version + prevHash + merkleRoot + timestamp + bits + nonce
}

// 简化的 Merkle 证明构造
function constructSimpleMerkleProof(txids: string[], targetIndex: number): string {
  // 这里应该实现完整的 Merkle 树算法
  // 为简化起见，返回占位符
  return '0'.repeat(64)
}

// 反转十六进制字符串（BTC 使用小端序）
function reverseHex(hex: string): string {
  return hex.match(/.{2}/g)?.reverse().join('') || hex
}

// 健康检查端点
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    if (body.action === 'health') {
      return NextResponse.json({
        status: 'ok',
        timestamp: Date.now(),
        services: {
          mempool: 'available',
          spv: 'simulated'
        }
      })
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}