import type { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const MCP_CONFIG = {
  claw: {
    command: "npx",
    args: ["-y", "@opsyhq/claw", "serve"],
  },
};

export function registerInstall(program: Command): void {
  program
    .command("install <target>")
    .description("Install Claw into an AI agent's MCP config")
    .action((target: string) => {
      switch (target) {
        case "claude-code":
          installClaudeCode();
          break;
        case "cursor":
          installCursor();
          break;
        default:
          console.error(
            `Unknown target: "${target}". Supported: claude-code, cursor`,
          );
          process.exit(1);
      }
    });
}

function installClaudeCode(): void {
  const settingsPath = path.join(os.homedir(), ".claude", "settings.json");

  let settings: any = {};
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
  } catch {
    // File doesn't exist or is invalid, start fresh
  }

  if (!settings.mcpServers) {
    settings.mcpServers = {};
  }

  settings.mcpServers.claw = MCP_CONFIG.claw;

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");

  console.log(`Installed Claw MCP server into ${settingsPath}`);
  console.log("Restart Claude Code to pick up the changes.");
}

function installCursor(): void {
  const configPath = path.join(process.cwd(), ".cursor", "mcp.json");

  let config: any = {};
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    // File doesn't exist or is invalid, start fresh
  }

  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  config.mcpServers.claw = MCP_CONFIG.claw;

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");

  console.log(`Installed Claw MCP server into ${configPath}`);
  console.log("Restart Cursor to pick up the changes.");
}
