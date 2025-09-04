'use client'

import { useState } from 'react'
import { connectBtcWallet, getBtcBalance, getBtcAddress, createFundingTx } from '@/lib/joyid/bitcoin'
import { connectCkbWallet, getCkbBalance, getCkbAddress } from '@/lib/joyid/ckb'
import { validateRgbppUtxo, validateRgbppOpReturn } from '@/lib/rgbpp/validator'
import { computeCommitHash } from '@/lib/rgbpp/commit'
import { CONSTANTS } from '@/types'

export default function DebugPage() {
  const [btcInfo, setBtcInfo] = useState<any>(null)
  const [ckbInfo, setCkbInfo] = useState<any>(null)
  const [rgbppInfo, setRgbppInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }

  const testBtcConnection = async () => {
    try {
      setLoading(true)
      addLog('开始测试 BTC 连接...')
      addLog('使用地址类型: Native SegWit (P2WPKH)')
      
      const connection = await connectBtcWallet()
      addLog(`BTC 连接成功: ${connection.address}`)
      
      // 检测地址类型
      const addressType = getAddressType(connection.address)
      addLog(`地址类型检测结果: ${addressType}`)
      
      const balance = await getBtcBalance()
      addLog(`BTC 余额获取成功: ${Number(balance.balance)} sats`)
      addLog(`BTC 余额 (BTC): ${(Number(balance.balance) / 100000000).toFixed(8)} BTC`)
      
      setBtcInfo({ connection, balance, addressType })
    } catch (error) {
      addLog(`BTC 连接失败: ${error instanceof Error ? error.message : '未知错误'}`)
      setBtcInfo({ error: error instanceof Error ? error.message : '未知错误' })
    } finally {
      setLoading(false)
    }
  }

  const getAddressType = (address: string): string => {
    if (address.startsWith('bc1q')) return 'Native SegWit (P2WPKH) - Mainnet'
    if (address.startsWith('bc1p')) return 'Taproot (P2TR) - Mainnet'
    if (address.startsWith('tb1q')) return 'Native SegWit (P2WPKH) - Testnet'
    if (address.startsWith('tb1p')) return 'Taproot (P2TR) - Testnet'
    if (address.startsWith('3') || address.startsWith('2')) return 'Nested SegWit (P2SH-P2WPKH)'
    if (address.startsWith('1') || address.startsWith('m') || address.startsWith('n')) return 'Legacy (P2PKH)'
    return '未知地址格式'
  }

  const testCkbConnection = async () => {
    try {
      setLoading(true)
      addLog('开始测试 CKB 连接...')
      
      const connection = await connectCkbWallet()
      addLog(`CKB 连接成功: ${connection.address}`)
      
      const balance = await getCkbBalance()
      addLog(`CKB 余额获取成功: ${balance.balance.toString()} CKB`)
      
      setCkbInfo({ connection, balance })
    } catch (error) {
      addLog(`CKB 连接失败: ${error instanceof Error ? error.message : '未知错误'}`)
      setCkbInfo({ error: error instanceof Error ? error.message : '未知错误' })
    } finally {
      setLoading(false)
    }
  }

  const testRgbppValidation = async () => {
    try {
      setLoading(true)
      addLog('开始测试 RGB++ 验证...')
      
      // 1. 测试创建资金交易
      addLog('🔄 创建测试资金交易...')
      const fundingResult = await createFundingTx(BigInt(10000)) // 10000 sats
      addLog(`✅ 资金交易创建: ${fundingResult.txid}:${fundingResult.vout}`)
      
      // 2. 测试 UTXO 验证
      addLog('🔍 验证 UTXO 有效性...')
      const isUtxoValid = await validateRgbppUtxo(fundingResult.txid, fundingResult.vout)
      addLog(`${isUtxoValid ? '✅' : '❌'} UTXO 验证: ${isUtxoValid ? '通过' : '失败'}`)
      
      // 3. 测试 commit hash 计算
      addLog('🔒 计算 RGB++ commit hash...')
      const mockCkbTxHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')
      const commitHash = await computeCommitHash(mockCkbTxHash)
      addLog(`📝 Commit Hash: ${commitHash}`)
      
      // 4. 测试 OP_RETURN 验证
      addLog('📋 验证 OP_RETURN 数据...')
      const opReturnData = CONSTANTS.OPRETURN_TAG + commitHash
      const isOpReturnValid = validateRgbppOpReturn(opReturnData)
      addLog(`${isOpReturnValid ? '✅' : '❌'} OP_RETURN 验证: ${isOpReturnValid ? '通过' : '失败'}`)
      addLog(`📄 OP_RETURN 数据: ${opReturnData}`)
      
      // 5. 汇总结果
      const validationResult = {
        utxoValid: isUtxoValid,
        opReturnValid: isOpReturnValid,
        commitHash,
        opReturnData,
        fundingTx: fundingResult
      }
      
      setRgbppInfo(validationResult)
      addLog(`🎯 RGB++ 验证完成，整体状态: ${isUtxoValid && isOpReturnValid ? '通过' : '部分失败'}`)
      
    } catch (error) {
      addLog(`❌ RGB++ 验证失败: ${error instanceof Error ? error.message : '未知错误'}`)
      setRgbppInfo({ error: error instanceof Error ? error.message : '未知错误' })
    } finally {
      setLoading(false)
    }
  }

  const clearLogs = () => {
    setLogs([])
    setBtcInfo(null)
    setCkbInfo(null)
    setRgbppInfo(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">JoyID 钱包调试页面</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* BTC 测试 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">BTC 钱包测试</h2>
            <button
              onClick={testBtcConnection}
              disabled={loading}
              className="w-full bg-orange-500 text-white py-2 px-4 rounded hover:bg-orange-600 disabled:opacity-50 mb-4"
            >
              {loading ? '连接中...' : '测试 BTC 连接'}
            </button>
            
            {btcInfo && (
              <div className="text-sm">
                {btcInfo.error ? (
                  <div className="text-red-600 p-3 bg-red-50 rounded">
                    <strong>错误:</strong> {btcInfo.error}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="p-3 bg-green-50 rounded">
                      <strong>地址:</strong>
                      <div className="font-mono text-xs break-all">{btcInfo.connection?.address}</div>
                      {btcInfo.addressType && (
                        <div className="text-xs text-green-600 mt-1">
                          <strong>类型:</strong> {btcInfo.addressType}
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-blue-50 rounded">
                      <strong>余额:</strong> {Number(btcInfo.balance?.balance || 0).toLocaleString()} sats
                      <div className="text-xs text-gray-800">
                        ≈ {(Number(btcInfo.balance?.balance || 0) / 100000000).toFixed(8)} BTC
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CKB 测试 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">CKB 钱包测试</h2>
            <button
              onClick={testCkbConnection}
              disabled={loading}
              className="w-full bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 disabled:opacity-50 mb-4"
            >
              {loading ? '连接中...' : '测试 CKB 连接'}
            </button>
            
            {ckbInfo && (
              <div className="text-sm">
                {ckbInfo.error ? (
                  <div className="text-red-600 p-3 bg-red-50 rounded">
                    <strong>错误:</strong> {ckbInfo.error}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="p-3 bg-green-50 rounded">
                      <strong>地址:</strong>
                      <div className="font-mono text-xs break-all">{ckbInfo.connection?.address}</div>
                    </div>
                    <div className="p-3 bg-blue-50 rounded">
                      <strong>余额:</strong> {ckbInfo.balance?.balance?.toString()} shannon
                      <div className="text-xs text-gray-800">
                        ≈ {(Number(ckbInfo.balance?.balance || 0n) / Number(10n ** 8n)).toFixed(2)} CKB
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RGB++ 测试 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">RGB++ 验证测试</h2>
            <button
              onClick={testRgbppValidation}
              disabled={loading}
              className="w-full bg-purple-500 text-white py-2 px-4 rounded hover:bg-purple-600 disabled:opacity-50 mb-4"
            >
              {loading ? '测试中...' : '测试 RGB++ 验证'}
            </button>
            
            {rgbppInfo && (
              <div className="text-sm">
                {rgbppInfo.error ? (
                  <div className="text-red-600 p-3 bg-red-50 rounded">
                    <strong>错误:</strong> {rgbppInfo.error}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className={`p-3 rounded ${rgbppInfo.utxoValid ? 'bg-green-50' : 'bg-amber-50'}`}>
                      <strong>UTXO 验证:</strong>
                      <span className={`ml-2 ${rgbppInfo.utxoValid ? 'text-green-600' : 'text-amber-600'}`}>
                        {rgbppInfo.utxoValid ? '✅ 通过' : '⚠️ 失败（使用模拟数据）'}
                      </span>
                    </div>
                    <div className={`p-3 rounded ${rgbppInfo.opReturnValid ? 'bg-green-50' : 'bg-red-50'}`}>
                      <strong>OP_RETURN 验证:</strong>
                      <span className={`ml-2 ${rgbppInfo.opReturnValid ? 'text-green-600' : 'text-red-600'}`}>
                        {rgbppInfo.opReturnValid ? '✅ 通过' : '❌ 失败'}
                      </span>
                    </div>
                    <div className="p-3 bg-blue-50 rounded">
                      <strong>Commit Hash:</strong>
                      <div className="font-mono text-xs break-all mt-1">{rgbppInfo.commitHash}</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded">
                      <strong>资金交易:</strong>
                      <div className="font-mono text-xs break-all mt-1">
                        {rgbppInfo.fundingTx?.txid}:{rgbppInfo.fundingTx?.vout}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 日志 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">连接日志</h2>
            <button
              onClick={clearLogs}
              className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
            >
              清空日志
            </button>
          </div>
          
          <div className="bg-black text-green-400 font-mono text-xs p-4 rounded h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-gray-700">点击测试按钮开始调试...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">{log}</div>
              ))
            )}
          </div>
        </div>

        {/* 说明 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
          <h3 className="font-semibold text-yellow-800 mb-2">使用说明</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• 请确保已安装 JoyID 钱包浏览器扩展</li>
            <li>• 请确保 JoyID 钱包已登录</li>
            <li>• BTC 使用测试网络（Bitcoin Testnet）</li>
            <li>• BTC 地址类型：Native SegWit (P2WPKH) - tb1q... 格式</li>
            <li>• CKB 使用测试网络（Nervos Testnet）</li>
            <li>• RGB++ 测试包含：UTXO 验证、OP_RETURN 格式验证、Commit Hash 计算</li>
            <li>• 如果连接失败，请检查浏览器控制台查看详细错误信息</li>
          </ul>
        </div>
        
        {/* RGB++ 升级说明 */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mt-4">
          <h3 className="font-semibold text-purple-800 mb-2">🎉 RGB++ P1 升级完成</h3>
          <ul className="text-sm text-purple-700 space-y-1">
            <li>✅ 真实 BTC PSBT 交易创建 (支持回退到模拟数据)</li>
            <li>✅ 真实 CKB DoB 铸造 (支持回退到模拟数据)</li>
            <li>✅ RGB++ 协议约束验证 (UTXO、OP_RETURN、绑定关系)</li>
            <li>✅ 增强错误处理和用户反馈</li>
            <li>🔗 红包池显示 RGB++ 验证状态</li>
            <li>📋 调试页面支持 RGB++ 验证测试</li>
          </ul>
        </div>

        <div className="text-center mt-8">
          <a
            href="/gift/new"
            className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700"
          >
            返回创建红包
          </a>
        </div>
      </div>
    </div>
  )
}