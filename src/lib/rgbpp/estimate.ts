// CKB 容量估算工具

// 1 CKB = 10^8 shannons
export const CKB_UNIT = 10n ** 8n

// 基础单元格结构开销（字节）
export const BASIC_CELL_SIZE = {
  CAPACITY: 8,      // 容量字段
  LOCK: 32 + 1 + 1, // lock script hash + hash_type + args length prefix
  TYPE: 32 + 1 + 1, // type script hash + hash_type + args length prefix  
  DATA_LENGTH: 4,   // 数据长度字段
} as const

// 脚本开销估算
export const SCRIPT_SIZE = {
  SECP256K1_LOCK: 20,  // secp256k1 args 长度
  RGB_LOCK_BASE: 64,   // RGB++ Lock 基础开销
  SPORE_TYPE_BASE: 32, // Spore Type 基础开销
} as const

// 估算 DoB 创建需要的 CKB 容量
export function estimateDoBAgeCapacity(
  coverSize: number,
  blessingLength: number,
  includeRgbppLock: boolean = true
): {
  capacity: bigint
  breakdown: {
    cellStructure: bigint
    lockScript: bigint
    typeScript: bigint
    data: bigint
    total: bigint
  }
} {
  // 1. 基础单元格结构开销
  const cellStructureSize = 
    BASIC_CELL_SIZE.CAPACITY +
    BASIC_CELL_SIZE.LOCK +
    BASIC_CELL_SIZE.TYPE +
    BASIC_CELL_SIZE.DATA_LENGTH
  
  const cellStructureCapacity = BigInt(cellStructureSize) * CKB_UNIT
  
  // 2. Lock 脚本开销
  let lockScriptSize = SCRIPT_SIZE.SECP256K1_LOCK
  if (includeRgbppLock) {
    lockScriptSize += SCRIPT_SIZE.RGB_LOCK_BASE
  }
  const lockScriptCapacity = BigInt(lockScriptSize) * CKB_UNIT
  
  // 3. Type 脚本开销 (Spore)
  const typeScriptSize = SCRIPT_SIZE.SPORE_TYPE_BASE
  const typeScriptCapacity = BigInt(typeScriptSize) * CKB_UNIT
  
  // 4. 数据开销
  // UTF-8 中文字符最多占 4 字节，英文 1 字节，这里保守估计平均 3 字节
  const estimatedBlessingBytes = blessingLength * 3
  
  // DoB 数据结构：JSON 格式包含 cover、blessing、metadata
  const metadataOverhead = 200 // JSON 结构、字段名、时间戳等开销
  const totalDataSize = coverSize + estimatedBlessingBytes + metadataOverhead
  const dataCapacity = BigInt(totalDataSize) * CKB_UNIT
  
  // 5. 计算总容量
  const totalCapacity = cellStructureCapacity + lockScriptCapacity + typeScriptCapacity + dataCapacity
  
  return {
    capacity: totalCapacity,
    breakdown: {
      cellStructure: cellStructureCapacity,
      lockScript: lockScriptCapacity,
      typeScript: typeScriptCapacity,
      data: dataCapacity,
      total: totalCapacity
    }
  }
}

// 估算转账费用
export function estimateTransferFee(
  inputCount: number = 1,
  outputCount: number = 2, // 通常包含目标输出和找零输出
  feeRate: bigint = 1000n // shannons per byte
): bigint {
  // 简化的交易大小估算
  const INPUT_SIZE = 32 + 4 + 8 + 4 // outpoint + witness length + lock args + script length
  const OUTPUT_SIZE = 8 + 32 + 1 + 32 + 1 + 4 // capacity + lock script + type script + data length
  const TRANSACTION_OVERHEAD = 64 // version, witnesses length, etc.
  
  const estimatedTxSize = 
    TRANSACTION_OVERHEAD +
    inputCount * INPUT_SIZE +
    outputCount * OUTPUT_SIZE
  
  return BigInt(estimatedTxSize) * feeRate
}

// 格式化容量显示
export function formatCapacity(
  capacity: bigint,
  precision: number = 2
): string {
  const ckbAmount = Number(capacity) / Number(CKB_UNIT)
  
  if (ckbAmount >= 1000000) {
    return (ckbAmount / 1000000).toFixed(precision) + 'M CKB'
  } else if (ckbAmount >= 1000) {
    return (ckbAmount / 1000).toFixed(precision) + 'K CKB'
  } else {
    return ckbAmount.toFixed(precision) + ' CKB'
  }
}

// 检查容量是否足够
export function isCapacitySufficient(
  availableCapacity: bigint,
  requiredCapacity: bigint,
  includeBuffer: boolean = true
): {
  sufficient: boolean
  shortfall: bigint
  bufferAmount: bigint
} {
  // 预留 10% 作为缓冲
  const bufferAmount = includeBuffer ? requiredCapacity / 10n : 0n
  const totalRequired = requiredCapacity + bufferAmount
  
  const sufficient = availableCapacity >= totalRequired
  const shortfall = sufficient ? 0n : totalRequired - availableCapacity
  
  return {
    sufficient,
    shortfall,
    bufferAmount
  }
}

// 优化建议
export function getOptimizationSuggestions(
  coverSize: number,
  blessingLength: number
): string[] {
  const suggestions: string[] = []
  
  // 封面大小建议
  if (coverSize > 500 * 1024) { // 500KB
    suggestions.push('封面图片过大，建议压缩到 500KB 以下以节省 CKB 容量')
  } else if (coverSize > 100 * 1024) { // 100KB
    suggestions.push('可以考虑压缩封面图片以节省 CKB 容量')
  }
  
  // 祝福语长度建议
  if (blessingLength > 500) {
    suggestions.push('祝福语过长，建议控制在 500 字符以内')
  } else if (blessingLength > 200) {
    suggestions.push('可以考虑精简祝福语以节省容量')
  }
  
  if (suggestions.length === 0) {
    suggestions.push('当前配置已经比较优化')
  }
  
  return suggestions
}