'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { RedPacket, CONSTANTS } from '@/types'
import { formatCapacity } from '@/lib/rgbpp/estimate'
import { useWallet } from '@/contexts/WalletContext'
import WalletConnectButton from '@/components/WalletConnectButton'

// 红包状态枚举
enum RedPacketStatus {
  DRAFT = 'DRAFT',
  FUNDED = 'FUNDED', 
  MIRRORED = 'MIRRORED'
}

export default function GiftPoolPage() {
  const [gifts, setGifts] = useState<RedPacket[]>([])
  const [loading, setLoading] = useState(false)
  
  // 使用全局钱包状态
  const { isConnected } = useWallet()

  // 加载红包列表
  useEffect(() => {
    loadGifts()
    // 定期刷新状态
    const interval = setInterval(loadGifts, 10000) // 每10秒刷新
    return () => clearInterval(interval)
  }, [])

  const loadGifts = async () => {
    // 从 localStorage 加载红包
    const savedGifts = JSON.parse(localStorage.getItem('redPackets') || '[]')
    
    // 从 drafts API 加载草稿状态
    try {
      const response = await fetch('/api/redpacket/drafts')
      if (response.ok) {
        const drafts = await response.json()
        // 合并 drafts 和 saved gifts
        const mergedGifts = [...savedGifts, ...drafts.filter((d: any) => 
          !savedGifts.find((g: any) => g.draftId === d.draftId)
        )]
        setGifts(mergedGifts)
      } else {
        setGifts(savedGifts)
      }
    } catch (e) {
      console.error('Failed to load drafts:', e)
      setGifts(savedGifts)
    }
  }

  // 获取状态显示文字和样式
  const getStatusDisplay = (gift: any) => {
    const status = gift.status || 'pending'
    
    switch (status) {
      case 'DRAFT':
        return {
          text: '草稿',
          className: 'bg-gray-100 text-gray-700',
          icon: '📝'
        }
      case 'FUNDED':
        return {
          text: '已注资',
          className: 'bg-yellow-100 text-yellow-700',
          icon: '💰'
        }
      case 'MIRRORED':
        return {
          text: '已镜像',
          className: 'bg-green-100 text-green-700',
          icon: '✅'
        }
      case 'pending':
        return {
          text: '待确认',
          className: 'bg-blue-100 text-blue-700',
          icon: '⏳'
        }
      case 'live':
        return {
          text: '已生效',
          className: 'bg-green-100 text-green-700',
          icon: '🎁'
        }
      default:
        return {
          text: status,
          className: 'bg-gray-100 text-gray-700',
          icon: '❓'
        }
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12">
      <div className="max-w-6xl mx-auto px-4">
        {/* 页面标题和钱包连接 */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">红包池</h1>
            <p className="text-gray-800 mt-2">查看所有创建的 RGB++ 红包</p>
          </div>
          
          {/* 钱包连接按钮 */}
          <WalletConnectButton />
        </div>

        {/* 红包列表 */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full"></div>
            <p className="mt-4 text-gray-800">加载中...</p>
          </div>
        ) : gifts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-800">暂无红包</p>
            <a
              href="/gift/new"
              className="inline-block mt-4 bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700"
            >
              创建第一个红包
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gifts.map((gift, index) => {
              const statusInfo = getStatusDisplay(gift)
              
              return (
                <div
                  key={gift.sporeId || gift.draftId || index}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
                >
                  {/* 封面图片 */}
                  <div className="aspect-video bg-gradient-to-br from-red-400 to-red-600 rounded-t-lg relative overflow-hidden">
                    {gift.coverUrl ? (
                      <Image
                        src={gift.coverUrl}
                        alt="红包封面"
                        layout="fill"
                        objectFit="cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <span className="text-white text-6xl">🧧</span>
                      </div>
                    )}
                    {/* 状态标签 */}
                    <div className={`absolute top-2 right-2 px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.className}`}>
                      {statusInfo.icon} {statusInfo.text}
                    </div>
                  </div>

                  {/* 红包信息 */}
                  <div className="p-4">
                    <p className="text-gray-900 mb-2">{gift.blessingText || '祝福满满'}</p>
                    
                    {/* 金额和占用信息 */}
                    <div className="flex justify-between text-sm text-gray-800 mb-3">
                      <span>金额: {gift.btcAmountSats ? `${(Number(gift.btcAmountSats) / 100000000).toFixed(8)} BTC` : 'N/A'}</span>
                      <span>占用: {gift.ckbBytesEstimate ? `${gift.ckbBytesEstimate} CKB` : 'N/A'}</span>
                    </div>

                    {/* 交易链接 */}
                    <div className="space-y-2">
                      {gift.btcTxId && (
                        <div className="text-xs">
                          <span className="text-gray-700">BTC: </span>
                          <a
                            href={`${CONSTANTS.BTC_TESTNET_EXPLORER}${gift.btcTxId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-mono"
                          >
                            {gift.btcTxId.slice(0, 8)}...{gift.btcTxId.slice(-8)}
                          </a>
                        </div>
                      )}
                      {gift.ckbTxHash && (
                        <div className="text-xs">
                          <span className="text-gray-700">CKB: </span>
                          <a
                            href={`${CONSTANTS.CKB_TESTNET_EXPLORER}${gift.ckbTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-mono"
                          >
                            {gift.ckbTxHash.slice(0, 8)}...{gift.ckbTxHash.slice(-8)}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* RGB++ 验证状态 */}
                    {gift.rgbppValidated !== undefined && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-700">RGB++ 强绑定:</span>
                          <span className={gift.rgbppValidated ? 'text-green-600' : 'text-yellow-600'}>
                            {gift.rgbppValidated ? '✅ 已验证' : '⏳ 待验证'}
                          </span>
                        </div>
                        {gift.btcConfirms !== undefined && (
                          <div className="flex items-center justify-between text-xs mt-1">
                            <span className="text-gray-700">BTC 确认数:</span>
                            <span className="text-gray-900">{gift.btcConfirms}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 只读提示 */}
                    <div className="mt-4 p-2 bg-gray-50 rounded text-xs text-gray-600 text-center">
                      📖 只读展示 (转移/赎回功能待开发)
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}