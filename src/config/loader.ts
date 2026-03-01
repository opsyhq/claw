import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import YAML from "yaml";
import type { Config, Machine } from "./types.js";

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), ".config", "claw");
const GLOBAL_CONFIG_PATH = path.join(GLOBAL_CONFIG_DIR, "machines.yaml");
const PROJECT_CONFIG_NAME = "claw.yaml";

function readYamlConfig(filePath: string): Config | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return YAML.parse(content) as Config;
  } catch {
    return null;
  }
}

export function getGlobalConfigDir(): string {
  return GLOBAL_CONFIG_DIR;
}

export function getGlobalConfigPath(): string {
  return GLOBAL_CONFIG_PATH;
}

export function loadConfig(): Machine[] {
  const globalConfig = readYamlConfig(GLOBAL_CONFIG_PATH);
  const projectConfig = readYamlConfig(
    path.join(process.cwd(), PROJECT_CONFIG_NAME),
  );

  const merged: Record<string, Omit<Machine, "name">> = {};

  if (globalConfig?.machines) {
    Object.assign(merged, globalConfig.machines);
  }
  if (projectConfig?.machines) {
    Object.assign(merged, projectConfig.machines);
  }

  return Object.entries(merged).map(([name, config]) => ({
    name,
    ...config,
  }));
}

export function ensureGlobalConfigDir(): void {
  fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
}

export function writeGlobalConfig(config: Config): void {
  ensureGlobalConfigDir();
  fs.writeFileSync(GLOBAL_CONFIG_PATH, YAML.stringify(config), "utf-8");
}

export function appendMachine(
  name: string,
  machine: Omit<Machine, "name">,
): void {
  const existing = readYamlConfig(GLOBAL_CONFIG_PATH);
  const config: Config = existing ?? { machines: {} };
  config.machines[name] = machine;
  writeGlobalConfig(config);
}

export function removeMachine(name: string): boolean {
  const existing = readYamlConfig(GLOBAL_CONFIG_PATH);
  if (!existing?.machines?.[name]) return false;
  delete existing.machines[name];
  writeGlobalConfig(existing);
  return true;
}
