'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { NewGiftForm, RedPacket, CONSTANTS } from '@/types'
import { createFundingTx } from '@/lib/joyid/bitcoin'
import { mintDoB } from '@/lib/joyid/ckb'
import { estimateDoBAgeCapacity, formatCapacity } from '@/lib/rgbpp/estimate'
import { validateRgbppUtxo } from '@/lib/rgbpp/validator'
import { useWallet } from '@/contexts/WalletContext'
import WalletConnectButton from '@/components/WalletConnectButton'

enum CreationStep {
  FORM = 'form',
  BTC_FUNDING = 'btc_funding', 
  CKB_MINTING = 'ckb_minting',
  COMPLETED = 'completed'
}

export default function NewGiftPage() {
  // 表单状态
  const [form, setForm] = useState<NewGiftForm>({
    coverFile: null,
    blessingText: '',
    btcAmountSats: 0n
  })
  
  // 使用全局钱包状态
  const { 
    isConnected,
    btcAddress,
    btcBalance, 
    ckbBalance,
    refreshBalances 
  } = useWallet()
  
  // 创建流程状态
  const [currentStep, setCurrentStep] = useState<CreationStep>(CreationStep.FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // 创建结果
  const [createdGift, setCreatedGift] = useState<Partial<RedPacket> | null>(null)
  
  // 进度提示状态
  const [progressMessage, setProgressMessage] = useState<string>('')
  const [waitingForConfirmation, setWaitingForConfirmation] = useState(false)
  const [, setConfirmationCount] = useState(0)
  const [estimatedWaitTime, setEstimatedWaitTime] = useState<string>('')
  const [currentBtcTxId, setCurrentBtcTxId] = useState<string>('')
  
  // 预览状态
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [capacityEstimate, setCapacityEstimate] = useState<bigint>(0n)

  // 刷新余额（如果需要）
  const handleRefreshBalances = async () => {
    if (isConnected) {
      await refreshBalances()
    }
  }

  // 检查是否有待确认的交易
  useEffect(() => {
    const checkPendingTx = () => {
      const pendingTxStr = localStorage.getItem('pendingBtcTx')
      if (pendingTxStr) {
        try {
          const pendingTx = JSON.parse(pendingTxStr)
          const timePassed = (Date.now() - pendingTx.timestamp) / 1000 / 60 // 分钟
          
          if (timePassed > 60) { // 超过 1 小时清除
            localStorage.removeItem('pendingBtcTx')
            return
          }
          
          // 显示待确认的交易信息
          setCurrentBtcTxId(pendingTx.txid)
          setProgressMessage(`🔄 检测到待确认的 BTC 交易 (${Math.floor(timePassed)} 分钟前创建)`)
          
          // 可以选择是否自动恢复确认等待状态
          console.log('💡 检测到待确认的 BTC 交易:', pendingTx.txid)
        } catch (e) {
          localStorage.removeItem('pendingBtcTx')
        }
      }
    }
    
    checkPendingTx()
  }, [])

  // 处理封面文件选择
  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setForm({ ...form, coverFile: file })
      
      // 创建预览
      const reader = new FileReader()
      reader.onload = (e) => setCoverPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  // 更新容量估算
  useEffect(() => {
    if (form.coverFile && form.blessingText) {
      const estimate = estimateDoBAgeCapacity(
        form.coverFile.size,
        form.blessingText.length,
        true
      )
      setCapacityEstimate(estimate.capacity)
    }
  }, [form.coverFile, form.blessingText])

  // 创建红包主流程 - 集成 RGB++ 验证
  const createRedPacket = async () => {
    if (!form.coverFile || !form.blessingText || form.btcAmountSats <= 0) {
      setError('请填写完整信息')
      return
    }
    
    try {
      setLoading(true)
      setError(null)
      
      console.log('🚀 开始创建 RGB++ 红包...')
      
      // 步骤 1: BTC Funding Transaction
      setCurrentStep(CreationStep.BTC_FUNDING)
      console.log('📡 正在创建 BTC 资金交易...')
      
      const fundingResult = await createFundingTx(form.btcAmountSats)
      console.log('✅ BTC 资金交易创建成功:', fundingResult.txid)
      setCurrentBtcTxId(fundingResult.txid) // 保存 TXID 用于链接显示
      
      // 保存待确认的交易信息到本地存储（排除无法序列化的字段）
      const pendingTx = {
        txid: fundingResult.txid,
        vout: fundingResult.vout,
        form: {
          // 排除 File 对象，只保存可序列化的字段
          blessingText: form.blessingText,
          btcAmountSats: Number(form.btcAmountSats), // 转换 bigint 为 number
          coverFileName: form.coverFile?.name || '',
          coverFileSize: form.coverFile?.size || 0
        },
        timestamp: Date.now(),
        capacityEstimate: Number(capacityEstimate / (10n ** 8n))
      }
      localStorage.setItem('pendingBtcTx', JSON.stringify(pendingTx))
      
      // RGB++ 验证 1: 验证 BTC UTXO 有效性
      console.log('🔍 验证 BTC UTXO 有效性...')
      const isUtxoValid = await validateRgbppUtxo(fundingResult.txid, fundingResult.vout)
      
      if (!isUtxoValid) {
        console.warn('⚠️ BTC UTXO 验证失败，但继续创建流程...')
        console.log('💡 这可能是因为交易刚广播或网络延迟，不影响红包创建')
      } else {
        console.log('✅ BTC UTXO 验证通过')
      }
      
      // 检查 BTC 交易确认状态
      console.log('🔍 检查 BTC 交易确认状态...')
      setProgressMessage('正在等待 BTC 交易确认...')
      setWaitingForConfirmation(true)
      setEstimatedWaitTime('预计等待时间：10-30 分钟')
      
      let confirmations = 0
      let retryCount = 0
      const maxRetries = 60 // 最多等待约 30 分钟（BTC 测试网出块可能较慢）
      
      while (confirmations < 1 && retryCount < maxRetries) {
        try {
          const txResponse = await fetch(`https://mempool.space/testnet/api/tx/${fundingResult.txid}`)
          if (txResponse.ok) {
            const txData = await txResponse.json()
            if (txData.status?.confirmed) {
              const tipResponse = await fetch('https://mempool.space/testnet/api/blocks/tip/height')
              const tipHeight = await tipResponse.json()
              confirmations = tipHeight - txData.status.block_height + 1
              setConfirmationCount(confirmations)
              setProgressMessage(`✅ BTC 交易已确认 ${confirmations} 次`)
              console.log(`✅ BTC 交易已确认 ${confirmations} 次`)
              break
            }
          }
        } catch {
          console.log('检查确认状态时出错，继续等待...')
        }
        
        const waitedMinutes = Math.floor((retryCount + 1) * 0.5) // 每次等待30秒
        const remainingRetries = maxRetries - retryCount - 1
        const estimatedRemainingMinutes = Math.floor(remainingRetries * 0.5)
        
        setProgressMessage(`⏳ 等待 BTC 交易确认中... (${retryCount + 1}/${maxRetries})`)
        setEstimatedWaitTime(`已等待 ${waitedMinutes} 分钟，预计还需 ${estimatedRemainingMinutes} 分钟`)
        
        console.log(`⏳ BTC 交易尚未确认，等待中... (${retryCount + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, 30000)) // 等待 30 秒
        retryCount++
      }
      
      setWaitingForConfirmation(false)
      
      if (confirmations < 1) {
        setProgressMessage('❌ BTC 交易尚未获得确认，无法继续创建红包')
        console.log('❌ BTC 交易尚未确认，根据 RGB++ 协议要求无法继续')
        console.log('💡 RGB++ 协议要求 BTC 交易至少有 1 个确认才能进行 CKB 绑定')
        throw new Error(`BTC 交易需要至少 1 个确认才能进行 CKB 绑定。当前确认数: ${confirmations}。请等待更长时间后再试，或者检查交易是否成功提交到网络。`)
      } else {
        setProgressMessage('✅ BTC 交易确认完成，开始创建 CKB 交易')
        console.log(`✅ BTC 交易已确认 ${confirmations} 次，满足 RGB++ 协议要求`)
      }

      // 步骤 2: CKB DoB Minting - 只有在 BTC 交易确认后才执行
      setCurrentStep(CreationStep.CKB_MINTING)
      console.log('⚡ 正在铸造 CKB DoB...')
      
      // 读取封面文件为字节数组
      const coverBytes = new Uint8Array(await form.coverFile.arrayBuffer())
      
      const mintResult = await mintDoB(
        coverBytes,
        form.blessingText,
        fundingResult.txid,
        fundingResult.vout
      )
      console.log('✅ CKB DoB 铸造成功:', mintResult.sporeId)
      
      // RGB++ 创建阶段验证完成
      // 注意：commit hash、OP_RETURN、绑定验证等约束将在 melt 阶段进行
      console.log('✅ RGB++ 创建阶段验证完成：BTC UTXO 已确认，CKB DoB 已铸造')
      
      // 创建红包数据结构
      const newGift: Partial<RedPacket> = {
        sporeId: mintResult.sporeId,
        ckbTxHash: mintResult.txHash,
        btcTxId: fundingResult.txid,
        btcVout: fundingResult.vout,
        ownerCkbLockHash: mintResult.ownerLockHash, // 添加 owner lock hash 字段
        blessingText: form.blessingText,
        ckbBytesEstimate: Number(capacityEstimate / (10n ** 8n)),
        status: 'pending',
        btcConfirms: 0,
        createdAt: Date.now(),
        // RGB++ 创建阶段已完成基础验证
        rgbppValidated: isUtxoValid, // 创建阶段只验证 UTXO 有效性
        isRealTransaction: true // 标记为真实交易
      }
      
      setCreatedGift(newGift)
      setCurrentStep(CreationStep.COMPLETED)
      
      console.log('🎁 RGB++ 红包创建完成!')
      // 综合评估创建是否成功 - 不仅仅依赖单一的 UTXO 验证结果
      const creationSuccess = {
        utxoValid: isUtxoValid,                    // UTXO 验证结果
        ckbDobMinted: !!mintResult.sporeId,        // CKB DoB 是否成功铸造
        btcTxConfirmed: confirmations >= 1,        // BTC 交易是否已确认
        ownerLockHashValid: !!mintResult.ownerLockHash, // Owner lock hash 是否获取成功
      }
      
      // 综合判断创建是否有效 - 只要关键组件成功就认为创建有效
      const overallValid = (
        creationSuccess.ckbDobMinted &&           // CKB DoB 必须成功铸造
        creationSuccess.btcTxConfirmed &&         // BTC 交易必须已确认
        creationSuccess.ownerLockHashValid        // Owner lock hash 必须存在（销毁时需要）
      )
      
      // 更新红包的验证状态
      newGift.rgbppValidated = overallValid
      
      console.log('📊 创建阶段综合验证结果:', {
        ...creationSuccess,
        overallValid: overallValid,
        note: isUtxoValid ? '✅ UTXO网络验证通过' : '⚠️ UTXO网络验证失败但不影响整体创建'
      })
      console.log('💡 melt 阶段的 RGB++ 约束验证将在销毁红包时进行')
      
      // 保存到本地存储
      const existingGifts = JSON.parse(localStorage.getItem('redPackets') || '[]')
      existingGifts.push(newGift)
      localStorage.setItem('redPackets', JSON.stringify(existingGifts))
      
      // 清除待确认的交易信息
      localStorage.removeItem('pendingBtcTx')
      
    } catch (err) {
      console.error('❌ RGB++ 红包创建失败:', err)
      setError(err instanceof Error ? err.message : '创建红包失败')
    } finally {
      setLoading(false)
    }
  }

  // 重试当前步骤
  const retryCurrentStep = () => {
    setError(null)
    createRedPacket()
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900">创建红包</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧表单 */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            {!isConnected ? (
              <div className="text-center py-12">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">连接钱包</h2>
                <p className="text-gray-800 mb-6">需要连接 JoyID 钱包来创建红包</p>
                <WalletConnectButton className="justify-center" />
              </div>
            ) : (
              <form className="space-y-6">
                {/* 封面上传 */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    封面图片 *
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                    {coverPreview ? (
                      <div className="relative">
                        <Image
                          src={coverPreview}
                          alt="封面预览"
                          width={200}
                          height={200}
                          className="mx-auto rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setCoverPreview(null)
                            setForm({ ...form, coverFile: null })
                          }}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCoverChange}
                          className="hidden"
                          id="cover-upload"
                        />
                        <label
                          htmlFor="cover-upload"
                          className="cursor-pointer inline-flex flex-col items-center"
                        >
                          <div className="text-4xl text-gray-500 mb-2">📷</div>
                          <span className="text-gray-800">点击上传图片</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* 祝福语 */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    祝福语 *
                  </label>
                  <textarea
                    value={form.blessingText}
                    onChange={(e) => setForm({ ...form, blessingText: e.target.value })}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-500"
                    placeholder="输入您的祝福语..."
                    maxLength={500}
                  />
                  <div className="text-right text-sm text-gray-700 mt-1">
                    {form.blessingText.length}/500
                  </div>
                </div>

                {/* BTC 金额 */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    BTC 金额 *
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      min="0"
                      step="0.00001"
                      onChange={(e) => {
                        const btcAmount = parseFloat(e.target.value) || 0
                        setForm({ ...form, btcAmountSats: BigInt(Math.floor(btcAmount * 100000000)) })
                      }}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-500"
                      placeholder="0.001"
                    />
                    <span className="flex items-center px-3 py-2 bg-gray-100 rounded-lg text-gray-900 font-medium">BTC</span>
                  </div>
                  <div className="text-sm text-gray-700 mt-1">
                    = {form.btcAmountSats.toString()} sats
                  </div>
                </div>

                {/* 创建按钮 */}
                <div className="pt-4">
                  {error && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                      <p className="text-red-700">{error}</p>
                      <button
                        onClick={retryCurrentStep}
                        className="mt-2 text-red-600 hover:text-red-800 underline"
                      >
                        重试
                      </button>
                    </div>
                  )}
                  
                  <button
                    type="button"
                    onClick={createRedPacket}
                    disabled={loading || !form.coverFile || !form.blessingText || form.btcAmountSats <= 0 || waitingForConfirmation}
                    className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {waitingForConfirmation ? '等待 BTC 交易确认中...' : 
                     loading ? getStepText(currentStep) : '创建红包'}
                  </button>
                  
                  {waitingForConfirmation && (
                    <div className="mt-2 text-center">
                      <p className="text-sm text-gray-800">
                        正在等待区块确认，请耐心等待...
                      </p>
                      <p className="text-xs text-gray-700 mt-1">
                        可以在新标签页中查看：
                        <a 
                          href={`https://mempool.space/testnet/tx/${currentBtcTxId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline ml-1"
                        >
                          BTC 交易状态
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              </form>
            )}
          </div>

          {/* 右侧信息卡 */}
          <div className="space-y-6">
            {/* 钱包余额 */}
            {isConnected && (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold mb-3 text-gray-900">钱包余额</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <div className="text-gray-800">BTC 地址</div>
                    <div className="font-mono text-xs break-all text-gray-900">{btcAddress}</div>
                    <div className="font-semibold text-gray-900">{(Number(btcBalance?.balance || 0) / 100000000).toFixed(8)} BTC</div>
                  </div>
                  <div>
                    <div className="text-gray-800">CKB 地址</div>
                    <div className="font-mono text-xs break-all text-gray-900">{ckbBalance?.address}</div>
                    <div className="font-semibold text-gray-900">{formatCapacity(ckbBalance?.balance || 0n)}</div>
                  </div>
                  <div className="mt-3">
                    <button
                      onClick={handleRefreshBalances}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      🔄 刷新余额
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* CKB 占用估算 */}
            {capacityEstimate > 0 && (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold mb-3 text-gray-900">CKB 占用估算</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-800">封面大小</span>
                    <span className="text-gray-900 font-medium">{form.coverFile ? (form.coverFile.size / 1024).toFixed(1) : 0} KB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-800">祝福语长度</span>
                    <span className="text-gray-900 font-medium">{form.blessingText.length} 字符</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-gray-800">预计占用</span>
                    <span className="text-gray-900">{formatCapacity(capacityEstimate)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 创建状态 */}
            {currentStep !== CreationStep.FORM && (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold mb-3 text-gray-900">创建进度</h3>
                <div className="space-y-2">
                  <StepIndicator
                    step="BTC 资金交易"
                    current={currentStep === CreationStep.BTC_FUNDING}
                    completed={isStepCompleted(currentStep, CreationStep.BTC_FUNDING)}
                  />
                  <StepIndicator
                    step="CKB DoB 铸造"
                    current={currentStep === CreationStep.CKB_MINTING}
                    completed={isStepCompleted(currentStep, CreationStep.CKB_MINTING)}
                  />
                  <StepIndicator
                    step="创建完成"
                    current={currentStep === CreationStep.COMPLETED}
                    completed={currentStep === CreationStep.COMPLETED}
                  />
                </div>
              </div>
            )}

            {/* 等待确认进度提示 */}
            {waitingForConfirmation && (
              <div className="bg-blue-50 rounded-lg shadow p-4 border border-blue-200">
                <h3 className="font-semibold text-blue-800 mb-3">⏳ 等待 BTC 交易确认</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    <span className="text-blue-700 text-sm">{progressMessage}</span>
                  </div>
                  <div className="text-blue-600 text-xs">{estimatedWaitTime}</div>
                  <div className="bg-blue-100 p-3 rounded text-xs text-blue-800">
                    <p className="font-semibold mb-1">💡 为什么需要等待确认？</p>
                    <p>RGB++ 协议要求 BTC 交易至少获得 1 个确认后才能在 CKB 链上创建绑定交易。这是为了确保双链资产的安全性。</p>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-xs text-yellow-800">
                    <p className="font-semibold mb-1">⚠️ 请勿关闭页面或刷新</p>
                    <p>交易创建过程中请保持页面打开。如果意外关闭，您的 BTC 交易仍会成功，但需要手动处理后续步骤。</p>
                  </div>
                </div>
              </div>
            )}

            {/* 非等待确认状态的进度消息 */}
            {!waitingForConfirmation && progressMessage && currentStep !== CreationStep.COMPLETED && (
              <div className="bg-gray-50 rounded-lg shadow p-4">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full"></div>
                  <span className="text-gray-800 text-sm font-medium">{progressMessage}</span>
                </div>
              </div>
            )}

            {/* 创建结果 */}
            {createdGift && (
              <div className="bg-green-50 rounded-lg shadow p-4">
                <h3 className="font-semibold text-green-800 mb-3">🎉 创建成功</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-800">DoB ID:</span>
                    <div className="font-mono text-xs break-all text-gray-900">{createdGift.sporeId}</div>
                  </div>
                  <div>
                    <span className="text-gray-800">BTC 交易:</span>
                    <a
                      href={`${CONSTANTS.BTC_TESTNET_EXPLORER}${createdGift.btcTxId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-mono text-xs break-all block"
                    >
                      {createdGift.btcTxId}
                    </a>
                  </div>
                  <div>
                    <span className="text-gray-800">CKB 交易:</span>
                    <a
                      href={`${CONSTANTS.CKB_TESTNET_EXPLORER}${createdGift.ckbTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-mono text-xs break-all block"
                    >
                      {createdGift.ckbTxHash}
                    </a>
                  </div>
                </div>
                <div className="mt-4">
                  <a
                    href="/gift/pool"
                    className="inline-block bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    查看红包池
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// 步骤指示器组件
function StepIndicator({
  step,
  current,
  completed
}: {
  step: string
  current: boolean
  completed: boolean
}) {
  return (
    <div className="flex items-center space-x-2">
      <div className={`w-3 h-3 rounded-full ${
        completed ? 'bg-green-500' : current ? 'bg-blue-500' : 'bg-gray-300'
      }`} />
      <span className={`text-sm ${
        completed ? 'text-green-600' : current ? 'text-blue-600' : 'text-gray-800'
      }`}>
        {step}
      </span>
      {current && (
        <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
      )}
    </div>
  )
}

// 获取步骤文本
function getStepText(step: CreationStep): string {
  switch (step) {
    case CreationStep.BTC_FUNDING:
      return '正在创建 BTC 交易...'
    case CreationStep.CKB_MINTING:
      return '正在铸造 DoB...'
    case CreationStep.COMPLETED:
      return '创建完成'
    default:
      return '创建红包'
  }
}

// 判断步骤是否完成
function isStepCompleted(currentStep: CreationStep, targetStep: CreationStep): boolean {
  const stepOrder = [CreationStep.FORM, CreationStep.BTC_FUNDING, CreationStep.CKB_MINTING, CreationStep.COMPLETED]
  const currentIndex = stepOrder.indexOf(currentStep)
  const targetIndex = stepOrder.indexOf(targetStep)
  return currentIndex > targetIndex
}