# 🐎 Equinox Racing - 新一代区块链赛马游戏

> **项目愿景**: 我们要创造的不是另一个赛马博彩模拟器，而是一个有生命、有策略、由玩家驱动的赛马元宇宙。玩家与他们的马匹 NFT 之间将建立深度的情感连接，每一匹马都是独一无二、有故事的伙伴。

## 🌟 核心特色

### 三大核心支柱

1. **🌱 有生命的 NFT (Living NFTs)**
   - 马匹不再是静态的数据，而是拥有"风土"灵魂、动态性格与情绪的生命体
   - 每匹马都有独特的出生地、性格特征和成长历程

2. **🧠 深度策略玩法 (Deep Strategy)**
   - 比赛的胜负由基因、环境、训练、策略和一点点运气共同决定
   - 打破纯数值碾压，注重策略配置和临场发挥

3. **🏛️ 玩家驱动经济 (Player-Driven Economy)**
   - 将世界的创造权和治理权下放给玩家
   - 构建一个充满活力的 SocialFi 生态系统

## 🎮 游戏系统概览

### 核心系统设计：有生命的马匹 NFT

**核心属性 (The DNA)**
- **HorseID**: 唯一的 NFT 标识
- **Genotype**: 基因序列，影响基础速度、耐力、爆发力等潜力上限
- **Bloodline**: 远古血统 (Zan, Sar, Nak)，提供基础加成和外观特征
- **Gender**: 用于繁殖系统

**"风土"系统 (The Soul)** - 🚧 计划实现
- **OriginRegion**: 马匹被捕捉时的地理区域
- 不同地区赋予马匹不同的能力加成和赛道偏好
- 高山、平原、森林、沙漠、火山等多样化风土

**动态状态 (The Mood)** - 🚧 计划实现
- **Personality**: 勇敢、胆怯、懒惰、好胜等永久性格
- **Emotion**: 兴奋、冷静、焦虑、疲惫等动态情绪
- **Stamina**: 当前体力值，影响比赛表现

### 核心玩法循环

1. **🗺️ 探索与捕捉** - 🚧 计划实现
   - 在巨大的地图上探索不同的风土区域
   - 捕捉野生马匹并铸造为 NFT

2. **💪 策略性训练** - 🚧 计划实现
   - 技能点分配系统
   - 赛道记忆和熟练度系统
   - 解锁被动技能

3. **🏁 比赛机制**
   - 多因素决定胜负：硬实力、风土匹配、动态状态、赛道记忆、玩家策略、随机因素
   - 实时比赛进程和策略决策

4. **🎯 装备与消耗品** - 🚧 计划实现
   - 装备 NFT：蹄铁、马鞍、眼罩等
   - 消耗品：食物、策略卡等

### 玩家驱动的经济与 SocialFi

- **🏛️ 俱乐部 (DAO)** - 🚧 计划实现
- **🏞️ 土地与赛道 NFT** - 🚧 计划实现
- **👨‍💼 职业路径** - 🚧 计划实现
  - 育马师 (Breeder)
  - 训练师 (Trainer) 
  - 分析师 (Analyst)

## 🛠️ 技术栈

- **区块链**: Aptos (Move语言)
- **前端**: Next.js + TypeScript + Tailwind CSS
- **钱包集成**: Aptos Wallet Adapter
- **开发环境**: Node.js + Aptos CLI

## 🚀 快速开始

### 环境要求

- Node.js 18+
- Aptos CLI
- 支持的钱包 (Petra, Martian, etc.)

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/your-org/equinox-racing.git
cd equinox-racing
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
cp .env.local.example .env.local
# 编辑 .env.local 设置必要的环境变量
```

4. **编译和部署合约**
```bash
cd contracts
aptos move compile
aptos move publish --named-addresses equinox_addr=YOUR_ADDRESS
```

5. **启动开发服务器**
```bash
npm run dev
```

6. **访问应用**
   打开 [http://localhost:3000](http://localhost:3000)

### 使用指南

1. **连接钱包** - 点击右上角连接支持的 Aptos 钱包
2. **管理马匹** - 在"马匹管理"标签页铸造和查看你的 NFT 马匹
3. **参加比赛** - 在"赛马"标签页创建或加入比赛
4. **选择模式** - 支持经典模式（预设马匹）和 NFT 模式（自有马匹）

## 📁 项目结构

```
equinox-racing/
├── contracts/                 # Move 智能合约
│   ├── sources/
│   │   └── equinox.move      # 主合约文件
│   └── Move.toml             # 合约配置
├── components/               # React 组件
│   ├── HorseStable.tsx       # 马匹管理组件
│   ├── NFTHorseSelection.tsx # NFT马匹选择组件
│   ├── RaceTrack.tsx         # 赛道组件
│   └── ...
├── hooks/                    # 自定义 Hooks
│   ├── useRace.ts           # 比赛状态管理
│   └── usePlayerHorses.ts   # 玩家马匹管理
├── lib/                     # 工具库
│   └── equinox.ts           # 区块链交互接口
└── pages/                   # Next.js 页面
    └── index.tsx            # 主页面
```

## 🧪 测试

```bash
# 运行测试
npm test

# 编译检查
npm run build

# 合约测试
cd contracts && aptos move test
```

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 📋 开发路线图

- [x] **Phase 1**: 基础赛马系统 + NFT 拥有权
- [ ] **Phase 2**: 风土系统实现
- [ ] **Phase 3**: 繁殖和训练系统
- [ ] **Phase 4**: 装备和消耗品系统
- [ ] **Phase 5**: 土地和俱乐部系统
- [ ] **Phase 6**: 完整的 SocialFi 生态

详细的当前实现状态请查看 [Phase1-test-version.md](./Phase1-test-version.md)

## 📜 许可证

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌐 链接

- [官方网站](#) - 🚧 建设中
- [技术文档](#) - 🚧 建设中
- [Discord 社区](#) - 🚧 建设中
- [Twitter](#) - 🚧 建设中

## ⚠️ 免责声明

本项目目前处于开发阶段，仅供学习和测试用途。请勿在主网上使用未经充分测试的代码，也不要投入超过您能承受损失的资金。

---

**Built with ❤️ for the future of blockchain gaming**
EOF < /dev/null
