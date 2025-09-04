export type Hex = string
export type Hex32 = string

// 创建表单
export interface NewGiftForm {
  coverFile: File          // 图片
  blessingText: string     // 祝福语（UTF-8）
  btcAmountSats: bigint    // BTC 金额（sats）
}

// 红包实体（持久化/前端state）
export interface RedPacket {
  sporeId: Hex32
  ckbTxHash: Hex
  btcTxId: Hex
  btcVout: number
  ownerCkbLockHash?: Hex32
  coverCid?: string        // 可选：离线缓存/IPFS引用
  blessingText: string
  ckbBytesEstimate: number // 估算占用
  status: "pending" | "live" | "melted"
  btcConfirms: number
  createdAt: number
  // RGB++ 相关字段
  rgbppCommitHash?: string    // RGB++ commit hash
  rgbppValidated?: boolean    // RGB++ 验证状态
  opReturnData?: string       // OP_RETURN 数据
  isRealTransaction?: boolean // 标识是否为真实链上交易
}

// RGB++ witness（melt阶段用）
export interface RgbppMeltWitness {
  version: 1
  netByte: 0 | 1
  confsMin: number // 2
  sporeId: Hex32
  ownerLockHash: Hex32
  rawBtcTx: Hex
  merkleProof: Hex
  headersChain: Hex
}

// 钱包余额信息
export interface WalletBalance {
  address: string
  balance: bigint
}

// BTC UTXO 信息
export interface BtcUtxo {
  txid: string
  vout: number
  value: number
  confirmed: boolean
  confirmations: number
}

// SPV 证明数据
export interface SpvProof {
  rawTx: Hex
  merkleProof: Hex
  headersChain: Hex
  confirmations: number
}

// 常量定义
export const CONSTANTS = {
  OPRETURN_TAG: '0x5247422B2B01',
  CONFS_MIN: 2,
  NET_BYTE: 0x00, // testnet
  BTC_TESTNET_EXPLORER: 'https://mempool.space/testnet/tx/',
  CKB_TESTNET_EXPLORER: 'https://testnet.explorer.nervos.org/transaction/',
} as const