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

### 构建打包
- `pnpm dev -- build --project demo --module app --variant debug`：调用该工程的 `./gradlew :app:assembleDebug`
- `pnpm dev -- build --project demo --publish pgyer --publish-api-key KEY`：构建并发布到蒲公英
- `pnpm dev -- build --project demo --publish fir --publish-api-token TOKEN`：构建并发布到 fir.im

### 单独发布
- `pnpm dev -- publish --file /path/to/app.apk --platform pgyer --api-key KEY`：单独发布 APK 文件

> 注意：使用 `pnpm build` 编译后，可用 `node dist/index.js` 替代 `pnpm dev --`，或全局链接为 `abt` 命令。

GUI（Tauri）使用
---------------
- 目录：`gui/`，栈：Tauri + React + TypeScript + AntD。
- **开发模式**：
  ```bash
  cd gui
  pnpm install          # 首次需要安装依赖
  pnpm tauri:dev        # 或使用 pnpm tauri dev
  ```
  需要环境：Rust、Tauri 依赖、Xcode Command Line Tools。
- **打包应用**：
  ```bash
  cd gui
  pnpm install          # 确保依赖已安装
  pnpm tauri:build      # 或使用 pnpm tauri build
  ```
  打包产物位置：
  - macOS: `gui/src-tauri/target/release/bundle/` 目录下
    - `.app` 文件（可直接运行）
    - `.dmg` 安装包（用于分发）
  - 首次打包会下载 Rust 工具链和依赖，可能需要较长时间
  - 打包前会自动执行 `pnpm build` 构建前端代码
- **功能**：环境检测、工程列表/添加（写入 `config/projects.json`）、选择工程/模块/variant 进行构建并展示日志、自动发布到蒲公英/fir.im。

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
