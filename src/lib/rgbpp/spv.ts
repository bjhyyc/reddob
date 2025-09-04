import { SpvProof, Hex, CONSTANTS } from '@/types'

// SPV 证明验证和解析

// 解析 BTC 交易中的 OP_RETURN 数据
export function parseOpReturnFromRawTx(rawTx: string): string | null {
  try {
    // 简化的交易解析
    // 实际实现需要完整的 BTC 交易解析库
    const tx = parseRawTransaction(rawTx)
    
    for (const output of tx.outputs) {
      if (output.script.startsWith('6a')) { // OP_RETURN opcode
        // 提取 OP_RETURN 数据
        const dataLength = parseInt(output.script.substring(2, 4), 16)
        const data = output.script.substring(4, 4 + dataLength * 2)
        return data
      }
    }
    
    return null
  } catch (error) {
    console.error('Failed to parse OP_RETURN from raw tx:', error)
    return null
  }
}

// 验证 SPV 证明
export async function verifySPVProof(
  proof: SpvProof,
  expectedTxId: string,
  expectedOpReturn?: string
): Promise<{
  valid: boolean
  txId: string
  opReturnData?: string
  errors: string[]
}> {
  const errors: string[] = []
  
  try {
    // 1. 验证原始交易格式
    const parsedTx = parseRawTransaction(proof.rawTx)
    if (!parsedTx) {
      errors.push('Invalid raw transaction format')
    }
    
    // 2. 验证交易 ID
    const computedTxId = await computeTransactionId(proof.rawTx)
    if (computedTxId !== expectedTxId) {
      errors.push(`Transaction ID mismatch: expected ${expectedTxId}, got ${computedTxId}`)
    }
    
    // 3. 验证 Merkle 证明
    const merkleValid = await verifyMerkleProof(
      computedTxId,
      proof.merkleProof,
      extractMerkleRootFromHeaders(proof.headersChain)
    )
    if (!merkleValid) {
      errors.push('Invalid Merkle proof')
    }
    
    // 4. 验证区块头链
    const headersValid = await verifyHeadersChain(proof.headersChain)
    if (!headersValid) {
      errors.push('Invalid headers chain')
    }
    
    // 5. 验证确认数
    if (proof.confirmations < CONSTANTS.CONFS_MIN) {
      errors.push(`Insufficient confirmations: ${proof.confirmations} < ${CONSTANTS.CONFS_MIN}`)
    }
    
    // 6. 解析和验证 OP_RETURN
    const opReturnData = parseOpReturnFromRawTx(proof.rawTx)
    if (expectedOpReturn && opReturnData !== expectedOpReturn) {
      errors.push('OP_RETURN data mismatch')
    }
    
    return {
      valid: errors.length === 0,
      txId: computedTxId,
      opReturnData: opReturnData || undefined,
      errors
    }
  } catch (error) {
    console.error('Failed to verify SPV proof:', error)
    errors.push(`Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    
    return {
      valid: false,
      txId: '',
      errors
    }
  }
}

// 获取 SPV 证明数据（通过代理 API）
export async function fetchSPVProof(txId: string): Promise<SpvProof> {
  try {
    const response = await fetch(`/api/spv/proof?txid=${txId}`)
    if (!response.ok) {
      throw new Error(`SPV API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    return {
      rawTx: data.rawTx,
      merkleProof: data.merkleProof,
      headersChain: data.headersChain,
      confirmations: data.confirmations
    }
  } catch (error) {
    console.error('Failed to fetch SPV proof:', error)
    throw error
  }
}

// 检查交易是否花费了指定的 UTXO
export function doesTxSpendUtxo(
  rawTx: string,
  targetTxId: string,
  targetVout: number
): boolean {
  try {
    const tx = parseRawTransaction(rawTx)
    
    for (const input of tx.inputs) {
      if (input.prevTxId === targetTxId && input.prevVout === targetVout) {
        return true
      }
    }
    
    return false
  } catch (error) {
    console.error('Failed to check if tx spends UTXO:', error)
    return false
  }
}

// 简化的交易解析（实际应使用专门的库）
function parseRawTransaction(rawTx: string): {
  version: number
  inputs: Array<{
    prevTxId: string
    prevVout: number
    script: string
  }>
  outputs: Array<{
    value: number
    script: string
  }>
  locktime: number
} | null {
  try {
    // 这里应该实现完整的 BTC 交易解析
    // 为了简化，返回一个占位符结构
    return {
      version: 1,
      inputs: [],
      outputs: [],
      locktime: 0
    }
  } catch (error) {
    return null
  }
}

// 计算交易 ID（双 SHA256）
async function computeTransactionId(rawTx: string): Promise<string> {
  const bytes = hexToBytes(rawTx.startsWith('0x') ? rawTx.slice(2) : rawTx)
  
  // 第一次 SHA256
  const hash1 = await crypto.subtle.digest('SHA-256', bytes)
  // 第二次 SHA256
  const hash2 = await crypto.subtle.digest('SHA-256', hash1)
  
  // 反转字节序（BTC 使用小端序）
  const reversed = new Uint8Array(hash2).reverse()
  
  return Array.from(reversed).map(b => b.toString(16).padStart(2, '0')).join('')
}

// 验证 Merkle 证明
async function verifyMerkleProof(
  txId: string,
  merkleProof: string,
  merkleRoot: string
): Promise<boolean> {
  try {
    // 实现 Merkle 树证明验证
    // 这里返回 true 作为占位符
    return true
  } catch (error) {
    return false
  }
}

// 从区块头链提取 Merkle 根
function extractMerkleRootFromHeaders(headersChain: string): string {
  try {
    // 解析区块头链，提取最新块的 Merkle 根
    // 这里返回占位符
    return '0x' + '0'.repeat(64)
  } catch (error) {
    return ''
  }
}

// 验证区块头链
async function verifyHeadersChain(headersChain: string): Promise<boolean> {
  try {
    // 验证区块头链的连续性和工作量证明
    // 这里返回 true 作为占位符
    return true
  } catch (error) {
    return false
  }
}

// 十六进制字符串转字节数组
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
  }
  return bytes
}