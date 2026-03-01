import type { Transport } from "../transports/interface.js";
import type { Machine } from "../config/types.js";
import type { ToolResult } from "../tools/bash.js";
import { LocalTransport } from "../transports/local.js";

export class Router {
  private machines: Machine[];
  private transports: Map<string, Transport> = new Map();
  private sshTransportFactory?: (machine: Machine) => Transport;

  constructor(
    machines: Machine[],
    sshTransportFactory?: (machine: Machine) => Transport,
  ) {
    this.machines = machines;
    this.sshTransportFactory = sshTransportFactory;
  }

  getMachines(): Machine[] {
    return this.machines;
  }

  addMachine(machine: Machine): void {
    const existing = this.machines.find((m) => m.name === machine.name);
    if (existing) {
      Object.assign(existing, machine);
    } else {
      this.machines.push(machine);
    }
  }

  removeMachine(name: string): boolean {
    const idx = this.machines.findIndex((m) => m.name === name);
    if (idx === -1) return false;
    this.machines.splice(idx, 1);
    // Clean up any cached transport
    const transport = this.transports.get(name);
    if (transport?.disconnect) {
      transport.disconnect();
    }
    this.transports.delete(name);
    return true;
  }

  private getTransport(host: string): Transport {
    const existing = this.transports.get(host);
    if (existing) return existing;

    const machine = this.machines.find((m) => m.name === host);
    if (!machine) {
      throw new Error(
        `Unknown machine: "${host}". Available: ${this.machines.map((m) => m.name).join(", ")}`,
      );
    }

    let transport: Transport;
    if (machine.transport === "local") {
      transport = new LocalTransport();
    } else if (this.sshTransportFactory) {
      transport = this.sshTransportFactory(machine);
    } else {
      throw new Error(
        `SSH transport not available. Machine "${host}" requires SSH.`,
      );
    }

    this.transports.set(host, transport);
    return transport;
  }

  async execute(
    host: string,
    tool: string,
    params: Record<string, any>,
  ): Promise<ToolResult> {
    const transport = this.getTransport(host);

    if (transport.connect) {
      await transport.connect();
    }

    return transport.execute(tool, params);
  }

  async disconnectAll(): Promise<void> {
    for (const transport of this.transports.values()) {
      if (transport.disconnect) {
        await transport.disconnect();
      }
    }
    this.transports.clear();
  }
}
