'use client'

import { useState } from 'react'
import { connectBtcWallet, getBtcBalance, createFundingTx, getCurrentBtcAddressInfo } from '@/lib/joyid/bitcoin'
import { connectCkbWallet, getCkbBalance, mintDoB } from '@/lib/joyid/ckb'

export default function TestRealTxPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)
  const [results, setResults] = useState<any>({})
  
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }
  
  // 检查当前 JoyID BTC 地址信息
  const checkCurrentAddress = async () => {
    try {
      setLoading(true)
      setLogs([])
      
      addLog('🔍 检查当前 JoyID BTC 地址信息...')
      
      const info = await getCurrentBtcAddressInfo()
      
      if (!info.isConnected) {
        addLog('❌ JoyID BTC 钱包未连接')
        addLog('💡 请先连接钱包')
        return
      }
      
      addLog(`✅ JoyID BTC 钱包已连接`)
      addLog(`📍 地址: ${info.address}`)
      addLog(`🏷️ 地址类型: ${info.addressType}`)
      addLog(`🌐 网络: ${info.network}`)
      addLog(`📏 地址长度: ${info.address.length} 字符`)
      
      // 检查地址格式建议
      if (info.addressType === 'Taproot (P2TR)') {
        addLog('')
        addLog('⚠️ 当前使用的是 Taproot 地址')
        addLog('💡 建议切换到 Native SegWit (tb1q开头) 以获得更好的兼容性')
        addLog('🔧 在 JoyID 钱包中寻找地址类型切换选项')
      } else if (info.addressType === 'Native SegWit (P2WPKH)') {
        addLog('')
        addLog('✅ 使用的是 Native SegWit 地址 (推荐格式)')
      }
      
    } catch (error) {
      addLog(`❌ 错误: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // 单独测试余额获取
  const checkBalance = async () => {
    try {
      setLoading(true)
      setLogs([])
      
      addLog('🔍 检查钱包余额...')
      
      // 连接 BTC 钱包
      addLog('连接 BTC 钱包...')
      const btc = await connectBtcWallet()
      addLog(`✅ BTC 钱包已连接`)
      addLog(`📍 地址: ${btc.address}`)
      
      // 获取余额 (会显示详细日志)
      addLog('查询 BTC 余额...')
      const btcBalance = await getBtcBalance()
      addLog(`💰 余额: ${Number(btcBalance.balance)} sats`)
      addLog(`💰 余额: ${(Number(btcBalance.balance) / 100000000).toFixed(8)} BTC`)
      
      if (Number(btcBalance.balance) === 0) {
        addLog('⚠️ 余额为 0 - 需要获取测试币')
        addLog('💡 请访问: https://testnet-faucet.mempool.co/')
        addLog(`📋 复制地址: ${btc.address}`)
      }
      
    } catch (error) {
      addLog(`❌ 错误: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const testTransaction = async () => {
    try {
      setLoading(true)
      setLogs([])
      
      addLog('🚀 开始真实交易测试...')
      setStep(1)
      
      // 1. 连接 BTC 钱包
      addLog('连接 BTC 钱包...')
      const btc = await connectBtcWallet()
      const btcBalance = await getBtcBalance()
      addLog(`BTC: ${btc.address}`)
      addLog(`余额: ${Number(btcBalance.balance)} sats`)
      setStep(2)
      
      // 2. 连接 CKB 钱包
      addLog('连接 CKB 钱包...')
      const ckb = await connectCkbWallet()
      const ckbBalance = await getCkbBalance()
      addLog(`CKB: ${ckb.address}`)
      addLog(`余额: ${Number(ckbBalance.balance) / 1e8} CKB`)
      setStep(3)
      
      // 3. 创建 BTC 交易
      addLog('创建 BTC 交易...')
      const btcTx = await createFundingTx(10000n)
      addLog(`BTC TX: ${btcTx.txid}`)
      setResults(prev => ({ ...prev, btc: btcTx }))
      setStep(4)
      
      // 3.5. 等待 BTC 交易确认
      addLog('等待 BTC 交易确认...')
      addLog('💡 RGB++ 协议要求至少 1 个确认')
      
      let confirmations = 0
      let retryCount = 0
      const maxRetries = 5 // 减少等待时间，最多等待 5 次
      
      while (confirmations < 1 && retryCount < maxRetries) {
        try {
          const txResponse = await fetch(`https://mempool.space/testnet/api/tx/${btcTx.txid}`)
          if (txResponse.ok) {
            const txData = await txResponse.json()
            if (txData.status?.confirmed) {
              const tipResponse = await fetch('https://mempool.space/testnet/api/blocks/tip/height')
              const tipHeight = await tipResponse.json()
              confirmations = tipHeight - txData.status.block_height + 1
              addLog(`✅ BTC 交易已确认 ${confirmations} 次`)
              break
            }
          }
        } catch (e) {
          // 忽略错误，继续等待
        }
        
        addLog(`⏳ 等待确认中... (${retryCount + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, 15000)) // 等待 15 秒
        retryCount++
      }
      
      if (confirmations < 1) {
        addLog('⚠️ BTC 交易尚未确认，继续创建 CKB 交易')
        addLog('📝 注意：CKB 交易可能因 RGB++ 约束失败')
      }
      
      // 4. 创建 CKB DoB
      addLog('创建 CKB DoB...')
      const cover = new TextEncoder().encode('Test Red Packet')
      const blessing = '测试红包 - 真实交易'
      const dobTx = await mintDoB(cover, blessing, btcTx.txid, btcTx.vout)
      addLog(`CKB DoB: ${dobTx.sporeId}`)
      setResults(prev => ({ ...prev, ckb: dobTx }))
      setStep(5)
      
      // 5. 保存到本地存储
      const redPacket = {
        sporeId: dobTx.sporeId,
        ckbTxHash: dobTx.txHash,
        btcTxId: btcTx.txid,
        btcVout: btcTx.vout,
        blessingText: blessing,
        ckbBytesEstimate: 100,
        status: 'pending',
        btcConfirms: 0,
        createdAt: Date.now(),
        isRealTransaction: true
      }
      
      const gifts = JSON.parse(localStorage.getItem('redPackets') || '[]')
      gifts.push(redPacket)
      localStorage.setItem('redPackets', JSON.stringify(gifts))
      
      addLog('✅ 真实红包创建完成！')
      addLog('已保存到红包池，可查看详情')
      
    } catch (error) {
      addLog(`❌ 错误: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">
          🚀 真实交易测试
        </h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">进度</h2>
          <div className="space-y-2">
            <div className={`flex items-center space-x-2 ${step >= 1 ? 'text-green-600' : 'text-gray-700'}`}>
              <span>{step >= 1 ? '✅' : '⏳'}</span>
              <span>连接 BTC 钱包</span>
            </div>
            <div className={`flex items-center space-x-2 ${step >= 2 ? 'text-green-600' : 'text-gray-700'}`}>
              <span>{step >= 2 ? '✅' : '⏳'}</span>
              <span>连接 CKB 钱包</span>
            </div>
            <div className={`flex items-center space-x-2 ${step >= 3 ? 'text-green-600' : 'text-gray-700'}`}>
              <span>{step >= 3 ? '✅' : '⏳'}</span>
              <span>创建 BTC 交易</span>
            </div>
            <div className={`flex items-center space-x-2 ${step >= 4 ? 'text-green-600' : 'text-gray-700'}`}>
              <span>{step >= 4 ? '✅' : '⏳'}</span>
              <span>创建 CKB DoB</span>
            </div>
            <div className={`flex items-center space-x-2 ${step >= 5 ? 'text-green-600' : 'text-gray-700'}`}>
              <span>{step >= 5 ? '✅' : '⏳'}</span>
              <span>保存红包</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex space-x-4 mb-4 flex-wrap gap-2">
            <button
              onClick={checkCurrentAddress}
              disabled={loading}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? '检查中...' : '检查地址'}
            </button>
            <button
              onClick={checkBalance}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '检查中...' : '检查余额'}
            </button>
            <button
              onClick={testTransaction}
              disabled={loading}
              className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? '执行中...' : '开始测试'}
            </button>
            <button
              onClick={() => {setLogs([]); setStep(0); setResults({})}}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              清空
            </button>
            <a href="/gift/pool" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              查看红包池
            </a>
          </div>
          
          {Object.keys(results).length > 0 && (
            <div className="mb-4 p-4 bg-green-50 rounded">
              <h3 className="font-semibold mb-2">交易结果:</h3>
              {results.btc && <p className="text-sm">BTC: {results.btc.txid}</p>}
              {results.ckb && <p className="text-sm">CKB: {results.ckb.sporeId}</p>}
            </div>
          )}
          
          <div className="bg-black text-green-400 font-mono text-sm p-4 rounded h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-gray-700">点击开始测试...</div>
            ) : (
              logs.map((log, i) => <div key={i}>{log}</div>)
            )}
          </div>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">注意事项:</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• 确保 JoyID 钱包已连接</li>
            <li>• BTC 需要至少 20,000 sats</li>
            <li>• CKB 需要至少 100 CKB</li>
            <li>• 这将创建真实的区块链交易</li>
          </ul>
        </div>
        
        <div className="text-center mt-6">
          <a href="/" className="text-blue-600 hover:underline">← 返回首页</a>
        </div>
      </div>
    </div>
  )
}