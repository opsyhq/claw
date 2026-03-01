import type { Command } from "commander";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "../config/loader.js";
import { createServer } from "../server/index.js";
import { createSSHTransport } from "../transports/ssh.js";
import { closeAuditLog } from "../logging/audit.js";
import type { Machine } from "../config/types.js";

export function registerServe(program: Command): void {
  program
    .command("serve")
    .description("Start the Claw MCP server (stdio transport)")
    .action(async () => {
      const machines = loadConfig();

      const { server, router } = createServer(
        machines,
        (machine: Machine) => createSSHTransport(machine),
      );

      const transport = new StdioServerTransport();
      await server.connect(transport);

      const shutdown = async () => {
        await router.disconnectAll();
        closeAuditLog();
        process.exit(0);
      };

      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    });
}
