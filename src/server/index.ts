import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Machine } from "../config/types.js";
import type { Transport } from "../transports/interface.js";
import { Router } from "./router.js";
import { parseCommand } from "./parser.js";
import { getHelp } from "./help.js";
import { appendMachine, removeMachine } from "../config/loader.js";
import { auditLog } from "../logging/audit.js";

// ── Structured response ───────────────────────────────────────────────

interface ClawResponse {
  ok: boolean;
  command: string;
  summary: string;
  data?: any;
  nextAction?: string;
}

function respond(r: ClawResponse) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(r, null, 2) }],
    isError: !r.ok,
  };
}

function fail(command: string, summary: string, nextAction?: string) {
  return respond({ ok: false, command, summary, nextAction });
}

// ── Command registry ──────────────────────────────────────────────────

interface CommandSpec {
  required: string[];
  optional?: string[];
  numbers?: string[];
  stdinAs?: string;
  stdinRequired?: boolean;
  summaryOk: (params: Record<string, string>) => string;
  summaryFail: string;
}

const COMMANDS: Record<string, CommandSpec> = {
  read: {
    required: ["path"],
    numbers: ["offset", "limit"],
    summaryOk: (p) => `Read ${p.path}`,
    summaryFail: "Read failed",
  },
  grep: {
    required: ["pattern"],
    optional: ["path", "include"],
    summaryOk: () => "Search complete",
    summaryFail: "Search failed",
  },
  glob: {
    required: ["pattern"],
    summaryOk: () => "Files found",
    summaryFail: "Glob failed",
  },
  ls: {
    required: ["path"],
    summaryOk: (p) => `Listed ${p.path}`,
    summaryFail: "List failed",
  },
  write: {
    required: ["path"],
    stdinAs: "content",
    stdinRequired: true,
    summaryOk: (p) => `Wrote ${p.path}`,
    summaryFail: "Write failed",
  },
};

async function executeCommand(
  spec: CommandSpec,
  command: string,
  router: Router,
  host: string,
  params: Record<string, string>,
  stdin: string | undefined,
  raw: string,
) {
  // Validate required params
  for (const key of spec.required) {
    if (!params[key]) {
      return fail(
        raw,
        `Missing required param: ${key}`,
        `claw("${command} --help")`,
      );
    }
  }

  // Handle stdin→param mapping
  if (spec.stdinAs) {
    if (spec.stdinRequired && stdin === undefined) {
      return fail(
        raw,
        `Missing content. Pass it in stdin.`,
        `claw("${command} --help")`,
      );
    }
    if (stdin !== undefined) {
      params[spec.stdinAs] = stdin;
    }
  }

  // Build execute params (only known keys, with number coercion)
  const allKeys = [
    ...spec.required,
    ...(spec.optional ?? []),
    ...(spec.stdinAs ? [spec.stdinAs] : []),
  ];
  const numbers = new Set(spec.numbers ?? []);
  const execParams: Record<string, any> = {};
  for (const key of allKeys) {
    if (params[key] !== undefined) {
      execParams[key] = numbers.has(key) ? parseInt(params[key]) : params[key];
    }
  }

  // Audit log (content gets redacted for writes)
  const auditParams = { ...execParams };
  if (spec.stdinAs && auditParams[spec.stdinAs]) {
    auditParams[spec.stdinAs] = `(${String(auditParams[spec.stdinAs]).length} chars)`;
  }
  auditLog(host, command, auditParams);

  const result = await router.execute(host, command, execParams);
  return respond({
    ok: !result.isError,
    command: raw,
    summary: result.isError ? spec.summaryFail : spec.summaryOk(params),
    data: result.content,
  });
}

// ── Server instructions ───────────────────────────────────────────────

const SERVER_INSTRUCTIONS = [
  "Claw gives you bash, read, write, edit, grep, glob, and ls on any configured machine.",
  "",
  "Single tool: claw(command, stdin?). All operations go through one entry point.",
  'Self-discoverable: claw("--help") lists commands, claw("<cmd> --help") shows params.',
  "",
  "Conventions:",
  "  - host= identifies the target machine (run machines list to see available ones)",
  "  - stdin carries payloads: shell commands (bash), file content (write), edit JSON (edit)",
  "  - Responses are JSON: { ok, command, summary, data, nextAction }",
  "  - nextAction hints what to do next on errors or after mutations",
  "",
  "Quick reference:",
  '  claw("bash host=m", stdin="docker ps")',
  '  claw("read host=m path=/etc/hosts")',
  '  claw("write host=m path=/tmp/f", stdin="content")',
  '  claw("edit host=m path=/tmp/f", stdin=\'{"old_string":"a","new_string":"b"}\')',
  '  claw("grep host=m pattern=error path=/var/log")',
  '  claw("machines list")',
].join("\n");

// ── Server factory ────────────────────────────────────────────────────

export function createServer(
  machines: Machine[],
  sshTransportFactory?: (machine: Machine) => Transport,
): { server: McpServer; router: Router } {
  const router = new Router(machines, sshTransportFactory);

  const server = new McpServer(
    { name: "claw", version: "0.1.7" },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.tool(
    "claw",
    [
      "Remote machine operations. Single CLI-style entry point.",
      'Help: claw("--help") or claw("<command> --help")',
    ].join("\n"),
    {
      command: z
        .string()
        .describe(
          'CLI-style command string, e.g. "bash host=prod", "machines list", "--help"',
        ),
      stdin: z
        .string()
        .optional()
        .describe(
          "Payload: shell command (bash), file content (write), edit JSON (edit)",
        ),
    },
    async ({ command: raw, stdin }) => {
      const parsed = parseCommand(raw);

      // Help
      if (parsed.help || !parsed.command) {
        return {
          content: [
            {
              type: "text" as const,
              text: getHelp(parsed.command, parsed.action),
            },
          ],
        };
      }

      // Machines management
      if (parsed.command === "machines") {
        return handleMachines(router, parsed.action, parsed.params);
      }

      // All other commands need host
      const host = parsed.params.host;
      if (!host) {
        return fail(
          raw,
          "Missing required param: host",
          `claw("${parsed.command} --help")`,
        );
      }

      // Registry commands
      const spec = COMMANDS[parsed.command];
      if (spec) {
        return executeCommand(
          spec,
          parsed.command,
          router,
          host,
          { ...parsed.params },
          stdin,
          raw,
        );
      }

      // Special commands with custom logic
      switch (parsed.command) {
        case "bash":
          return handleBash(router, host, parsed.params, stdin, raw);
        case "edit":
          return handleEdit(router, host, parsed.params, stdin, raw);
        default:
          return fail(
            raw,
            `Unknown command: "${parsed.command}"`,
            'claw("--help")',
          );
      }
    },
  );

  return { server, router };
}

// ── Special command handlers ──────────────────────────────────────────

async function handleBash(
  router: Router,
  host: string,
  params: Record<string, string>,
  stdin: string | undefined,
  raw: string,
) {
  const cmd = stdin ?? params.command;
  if (!cmd) {
    return fail(
      raw,
      "Missing shell command. Pass it in stdin or command= param.",
      'claw("bash --help")',
    );
  }
  auditLog(host, "bash", { command: cmd });
  const timeout = params.timeout ? parseInt(params.timeout) : undefined;
  const result = await router.execute(host, "bash", { command: cmd, timeout });
  return respond({
    ok: !result.isError,
    command: raw,
    summary: result.isError ? "Command failed" : "Command executed",
    data: result.content,
  });
}

async function handleEdit(
  router: Router,
  host: string,
  params: Record<string, string>,
  stdin: string | undefined,
  raw: string,
) {
  if (!params.path) {
    return fail(raw, "Missing required param: path", 'claw("edit --help")');
  }

  let oldStr: string;
  let newStr: string;

  if (stdin) {
    let payload: { old_string?: string; new_string?: string };
    try {
      payload = JSON.parse(stdin);
    } catch {
      return fail(
        raw,
        'Invalid stdin JSON. Expected: {"old_string":"...","new_string":"..."}',
      );
    }
    if (!payload.old_string || payload.new_string === undefined) {
      return fail(
        raw,
        "stdin JSON must have old_string and new_string fields",
      );
    }
    oldStr = payload.old_string;
    newStr = payload.new_string;
  } else if (params.old_string && params.new_string !== undefined) {
    oldStr = params.old_string;
    newStr = params.new_string;
  } else {
    return fail(
      raw,
      "Missing edit payload. Pass JSON in stdin or old_string=/new_string= params.",
      'claw("edit --help")',
    );
  }

  auditLog(host, "edit", { path: params.path });
  const result = await router.execute(host, "edit", {
    path: params.path,
    old_string: oldStr,
    new_string: newStr,
  });
  return respond({
    ok: !result.isError,
    command: raw,
    summary: result.isError ? "Edit failed" : `Edited ${params.path}`,
    data: result.content,
  });
}

// ── Machines management ───────────────────────────────────────────────

async function handleMachines(
  router: Router,
  action: string | undefined,
  params: Record<string, string>,
) {
  auditLog("local", "machines", { action, ...params });

  if (!action) {
    return respond({
      ok: false,
      command: "machines",
      summary: "Missing action",
      nextAction: 'claw("machines --help")',
    });
  }

  switch (action) {
    case "list": {
      const machines = router.getMachines();
      if (machines.length === 0) {
        return respond({
          ok: true,
          command: "machines list",
          summary: "No machines configured",
          data: [],
          nextAction: 'claw("machines add name=<name> host=<host>")',
        });
      }
      return respond({
        ok: true,
        command: "machines list",
        summary: `${machines.length} machine(s) configured`,
        data: machines.map((m) => ({
          name: m.name,
          transport: m.transport,
          host: m.host ?? "localhost",
        })),
      });
    }

    case "add": {
      const { name, host, user, port, identityFile } = params;
      if (!name) {
        return fail(
          "machines add",
          "Missing required param: name",
          'claw("machines add --help")',
        );
      }
      if (!host) {
        return fail(
          "machines add",
          "Missing required param: host",
          'claw("machines add --help")',
        );
      }
      const machine: Machine = {
        name,
        transport: "ssh",
        host,
        user: user || undefined,
        port: port ? parseInt(port) : undefined,
        identityFile: identityFile || undefined,
      };
      router.addMachine(machine);
      appendMachine(name, {
        transport: "ssh",
        host,
        user: machine.user,
        port: machine.port,
        identityFile: machine.identityFile,
      });
      return respond({
        ok: true,
        command: `machines add name=${name}`,
        summary: `Added machine "${name}" (${user ? user + "@" : ""}${host}${port ? ":" + port : ""})`,
        nextAction: `claw("bash host=${name}", stdin="whoami")`,
      });
    }

    case "remove": {
      const { name } = params;
      if (!name) {
        return fail(
          "machines remove",
          "Missing required param: name",
          'claw("machines remove --help")',
        );
      }
      const removed = router.removeMachine(name);
      if (!removed) {
        return fail(
          `machines remove name=${name}`,
          `Machine "${name}" not found`,
        );
      }
      removeMachine(name);
      return respond({
        ok: true,
        command: `machines remove name=${name}`,
        summary: `Removed machine "${name}"`,
      });
    }

    case "update": {
      const { name, host, user, port, identityFile } = params;
      if (!name) {
        return fail(
          "machines update",
          "Missing required param: name",
          'claw("machines update --help")',
        );
      }
      const existing = router.getMachines().find((m) => m.name === name);
      if (!existing) {
        return fail(
          `machines update name=${name}`,
          `Machine "${name}" not found`,
        );
      }
      const updated: Machine = {
        ...existing,
        ...(host !== undefined && { host }),
        ...(user !== undefined && { user }),
        ...(port !== undefined && { port: parseInt(port) }),
        ...(identityFile !== undefined && { identityFile }),
      };
      router.addMachine(updated);
      appendMachine(name, {
        transport: updated.transport,
        host: updated.host,
        user: updated.user,
        port: updated.port,
        identityFile: updated.identityFile,
      });
      return respond({
        ok: true,
        command: `machines update name=${name}`,
        summary: `Updated machine "${name}"`,
      });
    }

    default:
      return fail(
        `machines ${action}`,
        `Unknown action: "${action}"`,
        'claw("machines --help")',
      );
  }
}
