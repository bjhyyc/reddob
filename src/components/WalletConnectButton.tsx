'use client'

import { useWallet } from '@/contexts/WalletContext'

interface WalletConnectButtonProps {
  className?: string
}

export default function WalletConnectButton({ className = '' }: WalletConnectButtonProps) {
  const {
    isConnected,
    isConnecting,
    connectError,
    btcAddress,
    btcBalance,
    ckbBalance,
    btcAddressType,
    connectWallets,
    disconnect,
    refreshBalances
  } = useWallet()

  const formatAddress = (address: string) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatBalance = (balance: bigint) => {
    return (Number(balance) / 1e8).toFixed(4)
  }

  if (!isConnected) {
    return (
      <div className={`${className}`}>
        <button
          onClick={connectWallets}
          disabled={isConnecting}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isConnecting ? '连接中...' : '连接钱包'}
        </button>
        {connectError && (
          <p className="text-red-500 text-xs mt-1">{connectError}</p>
        )}
      </div>
    )
  }

  return (
    <div className={`${className}`}>
      <div className="relative group">
        <button className="bg-green-100 text-green-800 px-4 py-2 rounded-lg hover:bg-green-200 transition-colors flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span>已连接</span>
        </button>
        
        {/* 钱包信息下拉框 */}
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800">JoyID 钱包</h3>
              <button
                onClick={disconnect}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                断开连接
              </button>
            </div>
            
            {/* BTC 信息 */}
            <div className="mb-4 p-3 bg-orange-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-orange-800">BTC</span>
                <button
                  onClick={refreshBalances}
                  className="text-orange-600 hover:text-orange-800 text-xs"
                >
                  刷新
                </button>
              </div>
              <p className="text-xs text-gray-800 mb-1">
                {btcAddressType} - {formatAddress(btcAddress || '')}
              </p>
              <p className="font-mono text-sm">
                {btcBalance ? formatBalance(btcBalance.balance) : '0.0000'} BTC
              </p>
            </div>
            
            {/* CKB 信息 */}
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-green-800">CKB</span>
              </div>
              <p className="text-xs text-gray-800 mb-1">
                {formatAddress(ckbBalance?.address || '')}
              </p>
              <p className="font-mono text-sm">
                {ckbBalance ? formatBalance(ckbBalance.balance) : '0.0000'} CKB
              </p>
            </div>
            
            <div className="mt-3 text-xs text-gray-700">
              💡 钱包连接状态在所有页面间保持同步
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}