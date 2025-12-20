Android 打包工具（macOS）
========================

项目概述
--------
本工具目标是在 macOS 上为 Android 项目提供一键化的打包与分发流水线，减少手工配置与命令行操作，帮助非专业开发者也能稳定产出 APK/AAB。

目标
----
- 提供简单的 CLI/GUI（后续决定）来完成打包、签名、渠道包输出。
- 封装常用环境检测（仅检查状态，不做自动安装），降低手工排查成本。
- 支持可重复、可配置的打包流程，方便 CI/CD 集成。

核心功能规划
-----------
- 环境检测：JDK、JAVA_HOME、Xcode Command Line Tools 状态检查，仅给出结果与必要提示，不做安装。
- 工程管理：支持在工作区内登记/扫描多个 Android 工程，打包时选择目标工程与模块。
- 项目配置：读取 `gradle`/`android` 工程，支持选择模块、Build Variant、签名配置、版本号/版本名自动递增。
- 签名管理：导入/创建 keystore，安全存储签名信息（仅本机），支持 v1/v2/v3 签名选项。
- 打包输出：一键生成 APK/AAB，支持多渠道（基于渠道文件或 walle/多包命名方案）。
- 日志与诊断：清晰的构建日志、错误提示与常见问题建议。
- 自动校验：构建完成后校验签名、包大小、versionCode/versionName。
- 可选分发：本地目录输出、自动上传到蒲公英（Pgyer）或 fir.im 平台。

技术选型（已确定）
----------------
- CLI：Node.js 18+，TypeScript。
- 包管理：pnpm。
- CLI 框架与工具：commander（命令定义）、kleur（终端着色）、child_process（调用 gradle）。
- GUI：Tauri（宿主）+ React + TypeScript + Ant Design（简约卡片式）。

环境要求（macOS）
-----------------
- macOS 13+（Apple Silicon/Intel 均可）
- JDK 17+（建议），Gradle（随项目 wrapper 优先）
- Xcode Command Line Tools（用于部分依赖与 git）
- Node.js 18+（用于 CLI）
- Rust（用于 GUI，Tauri 需要）

快速开始
--------
### 安装

1. **克隆项目**：
   ```bash
   git clone <repository-url>
   cd android-build-tool
   ```

2. **安装依赖**：
   ```bash
   # 安装 CLI 依赖
   pnpm install
   
   # 安装 GUI 依赖（可选）
   cd gui
   pnpm install
   ```

3. **环境准备**：
   - 确保已安装 JDK 17+ 和 Xcode Command Line Tools
   - 运行 `pnpm dev -- env` 检查环境状态

### 启动命令

#### CLI 启动

**开发模式（推荐）**：
```bash
# 在项目根目录执行
pnpm dev -- <命令>
```

**生产模式**：
```bash
# 1. 先编译 TypeScript
pnpm build

# 2. 运行编译后的代码
node dist/index.js <命令>
```

**全局安装（可选）**：
```bash
# 在项目根目录执行
pnpm link --global

# 之后可以在任何地方使用
abt <命令>
```

#### GUI 启动

**开发模式**：
```bash
# 进入 GUI 目录
cd gui

# 启动开发服务器（首次需要安装依赖）
pnpm install
pnpm tauri:dev
# 或
pnpm tauri dev
```

**生产模式（打包应用）**：
```bash
# 进入 GUI 目录
cd gui

# 构建应用（会自动构建前端代码）
pnpm tauri:build
# 或
pnpm tauri build

# 构建产物位置
# macOS: gui/src-tauri/target/release/bundle/
#   - .app 文件（可直接运行）
#   - .dmg 安装包（用于分发）
```

**快速启动示例**：
```bash
# CLI - 检查环境
pnpm dev -- env

# CLI - 列出工程
pnpm dev -- projects list

# GUI - 启动图形界面
cd gui && pnpm tauri:dev
```

### 使用

1. **准备项目**：将一个或多个 Android 工程置于工作区，确保有 `gradlew`。
2. **配置工程**：使用 CLI 或 GUI 添加工程配置。
3. **构建打包**：选择目标工程与模块/Build Variant，开始构建。
4. **查看产物**：在输出目录获取 APK/AAB，并可选择发布到蒲公英或 fir.im。

当前可用命令（CLI）
------------------
### 环境检测
- `pnpm dev -- env`：环境检测（检查 JDK、JAVA_HOME、Xcode CLT 状态）

### 工程管理
- `pnpm dev -- projects list`：列出已登记工程（默认配置文件 `config/projects.json`）
- `pnpm dev -- projects add --name demo --path /abs/path --module app --variant debug`：登记工程（需有 `gradlew`）
- `pnpm dev -- projects edit --name demo --path /new/path --module app --variant debug`：编辑已登记的工程（可更新路径、模块、变体等配置）
- `pnpm dev -- projects delete --name demo`：删除已登记的工程

### 构建打包
- `pnpm dev -- build --project demo --module app --variant debug`：调用该工程的 `./gradlew :app:assembleDebug`
- `pnpm dev -- build --project demo --publish pgyer --publish-api-key KEY`：构建并发布到蒲公英
- `pnpm dev -- build --project demo --publish fir --publish-api-token TOKEN`：构建并发布到 fir.im

### 单独发布
- `pnpm dev -- publish --file /path/to/app.apk --platform pgyer --api-key KEY`：单独发布 APK 文件

> 注意：使用 `pnpm build` 编译后，可用 `node dist/index.js` 替代 `pnpm dev --`，或全局链接为 `abt` 命令。

GUI（Tauri）使用
---------------
- 目录：`gui/`，栈：Tauri + React + TypeScript + Ant Design。
- **设计系统**：采用 "Minimalist Modern" 设计系统，具有以下特点：
  - **渐变主题**：Electric Blue 渐变（#0052FF → #4D7CFF）作为主要强调色
  - **双字体系统**：Calistoga（标题）+ Inter（UI/正文）+ JetBrains Mono（代码/标签）
  - **动画效果**：使用 Framer Motion 实现流畅的进入动画和微交互
  - **现代视觉**：渐变按钮、卡片阴影、浮动动画等现代设计元素
  - **响应式设计**：适配不同屏幕尺寸，保持视觉一致性

**重要：架构兼容性说明**
- `aarch64` 版本（文件名包含 `_aarch64`）：只能在 **Apple Silicon Mac**（M1/M2/M3 芯片）上运行
- `x86_64` 版本（文件名包含 `_x86_64`）：只能在 **Intel Mac** 上运行
- **两个版本不能互相通用**，如果要在 Intel Mac 上使用，必须构建 x86_64 版本

**环境要求**：
- Rust（用于 Tauri 后端）
- Tauri 依赖（首次运行 `pnpm tauri:dev` 会自动安装）
- Xcode Command Line Tools（用于编译）

- **多架构构建说明**：
  - **默认行为**：在 Apple Silicon（M1/M2/M3）Mac 上构建会生成 `aarch64` 版本，在 Intel Mac 上构建会生成 `x86_64` 版本
  - **架构兼容性**：
    - `aarch64` 版本：只能在 Apple Silicon Mac 上运行
    - `x86_64` 版本：只能在 Intel Mac 上运行
    - 两个版本不能互相通用，需要分别构建
  - **为不同架构构建**：
    - **在 Intel Mac 上构建 x86_64 版本**（推荐）：
      ```bash
      cd gui
      pnpm tauri:build  # 在 Intel Mac 上直接构建即可生成 x86_64 版本
      ```
    - **在 Apple Silicon Mac 上交叉编译 x86_64 版本**（需要安装 x86_64 工具链）：
      ```bash
      cd gui
      rustup target add x86_64-apple-darwin  # 安装 x86_64 目标平台
      pnpm tauri:build:x86_64  # 或使用 pnpm tauri build --target x86_64-apple-darwin
      ```
    - **在 Apple Silicon Mac 上构建 aarch64 版本**（默认）：
      ```bash
      cd gui
      pnpm tauri:build  # 默认构建 aarch64 版本
      # 或明确指定
      pnpm tauri:build:aarch64  # 或使用 pnpm tauri build --target aarch64-apple-darwin
      ```
    - **构建通用二进制文件（Universal Binary）**（同时包含两种架构）：
      ```bash
      cd gui
      # 注意：Tauri 2.x 目前不支持直接构建 Universal Binary
      # 建议：分别构建 aarch64 和 x86_64 版本，然后分别分发
      # 用户根据自己 Mac 的芯片类型选择对应的版本使用
      ```
- **功能**：环境检测、工程列表/添加/编辑/删除（写入 `config/projects.json`）、选择工程/模块/variant 进行构建并展示日志、自动发布到蒲公英/fir.im。

目录结构（当前/拟定）
------------------
- `src/index.ts`：CLI 入口与命令定义
- `src/core/`：环境检查、工程管理、Gradle 调用
- `config/`：`projects.json`（工程清单），`projects.example.json` 示例
- `templates/`：示例配置与渠道文件（待补充）
- `docs/`：使用说明、故障诊断（计划中）

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 项目结构

```
.
├── src/              # CLI 源代码
│   ├── core/         # 核心功能模块
│   └── index.ts      # CLI 入口
├── gui/              # GUI 应用（Tauri + React）
│   ├── src/          # React 前端代码
│   └── src-tauri/    # Rust 后端代码
├── config/           # 配置文件
│   └── projects.example.json  # 工程配置示例
└── README.md         # 项目说明文档
```
