import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import SSHConfig from "ssh-config";
import type { Machine } from "./types.js";

const SSH_CONFIG_PATH = path.join(os.homedir(), ".ssh", "config");

export function parseSSHConfig(): Machine[] {
  let content: string;
  try {
    content = fs.readFileSync(SSH_CONFIG_PATH, "utf-8");
  } catch {
    return [];
  }

  const parsed = SSHConfig.parse(content);
  const machines: Machine[] = [];

  for (const section of parsed) {
    // type 1 = Directive
    if ((section as any).type !== 1 || (section as any).param !== "Host") {
      continue;
    }

    const hostPattern = String((section as any).value);

    // Skip wildcard entries
    if (hostPattern.includes("*") || hostPattern.includes("?")) {
      continue;
    }

    const machine: Machine = {
      name: hostPattern,
      transport: "ssh",
      host: hostPattern,
    };

    const config = (section as any).config;
    if (config) {
      for (const directive of config) {
        if (directive.type !== 1) continue;
        const param = String(directive.param).toLowerCase();
        const value = String(directive.value);

        switch (param) {
          case "hostname":
            machine.host = value;
            break;
          case "user":
            machine.user = value;
            break;
          case "port":
            machine.port = parseInt(value, 10);
            break;
          case "identityfile":
            machine.identityFile = value.replace(/^~/, os.homedir());
            break;
        }
      }
    }

    machines.push(machine);
  }

  return machines;
}
