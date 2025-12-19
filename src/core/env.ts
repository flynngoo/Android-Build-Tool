import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export type EnvCheck = {
  tool: string;
  ok: boolean;
  message: string;
  detail?: string;
};

const run = (cmd: string, args: string[]): { ok: boolean; output: string } => {
  try {
    const result = execSync([cmd, ...args].join(" "), { stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, output: result.toString().trim() };
  } catch (error) {
    const err = error as { stderr?: Buffer };
    return { ok: false, output: err.stderr?.toString().trim() ?? "" };
  }
};

const checkJava = (): EnvCheck => {
  const result = run("java", ["-version"]);
  return {
    tool: "Java (JDK)",
    ok: result.ok,
    message: result.ok ? "已检测到 JDK" : "未检测到 JDK，请安装 JDK 17+",
    detail: result.output,
  };
};

const checkJavaHome = (): EnvCheck => {
  const result = run("/usr/libexec/java_home", []);
  return {
    tool: "JAVA_HOME",
    ok: result.ok,
    message: result.ok ? `JAVA_HOME: ${result.output}` : "未检测到 JAVA_HOME",
    detail: result.output,
  };
};

const checkXcode = (): EnvCheck => {
  const result = run("xcode-select", ["-p"]);
  return {
    tool: "Xcode CLT",
    ok: result.ok,
    message: result.ok ? `已检测到 Xcode Command Line Tools: ${result.output}` : "未检测到 Xcode CLT",
    detail: result.output,
  };
};

export const checkEnv = (): EnvCheck[] => {
  return [
    checkJava(),
    checkJavaHome(),
    checkXcode(),
  ];
};

export const describeEnv = (): string => {
  const checks = checkEnv();
  const lines = checks.map((c) => `${c.ok ? "✅" : "❌"} ${c.tool} - ${c.message}`);
  return lines.join("\n");
};

