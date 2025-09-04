import Link from "next/link";
import WalletConnectButton from "@/components/WalletConnectButton";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white">
      {/* 导航栏 */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🎁</span>
              <h1 className="text-xl font-bold text-gray-900">RedDoB</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/gift/new"
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                创建红包
              </Link>
              <Link
                href="/gift/pool"
                className="border border-red-600 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
              >
                红包池
              </Link>
              <Link
                href="/debug"
                className="border border-gray-400 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                调试
              </Link>
              <Link
                href="/test-real-tx"
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                🚀 真实交易测试
              </Link>
              <WalletConnectButton />
            </div>
          </div>
        </div>
      </nav>

      {/* 主要内容 */}
      <main className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center">
          <div className="text-6xl mb-6">🎁</div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            BTC 红包 dApp
          </h1>
          <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
            基于 RGB++ 强约束的 DoB (Digital Object on Bitcoin) 红包系统，
            实现 BTC 和 CKB 双链互操作
          </p>

          <div className="flex justify-center space-x-4 mb-16">
            <Link
              href="/gift/new"
              className="bg-red-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-red-700 transition-colors"
            >
              立即创建红包
            </Link>
            <Link
              href="/gift/pool"
              className="border-2 border-red-600 text-red-600 px-8 py-3 rounded-lg text-lg font-medium hover:bg-red-50 transition-colors"
            >
              查看红包池
            </Link>
          </div>

          {/* 特性介绍 */}
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm p-6 border">
              <div className="text-3xl mb-4">⚡</div>
              <h3 className="text-lg font-semibold mb-2">双链互操作</h3>
              <p className="text-gray-800 text-sm">
                基于 RGB++ 协议，实现 Bitcoin 和 CKB 的强约束绑定，
                确保资产的安全性和一致性
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 border">
              <div className="text-3xl mb-4">🔐</div>
              <h3 className="text-lg font-semibold mb-2">JoyID 钱包</h3>
              <p className="text-gray-800 text-sm">
                集成 JoyID 多链钱包，支持 BTC 和 CKB 资产管理，
                提供便捷的用户体验
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 border">
              <div className="text-3xl mb-4">🎨</div>
              <h3 className="text-lg font-semibold mb-2">DoB 载体</h3>
              <p className="text-gray-800 text-sm">
                每个红包都是独特的数字对象，包含封面图片和祝福语，
                存储在 CKB 链上永久保存
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* 底部 */}
      <footer className="bg-gray-50 border-t">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center text-gray-700">
            <p className="mb-2 text-gray-700">RedDoB - BTC 红包 dApp</p>
            <p className="text-sm text-gray-700">
              基于 RGB++ 协议 · 支持 JoyID 钱包 · Testnet 环境
            </p>
            <div className="mt-4 flex justify-center space-x-4 text-sm">
              <a
                href="https://mempool.space/testnet"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                BTC 浏览器
              </a>
              <span className="text-gray-600">|</span>
              <a
                href="https://testnet.explorer.nervos.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                CKB 浏览器
              </a>
              <span className="text-gray-600">|</span>
              <a
                href="https://joy.id"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                JoyID 钱包
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
