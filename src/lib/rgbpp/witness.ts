import { RgbppMeltWitness, Hex, Hex32 } from '@/types'

// 编码 RGB++ Melt Witness
export function encodeRgbppMeltWitness(witness: RgbppMeltWitness): Hex {
  try {
    // 使用 JSON 序列化作为简单的编码方式
    // 实际实现中可能需要使用更精确的二进制编码
    const witnessData = {
      version: witness.version,
      net_byte: witness.netByte,
      confs_min: witness.confsMin,
      spore_id: witness.sporeId,
      owner_lock_hash: witness.ownerLockHash,
      raw_btc_tx: witness.rawBtcTx,
      merkle_proof: witness.merkleProof,
      headers_chain: witness.headersChain
    }
    
    const jsonString = JSON.stringify(witnessData)
    const bytes = new TextEncoder().encode(jsonString)
    
    // 转换为十六进制字符串
    return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch (error) {
    console.error('Failed to encode RGB++ melt witness:', error)
    throw error
  }
}

// 解码 RGB++ Melt Witness
export function decodeRgbppMeltWitness(witnessHex: Hex): RgbppMeltWitness {
  try {
    // 移除 0x 前缀
    const cleanHex = witnessHex.startsWith('0x') ? witnessHex.slice(2) : witnessHex
    
    // 十六进制转字节数组
    const bytes = new Uint8Array(cleanHex.length / 2)
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16)
    }
    
    // 字节数组转字符串
    const jsonString = new TextDecoder().decode(bytes)
    const witnessData = JSON.parse(jsonString)
    
    return {
      version: witnessData.version,
      netByte: witnessData.net_byte,
      confsMin: witnessData.confs_min,
      sporeId: witnessData.spore_id,
      ownerLockHash: witnessData.owner_lock_hash,
      rawBtcTx: witnessData.raw_btc_tx,
      merkleProof: witnessData.merkle_proof,
      headersChain: witnessData.headers_chain
    }
  } catch (error) {
    console.error('Failed to decode RGB++ melt witness:', error)
    throw error
  }
}

// 验证 RGB++ Melt Witness 数据完整性
export function validateRgbppMeltWitness(witness: RgbppMeltWitness): boolean {
  try {
    // 检查必要字段
    if (witness.version !== 1) {
      console.error('Invalid witness version:', witness.version)
      return false
    }
    
    if (witness.netByte !== 0 && witness.netByte !== 1) {
      console.error('Invalid net byte:', witness.netByte)
      return false
    }
    
    if (witness.confsMin < 1) {
      console.error('Invalid confirmations minimum:', witness.confsMin)
      return false
    }
    
    // 检查十六进制字段格式
    const hexFields = [
      witness.sporeId,
      witness.ownerLockHash,
      witness.rawBtcTx,
      witness.merkleProof,
      witness.headersChain
    ]
    
    for (const field of hexFields) {
      if (!isValidHex(field)) {
        console.error('Invalid hex field:', field)
        return false
      }
    }
    
    // 检查字段长度
    if (witness.sporeId.length !== 66) { // 0x + 64 chars
      console.error('Invalid spore ID length:', witness.sporeId.length)
      return false
    }
    
    if (witness.ownerLockHash.length !== 66) { // 0x + 64 chars
      console.error('Invalid owner lock hash length:', witness.ownerLockHash.length)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Failed to validate RGB++ melt witness:', error)
    return false
  }
}

// 创建 RGB++ Melt Witness
export function createRgbppMeltWitness(params: {
  netByte: 0 | 1
  confsMin: number
  sporeId: Hex32
  ownerLockHash: Hex32
  rawBtcTx: Hex
  merkleProof: Hex
  headersChain: Hex
}): RgbppMeltWitness {
  return {
    version: 1,
    netByte: params.netByte,
    confsMin: params.confsMin,
    sporeId: params.sporeId,
    ownerLockHash: params.ownerLockHash,
    rawBtcTx: params.rawBtcTx,
    merkleProof: params.merkleProof,
    headersChain: params.headersChain
  }
}

// 辅助函数：验证十六进制字符串
function isValidHex(hex: string): boolean {
  if (!hex.startsWith('0x')) {
    return false
  }
  
  const cleanHex = hex.slice(2)
  if (cleanHex.length === 0 || cleanHex.length % 2 !== 0) {
    return false
  }
  
  return /^[0-9a-fA-F]*$/.test(cleanHex)
}