'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { connectBtcWallet, getBtcBalance, getCurrentBtcAddressInfo } from '@/lib/joyid/bitcoin'
import { connectCkbWallet, getCkbBalance } from '@/lib/joyid/ckb'
import { WalletBalance } from '@/types'

interface WalletContextType {
  // 连接状态
  isConnected: boolean
  isConnecting: boolean
  connectError: string | null
  
  // BTC 钱包状态
  btcAddress: string | null
  btcBalance: WalletBalance | null
  btcAddressType: string | null
  
  // CKB 钱包状态
  ckbAddress: string | null
  ckbBalance: WalletBalance | null
  
  // 方法
  connectWallets: () => Promise<void>
  refreshBalances: () => Promise<void>
  disconnect: () => void
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

interface WalletProviderProps {
  children: ReactNode
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  
  const [btcAddress, setBtcAddress] = useState<string | null>(null)
  const [btcBalance, setBtcBalance] = useState<WalletBalance | null>(null)
  const [btcAddressType, setBtcAddressType] = useState<string | null>(null)
  
  const [ckbAddress, setCkbAddress] = useState<string | null>(null)
  const [ckbBalance, setCkbBalance] = useState<WalletBalance | null>(null)

  // 检查是否已有连接
  const checkExistingConnection = async () => {
    try {
      console.log('🔍 检查现有 JoyID 连接状态...')
      
      // 检查 BTC 连接
      const btcInfo = await getCurrentBtcAddressInfo()
      if (btcInfo.isConnected) {
        setBtcAddress(btcInfo.address)
        setBtcAddressType(btcInfo.addressType)
        console.log('✅ 发现已连接的 BTC 钱包:', btcInfo.address)
        
        // 获取余额
        try {
          const balance = await getBtcBalance()
          setBtcBalance(balance)
        } catch (e) {
          console.warn('BTC 余额获取失败，使用默认值')
          setBtcBalance({ address: btcInfo.address, balance: 0n })
        }
        
        // 尝试连接 CKB（通常与 BTC 一起连接）
        try {
          const ckbConnection = await connectCkbWallet()
          setCkbAddress(ckbConnection.address)
          
          const ckbBal = await getCkbBalance()
          setCkbBalance(ckbBal)
          
          setIsConnected(true)
          console.log('✅ JoyID 钱包自动重连成功')
        } catch (e) {
          console.warn('CKB 钱包连接失败，仅 BTC 可用')
        }
      }
    } catch (error) {
      console.log('📝 未检测到现有连接，需要手动连接')
    }
  }

  // 连接钱包
  const connectWallets = async () => {
    if (isConnecting || isConnected) return
    
    try {
      setIsConnecting(true)
      setConnectError(null)
      
      console.log('🔗 连接 JoyID 钱包...')
      
      // 连接 BTC 钱包
      const btcConnection = await connectBtcWallet()
      setBtcAddress(btcConnection.address)
      
      // 获取 BTC 地址类型
      const btcInfo = await getCurrentBtcAddressInfo()
      setBtcAddressType(btcInfo.addressType)
      
      // 连接 CKB 钱包
      const ckbConnection = await connectCkbWallet()
      setCkbAddress(ckbConnection.address)
      
      // 获取余额
      await refreshBalances()
      
      setIsConnected(true)
      console.log('✅ JoyID 钱包连接成功')
      
      // 保存连接状态到 localStorage
      localStorage.setItem('joyid_connected', 'true')
      
    } catch (error) {
      console.error('JoyID 钱包连接失败:', error)
      const errorMessage = error instanceof Error ? error.message : '连接失败'
      setConnectError(errorMessage)
    } finally {
      setIsConnecting(false)
    }
  }

  // 刷新余额
  const refreshBalances = async () => {
    if (!btcAddress || !ckbAddress) return
    
    try {
      const [btcBal, ckbBal] = await Promise.all([
        getBtcBalance().catch(err => {
          console.error('BTC 余额获取失败:', err)
          return { address: btcAddress, balance: 0n }
        }),
        getCkbBalance().catch(err => {
          console.error('CKB 余额获取失败:', err)
          return { address: ckbAddress, balance: 0n }
        })
      ])
      
      setBtcBalance(btcBal)
      setCkbBalance(ckbBal)
    } catch (error) {
      console.error('余额刷新失败:', error)
    }
  }

  // 断开连接
  const disconnect = () => {
    setIsConnected(false)
    setBtcAddress(null)
    setBtcBalance(null)
    setBtcAddressType(null)
    setCkbAddress(null)
    setCkbBalance(null)
    setConnectError(null)
    
    // 清除本地存储
    localStorage.removeItem('joyid_connected')
    
    console.log('🔌 JoyID 钱包已断开连接')
  }

  // 页面加载时检查现有连接
  useEffect(() => {
    const wasConnected = localStorage.getItem('joyid_connected') === 'true'
    if (wasConnected) {
      checkExistingConnection()
    }
  }, [])

  const value: WalletContextType = {
    isConnected,
    isConnecting,
    connectError,
    btcAddress,
    btcBalance,
    btcAddressType,
    ckbAddress,
    ckbBalance,
    connectWallets,
    refreshBalances,
    disconnect
  }

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}