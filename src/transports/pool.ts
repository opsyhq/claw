import { Client } from "ssh2";
import type { Machine } from "../config/types.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface PooledConnection {
  conn: Client;
  machine: Machine;
}

const pool: Map<string, PooledConnection> = new Map();

function getDefaultKeyPaths(): string[] {
  const sshDir = path.join(os.homedir(), ".ssh");
  const candidates = ["id_ed25519", "id_rsa", "id_ecdsa"];
  return candidates
    .map((k) => path.join(sshDir, k))
    .filter((p) => {
      try {
        fs.accessSync(p);
        return true;
      } catch {
        return false;
      }
    });
}

export function getConnection(machine: Machine): Promise<PooledConnection> {
  const key = machine.name;
  const existing = pool.get(key);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve, reject) => {
    const conn = new Client();

    const config: any = {
      host: machine.host ?? "localhost",
      port: machine.port ?? 22,
      username: machine.user ?? os.userInfo().username,
      readyTimeout: 30000,
    };

    // Try to use identity file from machine config or defaults
    if (machine.identityFile) {
      try {
        const keyPath = machine.identityFile.replace(/^~(?=$|\/)/, os.homedir());
        config.privateKey = fs.readFileSync(keyPath);
      } catch {
        // Fall through to agent
      }
    } else {
      const keys = getDefaultKeyPaths();
      if (keys.length > 0) {
        try {
          config.privateKey = fs.readFileSync(keys[0]);
        } catch {
          // Fall through to agent
        }
      }
    }

    // Use SSH agent if available
    if (!config.privateKey && process.env.SSH_AUTH_SOCK) {
      config.agent = process.env.SSH_AUTH_SOCK;
    }

    conn.on("ready", () => {
      const pooled = { conn, machine };
      pool.set(key, pooled);
      resolve(pooled);
    });

    conn.on("error", (err: Error) => {
      pool.delete(key);
      reject(new Error(`SSH connection to "${machine.name}" failed: ${err.message}`));
    });

    conn.on("close", () => {
      pool.delete(key);
    });

    conn.connect(config);
  });
}

export function removeConnection(name: string): void {
  const entry = pool.get(name);
  if (entry) {
    entry.conn.end();
    pool.delete(name);
  }
}

export function closeAll(): void {
  for (const [name, entry] of pool) {
    entry.conn.end();
  }
  pool.clear();
}
