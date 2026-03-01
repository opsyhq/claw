import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Machine } from "../config/types.js";
import type { Transport } from "../transports/interface.js";
import { Router } from "./router.js";
import {
  bashSchema,
  readSchema,
  writeSchema,
  editSchema,
  grepSchema,
  globSchema,
  lsSchema,
  machinesSchema,
} from "./schemas.js";
import { appendMachine, removeMachine } from "../config/loader.js";
import { auditLog } from "../logging/audit.js";

export function createServer(
  machines: Machine[],
  sshTransportFactory?: (machine: Machine) => Transport,
): { server: McpServer; router: Router } {
  const router = new Router(machines, sshTransportFactory);

  const server = new McpServer({
    name: "claw",
    version: "0.1.4",
  });

  server.tool(
    "claw_machines",
    "Manage machines. Actions: list | add --name --host [--user] [--port] | remove --name | update --name [--host] [--user] [--port]",
    machinesSchema,
    async ({ action, name, host, user, port }) => {
      auditLog("local", "claw_machines", { action, name });

      if (action === "list") {
        const machines = router.getMachines();
        if (machines.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No machines configured. Use action 'add' to add one.",
              },
            ],
          };
        }
        const machineList = machines.map((m) => ({
          name: m.name,
          transport: m.transport,
          host: m.host ?? "localhost",
          status: "available" as const,
        }));
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(machineList, null, 2) },
          ],
        };
      }

      if (!name) {
        return {
          content: [{ type: "text" as const, text: "Missing required parameter: name" }],
          isError: true,
        };
      }

      if (action === "add") {
        if (!host) {
          return {
            content: [{ type: "text" as const, text: "Missing required parameter: host" }],
            isError: true,
          };
        }
        const machine = { name, transport: "ssh" as const, host, user, port };
        router.addMachine(machine);
        appendMachine(name, { transport: "ssh", host, user, port });
        return {
          content: [
            {
              type: "text" as const,
              text: `Added machine "${name}" (${user ? user + "@" : ""}${host}${port ? ":" + port : ""})`,
            },
          ],
        };
      }

      if (action === "remove") {
        const removed = router.removeMachine(name);
        if (!removed) {
          return {
            content: [{ type: "text" as const, text: `Machine "${name}" not found.` }],
            isError: true,
          };
        }
        removeMachine(name);
        return {
          content: [{ type: "text" as const, text: `Removed machine "${name}".` }],
        };
      }

      if (action === "update") {
        const machines = router.getMachines();
        const existing = machines.find((m) => m.name === name);
        if (!existing) {
          return {
            content: [{ type: "text" as const, text: `Machine "${name}" not found.` }],
            isError: true,
          };
        }
        const updated = {
          ...existing,
          ...(host !== undefined && { host }),
          ...(user !== undefined && { user }),
          ...(port !== undefined && { port }),
        };
        router.addMachine(updated);
        appendMachine(name, { transport: updated.transport, host: updated.host, user: updated.user, port: updated.port });
        return {
          content: [
            { type: "text" as const, text: `Updated machine "${name}".` },
          ],
        };
      }

      return {
        content: [{ type: "text" as const, text: `Unknown action: ${action}` }],
        isError: true,
      };
    },
  );

  server.tool(
    "claw_bash",
    "Run a bash command on a remote or local machine.",
    bashSchema,
    async ({ host, command, timeout }) => {
      auditLog(host, "claw_bash", { command });
      const result = await router.execute(host, "bash", { command, timeout });
      return {
        content: [{ type: "text" as const, text: result.content }],
        isError: result.isError,
      };
    },
  );

  server.tool(
    "claw_read",
    "Read a file from a remote or local machine. Returns numbered lines.",
    readSchema,
    async ({ host, path, offset, limit }) => {
      auditLog(host, "claw_read", { path, offset, limit });
      const result = await router.execute(host, "read", {
        path,
        offset,
        limit,
      });
      return {
        content: [{ type: "text" as const, text: result.content }],
        isError: result.isError,
      };
    },
  );

  server.tool(
    "claw_write",
    "Write content to a file on a remote or local machine.",
    writeSchema,
    async ({ host, path, content }) => {
      auditLog(host, "claw_write", { path, content: `(${content.length} chars)` });
      const result = await router.execute(host, "write", { path, content });
      return {
        content: [{ type: "text" as const, text: result.content }],
        isError: result.isError,
      };
    },
  );

  server.tool(
    "claw_edit",
    "Find and replace text in a file on a remote or local machine. The old_string must be unique in the file.",
    editSchema,
    async ({ host, path, old_string, new_string }) => {
      auditLog(host, "claw_edit", { path });
      const result = await router.execute(host, "edit", {
        path,
        old_string,
        new_string,
      });
      return {
        content: [{ type: "text" as const, text: result.content }],
        isError: result.isError,
      };
    },
  );

  server.tool(
    "claw_grep",
    "Search file contents with regex on a remote or local machine.",
    grepSchema,
    async ({ host, pattern, path, include }) => {
      auditLog(host, "claw_grep", { pattern, path, include });
      const result = await router.execute(host, "grep", {
        pattern,
        path,
        include,
      });
      return {
        content: [{ type: "text" as const, text: result.content }],
        isError: result.isError,
      };
    },
  );

  server.tool(
    "claw_glob",
    "Find files matching a glob pattern on a remote or local machine.",
    globSchema,
    async ({ host, pattern }) => {
      auditLog(host, "claw_glob", { pattern });
      const result = await router.execute(host, "glob", { pattern });
      return {
        content: [{ type: "text" as const, text: result.content }],
        isError: result.isError,
      };
    },
  );

  server.tool(
    "claw_ls",
    "List directory contents on a remote or local machine.",
    lsSchema,
    async ({ host, path }) => {
      auditLog(host, "claw_ls", { path });
      const result = await router.execute(host, "ls", { path });
      return {
        content: [{ type: "text" as const, text: result.content }],
        isError: result.isError,
      };
    },
  );

  return { server, router };
}
