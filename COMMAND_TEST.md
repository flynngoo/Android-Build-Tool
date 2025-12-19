# 命令行测试指南

本文档说明如何使用命令行测试 Android 构建工具。

## 前置准备

1. **安装依赖**：
```bash
pnpm install
```

2. **环境要求**：
   - JDK 17+
   - Xcode Command Line Tools
   - Node.js 18+
   - 准备一个 Android 项目（包含 `gradlew` 或 `gradlew.bat` 文件）

3. **检查环境**：
```bash
pnpm dev -- env
```
这会检查 JDK、JAVA_HOME 和 Xcode CLT 的状态。

## 使用方式

### 方式一：直接运行源码（推荐用于测试）

```bash
# 环境检测
pnpm dev -- env

# 列出已登记的工程
pnpm dev -- projects list

# 添加一个工程
pnpm dev -- projects add --name <工程名> --path <工程路径> [--module <模块名>] [--variant <构建变体>] [--build-type <Debug|Release>]

# 构建工程
pnpm dev -- build --project <工程名> [--module <模块名>] [--variant <构建变体>] [--build-type <Debug|Release>] [--output-dir <输出目录>]

# 构建并发布到平台
pnpm dev -- build --project <工程名> --publish <pgyer|fir> [--publish-api-key <KEY>] [--publish-api-token <TOKEN>] [--publish-description <描述>]

# 单独发布 APK
pnpm dev -- publish --file <APK路径> --platform <pgyer|fir> [--api-key <KEY>] [--api-token <TOKEN>]
```

### 方式二：先编译再运行

```bash
# 编译 TypeScript 代码
pnpm build

# 运行编译后的代码
node dist/index.js env
node dist/index.js projects list
node dist/index.js projects add --name <工程名> --path <工程路径>
node dist/index.js build --project <工程名>
```

## 完整测试示例

假设你有一个 Android 项目位于 `/Users/yourname/MyAndroidProject`：

```bash
# 1. 检查环境
pnpm dev -- env

# 2. 添加工程（假设项目名称为 my-app，模块名为 app，使用 Ver-Dev 构建变体，Debug 类型）
pnpm dev -- projects add \
  --name my-app \
  --path /Users/yourname/MyAndroidProject \
  --module app \
  --variant Ver-Dev \
  --build-type Debug

# 3. 查看已添加的工程
pnpm dev -- projects list

# 4. 构建工程（使用默认配置）
pnpm dev -- build --project my-app

# 或者指定不同的模块、构建变体和 Build Type
pnpm dev -- build --project my-app --module app --variant Ver-Dev --build-type Release

# 5. 构建并指定输出目录
pnpm dev -- build --project my-app --module app --variant Ver-Dev --build-type Debug \
  --output-dir /Users/yourname/MyAndroidProject/output

# 6. 构建并发布到蒲公英（Pgyer）
pnpm dev -- build --project my-app --module app --variant Ver-Dev --build-type Debug \
  --publish pgyer \
  --publish-api-key YOUR_PGYER_API_KEY \
  --publish-description "版本更新说明" \
  --publish-password "安装密码（可选）"

# 7. 构建并发布到 fir.im
pnpm dev -- build --project my-app --module app --variant Ver-Dev --build-type Debug \
  --publish fir \
  --publish-api-token YOUR_FIR_API_TOKEN \
  --publish-description "版本更新说明"

# 8. 单独发布已构建的 APK 到蒲公英
pnpm dev -- publish \
  --file /Users/yourname/MyAndroidProject/app/build/outputs/apk/debug/app-debug.apk \
  --platform pgyer \
  --api-key YOUR_PGYER_API_KEY \
  --publish-description "版本更新说明"

# 9. 删除工程
pnpm dev -- projects delete --name my-app

# 或者使用简写命令
pnpm dev -- projects rm --name my-app
```

## 命令参数说明

### `env` 命令
环境检测命令，检查以下项目：
- **Java (JDK)**: 检查 JDK 是否安装
- **JAVA_HOME**: 检查 JAVA_HOME 环境变量
- **Xcode CLT**: 检查 Xcode Command Line Tools

### `projects list` 命令
列出所有已登记的工程，显示工程名称、路径、默认模块、默认变体和 Build Type。

### `projects add` 参数
- `--name <name>` (必需): 工程名称，用于后续引用
- `--path <path>` (必需): 工程的绝对路径，必须包含 `gradlew` 文件
- `--module <module>` (可选): 默认模块名，例如 `app`
- `--variant <variant>` (可选): 默认构建变体，例如 `Ver-Dev`（注意：会与 buildType 拼接）
- `--build-type <type>` (可选): Build Type，`Debug` 或 `Release`，默认为 `Debug`

**注意：** 最终的构建任务为 `assemble{variant}{buildType}`，例如 `assembleVer-DevDebug`

### `projects delete` 参数
- `--name <name>` (必需): 要删除的工程名称

**注意：** 删除操作不可恢复，请谨慎操作。

### `build` 参数
- `--project <name>` (必需): 要构建的工程名称（需先通过 `projects add` 添加）
- `--module <module>` (可选): 模块名，不指定则使用工程配置的默认模块
- `--variant <variant>` (可选): 构建变体，不指定则使用工程配置的默认变体
- `--build-type <type>` (可选): Build Type (`Debug` 或 `Release`)，不指定则使用工程配置的默认值或 `Debug`
- `--output-dir <dir>` (可选): 输出目录（Destination Folder），构建成功后会复制 APK/AAB 到此目录
- `--args <args...>` (可选): 传递给 gradle 的额外参数

### 发布相关参数（`build` 命令）
- `--publish <platform>` (可选): 发布平台，`pgyer` 或 `fir`
- `--publish-api-key <key>` (可选): 蒲公英 API Key（当 `--publish pgyer` 时必需）
- `--publish-api-token <token>` (可选): fir.im API Token（当 `--publish fir` 时必需）
- `--publish-password <password>` (可选): 安装密码（仅蒲公英支持）
- `--publish-description <desc>` (可选): 更新描述

### `publish` 命令参数
- `--file <path>` (必需): APK/AAB 文件路径
- `--platform <platform>` (必需): 发布平台，`pgyer` 或 `fir`
- `--api-key <key>` (可选): 蒲公英 API Key（当 `--platform pgyer` 时必需）
- `--api-token <token>` (可选): fir.im API Token（当 `--platform fir` 时必需）
- `--password <password>` (可选): 安装密码（仅蒲公英支持）
- `--description <desc>` (可选): 更新描述

## 注意事项

1. **工程路径必须是绝对路径**，且必须包含 `gradlew`（macOS/Linux）或 `gradlew.bat`（Windows）文件
2. 工程配置保存在 `config/projects.json` 文件中（此文件不会被提交到 Git）
3. 构建过程中会调用 `./gradlew :模块名:assemble{variant}{buildType}` 命令
   - 例如：`assembleVer-DevDebug`（variant: `Ver-Dev`, buildType: `Debug`）
4. 如果构建失败，退出码会反映 Gradle 的退出状态
5. **发布功能**：
   - 蒲公英（Pgyer）：需要 API Key，可选设置安装密码
   - fir.im：需要 API Token，使用 `go-fir-cli` 工具进行上传
   - 发布成功后会在控制台显示下载链接和二维码
6. **输出目录**：如果指定了 `--output-dir`，构建成功后会自动将 APK/AAB 复制到指定目录

## 常见问题

**Q: 提示"未找到工程"？**
A: 确保已经使用 `projects add` 添加了工程，可以使用 `projects list` 查看已添加的工程。

**Q: 构建失败怎么办？**
A: 检查：
- 工程路径是否正确
- 是否包含 `gradlew` 文件
- 模块名、构建变体和 Build Type 是否匹配项目配置
- 查看错误输出信息

**Q: 如何更新工程配置？**
A: 可以直接编辑 `config/projects.json` 文件，或删除后重新添加。

**Q: 发布到平台失败？**
A: 检查：
- API Key/Token 是否正确
- 网络连接是否正常
- 查看错误输出信息
- 对于 fir.im，确保已安装 `go-fir-cli` 工具并可在全局使用

**Q: Build Type 和 Variant 的区别？**
A: 
- **Variant**: 构建变体，例如 `Ver-Dev`、`Ver-Prod` 等，由项目配置决定
- **Build Type**: 构建类型，通常是 `Debug` 或 `Release`
- 最终构建任务为 `assemble{variant}{buildType}`，例如 `assembleVer-DevDebug`

**Q: 如何获取蒲公英 API Key？**
A: 登录 [蒲公英官网](https://www.pgyer.com/)，进入"账号设置" -> "API信息" 获取。

**Q: 如何获取 fir.im API Token？**
A: 登录 [fir.im 官网](https://fir.im/)，进入"账号设置" -> "API Token" 获取。
