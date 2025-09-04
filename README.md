# RedDoB - BTC 红包 dApp

基于 RGB++ 强约束的 DoB (Digital Object on Bitcoin) 红包系统，实现 BTC 和 CKB 双链互操作。

## 功能特性

- 🎁 **创建红包**: 从零创建新的 DoB 红包，包含封面图片和祝福语
- ⚡ **双链互操作**: 基于 RGB++ 协议，实现 Bitcoin 和 CKB 的强约束绑定
- 🔐 **JoyID 钱包**: 集成 JoyID 多链钱包，支持 BTC 和 CKB 资产管理
- 🎨 **DoB 载体**: 每个红包都是独特的数字对象，存储在 CKB 链上
- 🔒 **RGB++ 强约束**: 销毁红包时需要 SPV 证明验证

## 技术架构

- **前端**: Next.js 15 + TypeScript + Tailwind CSS
- **钱包**: JoyID (@joyid/bitcoin + @joyid/ckb)
- **CKB 交互**: @ckb-ccc/ccc
- **协议**: RGB++ 强约束 + SPV 验证

## 页面结构

- `/` - 主页和导航
- `/gift/new` - 创建红包（唯一入口）
- `/gift/pool` - 红包池管理
- `/api/spv/proof` - SPV 证明代理

## 开发环境

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 构建生产版本

```bash
npm run build
```

## P0 阶段功能 ✅

- [x] 创建红包完整流程
- [x] JoyID BTC 和 CKB 钱包连接
- [x] 双链交易签名和广播
- [x] 红包池展示和状态管理
- [x] 区块链浏览器链接
- [x] SPV 证明 API 接口

## P1 阶段 (待实现)

- [ ] RGB++ Melt 强约束验证
- [ ] SPV 证明严格校验
- [ ] 错误处理和重试机制优化
- [ ] 确认数监控和状态更新

## P2 阶段 (待实现)

- [ ] 链上合约校验
- [ ] RGB++-Guard Lock 集成
- [ ] 完整的 SPV 验证

## 重要常量

```typescript
OPRETURN_TAG: '0x5247422B2B01'
CONFS_MIN: 2
NET_BYTE: 0x00 (testnet)
```

## 区块链浏览器

- **BTC Testnet**: https://mempool.space/testnet
- **CKB Testnet**: https://testnet.explorer.nervos.org
- **JoyID 钱包**: https://joy.id

## 注意事项

1. 当前运行在测试网环境
2. 禁止选择已有 DoB，只能从零创建
3. 创建流程需要两次签名：BTC → CKB
4. 销毁需要 SPV 证明验证
5. 所有操作都有完整的错误处理和重试逻辑
