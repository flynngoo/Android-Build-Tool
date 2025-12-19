import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import type { Project } from "./projects";

export type GradleBuildOptions = {
  variant?: string;
  buildType: string;
  module?: string;
  outputDir?: string;
  extraArgs?: string[];
};

/**
 * 查找构建产物（APK/AAB）
 */
const findBuildArtifacts = (projectPath: string, module?: string): string[] => {
  const artifacts: string[] = [];
  const modulePath = module ? path.join(projectPath, module) : projectPath;
  
  // APK 文件路径
  const apkPath = path.join(modulePath, "build", "outputs", "apk");
  // AAB 文件路径
  const bundlePath = path.join(modulePath, "build", "outputs", "bundle");
  
  // 查找所有 APK 文件
  if (fs.existsSync(apkPath)) {
    const findApks = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          findApks(fullPath);
        } else if (entry.name.endsWith(".apk")) {
          artifacts.push(fullPath);
        }
      }
    };
    findApks(apkPath);
  }
  
  // 查找所有 AAB 文件
  if (fs.existsSync(bundlePath)) {
    const findAabs = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          findAabs(fullPath);
        } else if (entry.name.endsWith(".aab")) {
          artifacts.push(fullPath);
        }
      }
    };
    findAabs(bundlePath);
  }
  
  return artifacts;
};

/**
 * 清理目录中的所有文件和子目录
 */
const cleanDirectory = (dir: string): void => {
  if (!fs.existsSync(dir)) {
    return;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      console.warn(`清理文件/目录失败: ${fullPath}`, err);
    }
  }
};

/**
 * 复制构建产物到输出目录
 */
const copyArtifactsToOutputDir = (artifacts: string[], outputDir: string): void => {
  if (artifacts.length === 0) {
    console.log("未找到构建产物");
    return;
  }
  
  console.log(`准备复制 ${artifacts.length} 个文件到: ${outputDir}`);
  
  // 如果输出目录已存在，先清理目录（确保只保留最新的构建产物）
  if (fs.existsSync(outputDir)) {
    console.log(`清理输出目录: ${outputDir}`);
    cleanDirectory(outputDir);
  } else {
    // 如果不存在，创建目录
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`已创建输出目录: ${outputDir}`);
  }
  
  // 复制每个构建产物
  for (const artifact of artifacts) {
    const fileName = path.basename(artifact);
    const destPath = path.join(outputDir, fileName);
    try {
      if (!fs.existsSync(artifact)) {
        console.error(`源文件不存在: ${artifact}`);
        continue;
      }
      fs.copyFileSync(artifact, destPath);
      console.log(`✅ 已复制: ${fileName} -> ${destPath}`);
    } catch (err) {
      console.error(`❌ 复制失败 ${fileName}:`, err);
    }
  }
};

export const runGradleBuild = (project: Project, options: GradleBuildOptions): Promise<number> => {
  const { variant, buildType, module, extraArgs = [] } = options;
  const gradleFile = process.platform === "win32" ? "gradlew.bat" : "gradlew";
  const gradlePath = path.join(project.path, gradleFile);
  
  // variant规则：variant + buildType（不需要大小写转换，以填写为准）
  const fullVariant = variant ? `${variant}${buildType}` : buildType;
  
  const task = module ? `:${module}:assemble${fullVariant}` : `assemble${fullVariant}`;
  
  let finalOutputDir = project.path;
  if (module) {
    finalOutputDir = path.join(finalOutputDir, module);
  }
  // 输出目录：path+module+variant/buildType
  if (variant) {
    finalOutputDir = path.join(finalOutputDir, variant, buildType);
  } else {
    finalOutputDir = path.join(finalOutputDir, buildType);
  }
  
  const args = [task, ...extraArgs];

  return new Promise((resolve, reject) => {
    const child = spawn(gradlePath, args, { cwd: project.path, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", async (code) => {
      if (code === 0) {
        // 构建成功后，复制构建产物到输出目录（默认或指定的）
        console.log(`\n输出目录: ${finalOutputDir}`);
        const artifacts = findBuildArtifacts(project.path, module);
        console.log(`找到 ${artifacts.length} 个构建产物`);
        if (artifacts.length > 0) {
          artifacts.forEach(artifact => {
            console.log(`  - ${artifact}`);
          });
          copyArtifactsToOutputDir(artifacts, finalOutputDir);
        } else {
          console.log("未找到构建产物，请检查构建是否成功");
          console.log(`查找路径: ${module ? path.join(project.path, module) : project.path}`);
        }
      }
      resolve(code ?? 1);
    });
  });
};

