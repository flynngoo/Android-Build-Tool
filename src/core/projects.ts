import fs from "fs";
import path from "path";

export type Project = {
  name: string;
  path: string;
  defaultModule?: string; // 保留以兼容旧数据
  modules?: string[]; // 支持多个模块
  defaultVariant?: string;
  variants?: string[]; // 支持多个 variant
  buildType?: "Debug" | "Release";
};

export type ProjectsConfig = {
  projects: Project[];
};

const CONFIG_PATH = path.resolve(process.cwd(), "config/projects.json");

const ensureConfigFile = () => {
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ projects: [] }, null, 2));
  }
};

export const loadProjects = (): ProjectsConfig => {
  ensureConfigFile();
  const content = fs.readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(content) as ProjectsConfig;
};

const saveProjects = (config: ProjectsConfig) => {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
};

export const listProjects = (): Project[] => {
  return loadProjects().projects;
};

export const addProject = (project: Project): void => {
  const config = loadProjects();
  const exists = config.projects.find((p) => p.name === project.name);
  if (exists) {
    throw new Error(`工程名已存在：${project.name}`);
  }
  const gradlePath = path.join(project.path, "gradlew");
  if (!fs.existsSync(gradlePath)) {
    throw new Error("未找到 gradlew，请确认工程路径正确");
  }
  config.projects.push(project);
  saveProjects(config);
};

export const findProject = (name: string): Project | undefined => {
  return loadProjects().projects.find((p) => p.name === name);
};

export const deleteProject = (name: string): void => {
  const config = loadProjects();
  const index = config.projects.findIndex((p) => p.name === name);
  if (index === -1) {
    throw new Error(`工程不存在：${name}`);
  }
  config.projects.splice(index, 1);
  saveProjects(config);
};

