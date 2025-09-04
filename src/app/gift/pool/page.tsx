'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { RedPacket, CONSTANTS } from '@/types'
import { connectCkbWallet, transferDoB, meltDoB } from '@/lib/joyid/ckb'
import { getUtxoInfo, spendUtxoWithOpReturn } from '@/lib/joyid/bitcoin'
import { computeCommitHash, computeFullCommitHash, verifyOpReturn } from '@/lib/rgbpp/commit'
import { fetchSPVProof, verifySPVProof } from '@/lib/rgbpp/spv'
import { formatCapacity } from '@/lib/rgbpp/estimate'
import { useWallet } from '@/contexts/WalletContext'
import WalletConnectButton from '@/components/WalletConnectButton'

export default function GiftPoolPage() {
  const [gifts, setGifts] = useState<RedPacket[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedGift, setSelectedGift] = useState<RedPacket | null>(null)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showMeltModal, setShowMeltModal] = useState(false)
  const [transferAddress, setTransferAddress] = useState('')
  const [error, setError] = useState<string | null>(null)
  
  // 使用全局钱包状态
  const { isConnected } = useWallet()

  // 加载红包列表
  useEffect(() => {
    loadGifts()
    updateGiftStatuses()
  }, [])
  
  // 调试信息
  useEffect(() => {
    console.log('红包池状态:', {
      钱包连接状态: isConnected,
      红包数量: gifts.length,
      红包详情: gifts.map(g => ({ 
        sporeId: g.sporeId.slice(0, 8) + '...', 
        状态: g.status, 
        确认数: g.btcConfirms,
        是否显示按钮: g.status === 'live' && isConnected
      }))
    })
  }, [isConnected, gifts])

  const loadGifts = () => {
    const savedGifts = JSON.parse(localStorage.getItem('redPackets') || '[]')
    setGifts(savedGifts)
  }

  // 更新红包状态（确认数等）
  const updateGiftStatuses = async () => {
    const savedGifts = JSON.parse(localStorage.getItem('redPackets') || '[]')
    
    const updatedGifts = await Promise.all(
      savedGifts.map(async (gift: RedPacket) => {
        try {
          const utxoInfo = await getUtxoInfo(gift.btcTxId, gift.btcVout)
          return {
            ...gift,
            btcConfirms: utxoInfo.confirmations,
            status: utxoInfo.confirmations >= CONSTANTS.CONFS_MIN ? 'live' : 'pending'
          }
        } catch {
          return gift
        }
      })
    )
    
    setGifts(updatedGifts)
    localStorage.setItem('redPackets', JSON.stringify(updatedGifts))
  }

  // 移除了本地钱包连接函数，使用全局钱包状态

  // 转移红包
  const handleTransfer = async () => {
    if (!selectedGift || !transferAddress.trim()) {
      setError('请输入有效的 CKB 地址')
      return
    }

    // 验证地址格式
    if (!transferAddress.trim().startsWith('ckt1')) {
      setError('请输入有效的 CKB testnet 地址 (以 ckt1 开头)')
      return
    }

    // 检查红包状态
    if (selectedGift.status !== 'live') {
      setError('只能转移处于激活状态的红包')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      console.log('正在转移红包...', selectedGift.sporeId, '到地址:', transferAddress.trim())
      
      const txHash = await transferDoB(selectedGift.sporeId, transferAddress.trim())
      
      // 更新本地状态
      const updatedGifts = gifts.map(gift => 
        gift.sporeId === selectedGift.sporeId 
          ? { ...gift, status: 'melted' as const }
          : gift
      )
      setGifts(updatedGifts)
      localStorage.setItem('redPackets', JSON.stringify(updatedGifts))
      
      setShowTransferModal(false)
      setSelectedGift(null)
      setTransferAddress('')
      
      alert(`转移成功！交易哈希: ${txHash}`)
    } catch (err) {
      console.error('转移失败:', err)
      setError(err instanceof Error ? err.message : '转移失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  // 销毁红包（需要先花费 BTC UTXO）
  const handleMelt = async () => {
    if (!selectedGift) return

    // 检查红包状态
    if (selectedGift.status !== 'live') {
      setError('只能销毁处于激活状态的红包')
      return
    }

    try {
      setLoading(true)
      setError(null)

      console.log('开始销毁红包:', selectedGift.sporeId)

      // 步骤 1: 检查必要字段
      if (!selectedGift.ownerCkbLockHash) {
        throw new Error('红包缺少 ownerCkbLockHash 字段，无法执行销毁操作。这可能是旧版本创建的红包，请联系开发者。')
      }

      console.log('正在计算 RGB++ commit hash...')

      // 步骤 1: 计算 commit hash
      const commitHash = await computeFullCommitHash(
        CONSTANTS.NET_BYTE,
        selectedGift.btcTxId,
        selectedGift.btcVout,
        selectedGift.sporeId,
        selectedGift.ownerCkbLockHash,
        CONSTANTS.CONFS_MIN
      )
      
      console.log('Commit hash 计算完成:', commitHash)

      console.log('正在花费 BTC UTXO 并添加 OP_RETURN 数据...')

      // 步骤 2: 花费 BTC UTXO 并添加 OP_RETURN
      const spendTxId = await spendUtxoWithOpReturn(
        selectedGift.btcTxId,
        selectedGift.btcVout,
        commitHash.slice(2) // 移除 0x 前缀
      )

      console.log('BTC 花费交易已提交:', spendTxId)
      alert(`BTC 花费交易已提交: ${spendTxId}，请等待确认后继续销毁流程`)

      // 步骤 3: 等待确认并获取 SPV 证明
      // 实际应用中需要轮询确认状态
      console.log('等待 BTC 交易确认...')
      setTimeout(async () => {
        try {
          console.log('正在获取 SPV 证明...')
          const spvProof = await fetchSPVProof(spendTxId)
          
          console.log('正在验证 SPV 证明...')
          // 验证 SPV 证明
          const verification = await verifySPVProof(spvProof, spendTxId)
          if (!verification.valid) {
            throw new Error('SPV 证明验证失败: ' + verification.errors.join(', '))
          }

          console.log('正在验证 OP_RETURN 数据...')
          // 验证 OP_RETURN
          if (verification.opReturnData) {
            const opReturnValid = verifyOpReturn(verification.opReturnData, commitHash)
            if (!opReturnValid) {
              throw new Error('OP_RETURN 数据验证失败')
            }
          }

          console.log('正在执行 CKB DoB 销毁...')
          // 步骤 4: 执行 CKB 销毁
          const meltTxHash = await meltDoB(selectedGift.sporeId, {
            rawBtcTx: spvProof.rawTx,
            merkleProof: spvProof.merkleProof,
            headersChain: spvProof.headersChain
          })

          console.log('销毁操作完成，更新本地状态...')
          // 更新状态
          const updatedGifts = gifts.map(gift => 
            gift.sporeId === selectedGift.sporeId 
              ? { ...gift, status: 'melted' as const }
              : gift
          )
          setGifts(updatedGifts)
          localStorage.setItem('redPackets', JSON.stringify(updatedGifts))

          alert(`销毁成功！CKB 交易哈希: ${meltTxHash}`)
          console.log('红包销毁成功完成!')
        } catch (err) {
          console.error('SPV 验证或销毁失败:', err)
          setError(err instanceof Error ? err.message : 'SPV 验证或销毁失败，请稍后重试')
        }
      }, 30000) // 等待 30 秒模拟确认时间

      setShowMeltModal(false)
      setSelectedGift(null)
    } catch (err) {
      console.error('销毁过程失败:', err)
      setError(err instanceof Error ? err.message : '销毁失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      case 'live': return 'text-green-600 bg-green-100'
      case 'melted': return 'text-gray-800 bg-gray-100'
      default: return 'text-gray-800 bg-gray-100'
    }
  }

  const getStatusText = (status: string, confirmations: number) => {
    switch (status) {
      case 'pending': return `待确认 (${confirmations}/${CONSTANTS.CONFS_MIN})`
      case 'live': return `已激活 (${confirmations} 确认)`
      case 'melted': return '已销毁'
      default: return '未知状态'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">红包池</h1>
          <div className="flex items-center space-x-4">
            <WalletConnectButton />
            <a
              href="/gift/new"
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              创建新红包
            </a>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg">
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 text-red-600 hover:text-red-800 underline"
            >
              关闭
            </button>
          </div>
        )}

        {gifts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🎁</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">暂无红包</h2>
            <p className="text-gray-700">创建您的第一个红包吧！</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gifts.map((gift) => (
              <div key={gift.sporeId} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                {/* 红包卡片内容 */}
                <div className="p-6">
                  {/* 状态标签 */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(gift.status)}`}>
                        {getStatusText(gift.status, gift.btcConfirms)}
                      </span>
                      {/* RGB++ 验证状态 */}
                      {gift.rgbppValidated !== undefined && (
                        <div className="flex items-center space-x-1">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            gift.rgbppValidated 
                              ? 'text-green-700 bg-green-50 border border-green-200' 
                              : 'text-amber-700 bg-amber-50 border border-amber-200'
                          }`}>
                            {gift.rgbppValidated ? '🔗 RGB++ 验证通过' : '⚠️ RGB++ 模拟数据'}
                          </span>
                        </div>
                      )}
                      {/* 真实交易标识 */}
                      {gift.isRealTransaction && (
                        <div className="flex items-center space-x-1">
                          <span className="px-2 py-1 rounded text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200">
                            🚀 真实链上交易
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-700">
                      {new Date(gift.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* 祝福语 */}
                  <div className="mb-4">
                    <h3 className="font-semibold text-lg mb-2">祝福语</h3>
                    <p className="text-gray-700 line-clamp-3">{gift.blessingText}</p>
                  </div>

                  {/* 详细信息 */}
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-800">DoB ID:</span>
                      <div className="font-mono text-xs break-all">{gift.sporeId}</div>
                    </div>
                    <div>
                      <span className="text-gray-800">CKB 占用:</span>
                      <span className="ml-2 font-medium">{gift.ckbBytesEstimate} CKB</span>
                    </div>
                    <div>
                      <span className="text-gray-800">BTC 金额:</span>
                      <span className="ml-2 font-medium">{gift.btcTxId ? 'Linked' : 'N/A'}</span>
                    </div>
                    {/* RGB++ 详细信息 */}
                    {gift.rgbppCommitHash && (
                      <div>
                        <span className="text-gray-800">RGB++ Hash:</span>
                        <div className="font-mono text-xs break-all">{gift.rgbppCommitHash}</div>
                      </div>
                    )}
                    {gift.opReturnData && (
                      <div>
                        <span className="text-gray-800">OP_RETURN:</span>
                        <div className="font-mono text-xs break-all">{gift.opReturnData}</div>
                      </div>
                    )}
                  </div>

                  {/* 交易链接 */}
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <div>
                      <a
                        href={`${CONSTANTS.BTC_TESTNET_EXPLORER}${gift.btcTxId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-xs"
                      >
                        查看 BTC 交易 ↗
                      </a>
                    </div>
                    <div>
                      <a
                        href={`${CONSTANTS.CKB_TESTNET_EXPLORER}${gift.ckbTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-xs"
                      >
                        查看 CKB 交易 ↗
                      </a>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  {gift.status === 'live' && isConnected && (
                    <div className="mt-4 pt-4 border-t flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedGift(gift)
                          setShowTransferModal(true)
                        }}
                        className="flex-1 bg-blue-600 text-white py-2 px-3 rounded text-sm hover:bg-blue-700"
                      >
                        转移
                      </button>
                      <button
                        onClick={() => {
                          setSelectedGift(gift)
                          setShowMeltModal(true)
                        }}
                        className="flex-1 bg-red-600 text-white py-2 px-3 rounded text-sm hover:bg-red-700"
                      >
                        销毁
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 转移模态框 */}
        {showTransferModal && selectedGift && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-lg font-semibold mb-4">转移红包</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    目标 CKB 地址
                  </label>
                  <input
                    type="text"
                    value={transferAddress}
                    onChange={(e) => setTransferAddress(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="ckt1..."
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setShowTransferModal(false)
                      setSelectedGift(null)
                      setTransferAddress('')
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleTransfer}
                    disabled={loading || !transferAddress.trim()}
                    className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? '转移中...' : '确认转移'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 销毁确认模态框 */}
        {showMeltModal && selectedGift && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-lg font-semibold mb-4">销毁红包</h2>
              <div className="space-y-4">
                <p className="text-sm text-gray-700">
                  销毁操作将：
                </p>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>1. 花费关联的 BTC UTXO</li>
                  <li>2. 等待 BTC 交易确认</li>
                  <li>3. 销毁 CKB 上的 DoB</li>
                  <li>4. 释放 CKB 容量到您的地址</li>
                </ul>
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <p className="text-sm text-yellow-800">
                    ⚠️ 此操作不可逆转，请确认要销毁此红包
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setShowMeltModal(false)
                      setSelectedGift(null)
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleMelt}
                    disabled={loading}
                    className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    {loading ? '销毁中...' : '确认销毁'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}