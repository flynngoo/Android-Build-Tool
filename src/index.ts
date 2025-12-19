#!/usr/bin/env node
import { Command } from "commander";
import kleur from "kleur";
import { checkEnv } from "./core/env";
import { addProject, deleteProject, findProject, listProjects } from "./core/projects";
import { runGradleBuild } from "./core/gradle";
import { publishApk, type PublishConfig } from "./core/publish";
import path from "path";
import fs from "fs";

const program = new Command();

program.name("abt").description("Android 打包工具 CLI (Node.js + TypeScript)").version("0.1.0");

program
  .command("env")
  .description("环境检测（只检查状态，不做安装）")
  .action(() => {
    const results = checkEnv();
    results.forEach((item) => {
      const label = item.ok ? kleur.green("OK") : kleur.red("FAIL");
      const detail = item.detail ? ` | ${item.detail}` : "";
      console.log(`${label} ${item.tool}: ${item.message}${detail}`);
    });
  });

const projects = program.command("projects").description("工程管理");

projects
  .command("list")
  .description("列出已登记的工程")
  .action(() => {
    const all = listProjects();
    if (!all.length) {
      console.log("尚未登记工程，可使用 abt projects add 添加。");
      return;
    }
    all.forEach((p) => {
      console.log(
        `- ${p.name}: ${p.path} (module=${p.defaultModule ?? "-"}, variant=${p.defaultVariant ?? "-"}, buildType=${p.buildType ?? "-"})`,
      );
    });
  });

projects
  .command("add")
  .description("登记一个工程，需包含 gradlew")
  .requiredOption("--name <name>", "工程名")
  .requiredOption("--path <path>", "工程绝对路径")
  .option("--module <module>", "默认模块，例如 app")
  .option("--variant <variant>", "默认 Build Variant，例如 Ver-Dev")
  .option("--build-type <type>", "Build Type (Debug 或 Release)", "Debug")
  .action((opts) => {
    try {
      addProject({
        name: opts.name,
        path: opts.path,
        defaultModule: opts.module,
        defaultVariant: opts.variant,
        buildType: opts.buildType as "Debug" | "Release",
      });
      console.log(kleur.green(`已添加工程：${opts.name}`));
    } catch (err) {
      console.error(kleur.red((err as Error).message));
      process.exitCode = 1;
    }
  });

projects
  .command("delete")
  .alias("remove")
  .alias("rm")
  .description("删除已登记的工程")
  .requiredOption("--name <name>", "工程名")
  .action((opts) => {
    try {
      deleteProject(opts.name);
      console.log(kleur.green(`已删除工程：${opts.name}`));
    } catch (err) {
      console.error(kleur.red((err as Error).message));
      process.exitCode = 1;
    }
  });

program
  .command("build")
  .description("对指定工程执行 Gradle assemble")
  .requiredOption("--project <name>", "工程名（需先登记）")
  .option("--module <module>", "模块名，例如 app")
  .option("--variant <variant>", "Build Variant，例如 Ver-Dev")
  .option("--build-type <type>", "Build Type (Debug 或 Release)")
  .option("--output-dir <dir>", "输出目录（Destination Folder），默认为 工程路径/模块名称/variant")
  .option("--args <args...>", "传递给 gradle 的额外参数")
  .option("--publish <platform>", "构建成功后发布到指定平台 (pgyer 或 fir)")
  .option("--publish-api-key <key>", "发布平台 API Key (pgyer 使用)")
  .option("--publish-api-token <token>", "发布平台 API Token (fir 使用)")
  .option("--publish-password <password>", "发布密码 (pgyer 可选)")
  .option("--publish-description <desc>", "发布更新描述")
  .action(async (opts) => {
    const project = findProject(opts.project);
    if (!project) {
      console.error(kleur.red(`未找到工程：${opts.project}`));
      process.exitCode = 1;
      return;
    }
    const variant = opts.variant ?? (project.variants && project.variants.length > 0 ? project.variants[0] : project.defaultVariant);
    const buildType = opts.buildType ?? project.buildType ?? "Debug";
    const module = opts.module ?? (project.modules && project.modules.length > 0 ? project.modules[0] : project.defaultModule);
    // 计算默认输出目录：path+module+variant/buildType
    let defaultOutputDir = project.path;
    if (module) {
      defaultOutputDir = `${defaultOutputDir}/${module}`;
    }
    if (variant) {
      defaultOutputDir = `${defaultOutputDir}/${variant}/${buildType}`;
    } else {
      defaultOutputDir = `${defaultOutputDir}/${buildType}`;
    }
    const outputDir = opts.outputDir || defaultOutputDir;
    console.log(`开始构建：${project.name} | module=${module ?? "-"} | variant=${variant ?? "-"} | buildType=${buildType} | outputDir=${outputDir}`);
    try {
      const code = await runGradleBuild(project, { 
        variant, 
        buildType, 
        module, 
        outputDir: opts.outputDir,
        extraArgs: opts.args ?? [] 
      });
      if (code === 0) {
        console.log(kleur.green("构建成功"));
        
        // 如果指定了发布平台，构建成功后自动发布
        if (opts.publish) {
          const platform = opts.publish as "pgyer" | "fir";
          if (platform !== "pgyer" && platform !== "fir") {
            console.error(kleur.red(`不支持的发布平台: ${platform}，仅支持 pgyer 或 fir`));
            return;
          }
          
          // 查找输出目录中的 APK/AAB 文件
          const apkFiles: string[] = [];
          if (fs.existsSync(outputDir)) {
            const files = fs.readdirSync(outputDir);
            for (const file of files) {
              if (file.endsWith(".apk") || file.endsWith(".aab")) {
                apkFiles.push(path.join(outputDir, file));
              }
            }
          }
          
          if (apkFiles.length === 0) {
            console.error(kleur.red(`未找到 APK/AAB 文件，无法发布`));
            return;
          }
          
          // 发布第一个找到的文件（通常只有一个）
          const publishConfig: PublishConfig = {
            platform,
            apiKey: opts.publishApiKey,
            apiToken: opts.publishApiToken,
            password: opts.publishPassword,
            updateDescription: opts.publishDescription,
          };
          
          const result = await publishApk(apkFiles[0], publishConfig);
          if (!result.success) {
            process.exitCode = 1;
          }
        }
      } else {
        console.error(kleur.red(`构建失败，退出码 ${code}`));
        process.exitCode = code;
      }
    } catch (err) {
      console.error(kleur.red(`构建出错：${(err as Error).message}`));
      process.exitCode = 1;
    }
  });

// 添加独立的发布命令
program
  .command("publish")
  .description("发布 APK/AAB 文件到指定平台")
  .requiredOption("--file <path>", "APK/AAB 文件路径")
  .requiredOption("--platform <platform>", "发布平台 (pgyer 或 fir)")
  .option("--api-key <key>", "API Key (pgyer 使用)")
  .option("--api-token <token>", "API Token (fir 使用)")
  .option("--password <password>", "发布密码 (pgyer 可选)")
  .option("--description <desc>", "更新描述")
  .action(async (opts) => {
    const platform = opts.platform as "pgyer" | "fir";
    if (platform !== "pgyer" && platform !== "fir") {
      console.error(kleur.red(`不支持的发布平台: ${platform}，仅支持 pgyer 或 fir`));
      process.exitCode = 1;
      return;
    }
    
    const publishConfig: PublishConfig = {
      platform,
      apiKey: opts.apiKey,
      apiToken: opts.apiToken,
      password: opts.password,
      updateDescription: opts.description,
    };
    
    try {
      const result = await publishApk(opts.file, publishConfig);
      if (!result.success) {
        process.exitCode = 1;
      }
    } catch (err) {
      console.error(kleur.red(`发布出错：${(err as Error).message}`));
      process.exitCode = 1;
    }
  });

// 处理 pnpm/npm scripts 传递参数时的 "--" 分隔符
// 当使用 pnpm dev -- <args> 时，"--" 会被作为参数传递，需要过滤掉
const rawArgs = process.argv.slice(2);
const filteredArgs = rawArgs.filter(arg => arg !== "--");

// 修改 process.argv 以移除 "--" 分隔符，然后使用默认的 parse()
if (rawArgs.length > 0 && rawArgs[0] === "--") {
  // 临时修改 process.argv，移除 "--"
  process.argv = [process.argv[0], process.argv[1], ...filteredArgs];
}

program.parse();

