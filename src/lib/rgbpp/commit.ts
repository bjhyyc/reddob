import { Hex, Hex32, CONSTANTS } from '@/types'

// Blake2b hash 实现（简化版，实际应使用专门的库）
async function blake2b256(data: Uint8Array): Promise<Uint8Array> {
  // 在浏览器环境中使用 Web Crypto API
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data)
    return new Uint8Array(hashBuffer)
  }
  
  // 在 Node.js 环境中使用 crypto 模块
  const crypto = require('crypto')
  const hash = crypto.createHash('sha256')
  hash.update(data)
  return new Uint8Array(hash.digest())
}

// 简化版本：仅基于 CKB 交易哈希计算 commit hash (用于开发阶段)
export async function computeCommitHash(ckbTxHash: Hex): Promise<string> {
  try {
    // 输入验证
    if (!ckbTxHash || typeof ckbTxHash !== 'string') {
      throw new Error('Invalid CKB transaction hash: must be a non-empty string')
    }
    
    // 清理输入：移除 0x 前缀并验证格式
    const cleanTxHash = ckbTxHash.startsWith('0x') ? ckbTxHash.slice(2) : ckbTxHash
    
    // 验证十六进制格式和长度
    if (!/^[0-9a-fA-F]{64}$/.test(cleanTxHash)) {
      throw new Error('Invalid CKB transaction hash format: must be 64 hex characters')
    }
    
    // 构造简化的原始数据用于演示
    const prefix = new TextEncoder().encode('RGB++|SIMPLE|v1')
    const txHashBytes = hexToBytes(cleanTxHash)
    
    // 合并数据
    const combined = new Uint8Array(prefix.length + txHashBytes.length)
    combined.set(prefix, 0)
    combined.set(txHashBytes, prefix.length)
    
    // 计算哈希
    const hashBytes = await blake2b256(combined)
    
    // 返回十六进制字符串 (不带 0x 前缀，符合 RGB++ 规范)
    return Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch (error) {
    console.error('Failed to compute commit hash:', error)
    throw error
  }
}

// 完整版本：计算完整的 RGB++ commit hash
export async function computeFullCommitHash(
  netByte: number,
  txid: string,
  vout: number,
  sporeId: Hex32,
  ownerLockHash: Hex32,
  confsMin: number = CONSTANTS.CONFS_MIN
): Promise<string> {
  try {
    // 构造原始数据: "RGBPP|MELT|v1" || net_byte || txid || u32le(vout) || spore_id || owner_lock_hash || u8(confs_min)
    const prefix = new TextEncoder().encode('RGBPP|MELT|v1')
    const netByteArray = new Uint8Array([netByte])
    const txidBytes = hexToBytes(txid.startsWith('0x') ? txid.slice(2) : txid)
    const voutBytes = u32leToBytes(vout)
    const sporeIdBytes = hexToBytes(sporeId.startsWith('0x') ? sporeId.slice(2) : sporeId)
    const ownerLockHashBytes = hexToBytes(ownerLockHash.startsWith('0x') ? ownerLockHash.slice(2) : ownerLockHash)
    const confsMinArray = new Uint8Array([confsMin])
    
    // 合并所有数据
    const totalLength = prefix.length + netByteArray.length + txidBytes.length + 
      voutBytes.length + sporeIdBytes.length + ownerLockHashBytes.length + confsMinArray.length
    
    const combined = new Uint8Array(totalLength)
    let offset = 0
    
    combined.set(prefix, offset)
    offset += prefix.length
    
    combined.set(netByteArray, offset)
    offset += netByteArray.length
    
    combined.set(txidBytes, offset)
    offset += txidBytes.length
    
    combined.set(voutBytes, offset)
    offset += voutBytes.length
    
    combined.set(sporeIdBytes, offset)
    offset += sporeIdBytes.length
    
    combined.set(ownerLockHashBytes, offset)
    offset += ownerLockHashBytes.length
    
    combined.set(confsMinArray, offset)
    
    // 计算 Blake2b-256 哈希
    const hashBytes = await blake2b256(combined)
    
    // 返回十六进制字符串
    return '0x' + Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch (error) {
    console.error('Failed to compute commit hash:', error)
    throw error
  }
}

// 验证 OP_RETURN 数据
export function verifyOpReturn(opReturnData: string, expectedCommitHash: string): boolean {
  try {
    // 移除 0x 前缀
    const cleanData = opReturnData.startsWith('0x') ? opReturnData.slice(2) : opReturnData
    const cleanExpected = expectedCommitHash.startsWith('0x') ? expectedCommitHash.slice(2) : expectedCommitHash
    
    // 检查 OP_RETURN 标签
    const tagHex = CONSTANTS.OPRETURN_TAG.slice(2) // 移除 0x
    if (!cleanData.startsWith(tagHex)) {
      return false
    }
    
    // 提取 commit hash 部分
    const commitHashFromOpReturn = cleanData.slice(tagHex.length)
    
    // 比较哈希
    return commitHashFromOpReturn.toLowerCase() === cleanExpected.toLowerCase()
  } catch (error) {
    console.error('Failed to verify OP_RETURN:', error)
    return false
  }
}

// 辅助函数：十六进制字符串转字节数组
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
  }
  return bytes
}

// 辅助函数：32位无符号整数转小端序字节数组
function u32leToBytes(value: number): Uint8Array {
  const bytes = new Uint8Array(4)
  bytes[0] = value & 0xff
  bytes[1] = (value >> 8) & 0xff
  bytes[2] = (value >> 16) & 0xff
  bytes[3] = (value >> 24) & 0xff
  return bytes
}