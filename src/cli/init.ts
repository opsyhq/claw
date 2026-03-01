import type { Command } from "commander";
import { parseSSHConfig } from "../config/ssh-parser.js";
import { writeGlobalConfig, getGlobalConfigPath } from "../config/loader.js";
import type { Config, Machine } from "../config/types.js";

export function registerInit(program: Command): void {
  program
    .command("init")
    .description("Initialize Claw configuration")
    .option("--from-ssh", "Import machines from ~/.ssh/config")
    .action((options: { fromSsh?: boolean }) => {
      if (!options.fromSsh) {
        console.error("Usage: claw init --from-ssh");
        process.exit(1);
      }

      const machines = parseSSHConfig();

      if (machines.length === 0) {
        console.log("No hosts found in ~/.ssh/config");
        return;
      }

      const config: Config = { machines: {} };
      for (const machine of machines) {
        const entry: Omit<Machine, "name"> = { transport: "ssh" };
        if (machine.host) entry.host = machine.host;
        if (machine.user) entry.user = machine.user;
        if (machine.port) entry.port = machine.port;
        config.machines[machine.name] = entry;
      }

      writeGlobalConfig(config);

      console.log(`Imported ${machines.length} machine(s) to ${getGlobalConfigPath()}:`);
      for (const m of machines) {
        console.log(`  - ${m.name} (${m.host ?? m.name})`);
      }
    });
}
