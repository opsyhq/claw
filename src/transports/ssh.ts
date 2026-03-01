import type { Transport } from "./interface.js";
import type { ToolResult } from "../tools/bash.js";
import type { Machine } from "../config/types.js";
import type { ClientChannel } from "ssh2";
import { getConnection, removeConnection } from "./pool.js";
import { ensurePincer } from "./deployer.js";

interface PendingRequest {
  resolve: (result: ToolResult) => void;
  reject: (error: Error) => void;
}

export class SSHTransport implements Transport {
  private machine: Machine;
  private pincerPath: string | null = null;
  private channel: ClientChannel | null = null;
  private requestId = 0;
  private pending: Map<number, PendingRequest> = new Map();
  private buffer = "";
  private connected = false;

  constructor(machine: Machine) {
    this.machine = machine;
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    const { conn } = await getConnection(this.machine);

    // Ensure pincer is deployed
    this.pincerPath = await ensurePincer(conn);

    // Start pincer process
    this.channel = await new Promise<ClientChannel>((resolve, reject) => {
      conn.exec(this.pincerPath!, (err, stream) => {
        if (err) return reject(err);
        resolve(stream);
      });
    });

    let stderrOutput = "";

    this.channel.on("data", (data: Buffer) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    this.channel.stderr.on("data", (data: Buffer) => {
      stderrOutput += data.toString();
    });

    this.channel.on("close", () => {
      this.connected = false;
      const errMsg = stderrOutput.trim()
        ? `SSH channel closed: ${stderrOutput.trim()}`
        : "SSH channel closed";
      for (const [, req] of this.pending) {
        req.reject(new Error(errMsg));
      }
      this.pending.clear();
    });

    this.connected = true;
  }

  private processBuffer(): void {
    const lines = this.buffer.split("\n");
    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const response = JSON.parse(line);
        const pending = this.pending.get(response.id);
        if (pending) {
          this.pending.delete(response.id);

          if (response.error) {
            pending.resolve({
              content: response.error,
              isError: true,
            });
          } else {
            pending.resolve(response.result);
          }
        }
      } catch {
        // Skip malformed JSON lines
      }
    }
  }

  async execute(tool: string, params: Record<string, any>): Promise<ToolResult> {
    if (!this.connected || !this.channel) {
      await this.connect();
    }

    const id = ++this.requestId;
    const request = JSON.stringify({ method: tool, params, id });

    return new Promise<ToolResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timeout waiting for response from "${this.machine.name}"`));
      }, 120_000);

      this.pending.set(id, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });

      this.channel!.write(request + "\n");
    });
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      this.channel.end();
      this.channel = null;
    }
    removeConnection(this.machine.name);
    this.connected = false;
  }
}

export function createSSHTransport(machine: Machine): Transport {
  return new SSHTransport(machine);
}
