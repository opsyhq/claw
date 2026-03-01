import type { Command } from "commander";
import { appendMachine, getGlobalConfigPath } from "../config/loader.js";

export function registerAdd(program: Command): void {
  program
    .command("add <name>")
    .description("Add a machine to the global config")
    .option("--ssh <user@host>", "Add as SSH machine (user@host or just host)")
    .option("--local", "Add as local machine")
    .action(
      (name: string, options: { ssh?: string; local?: boolean }) => {
        if (!options.ssh && !options.local) {
          console.error("Specify --ssh <user@host> or --local");
          process.exit(1);
        }

        if (options.local) {
          appendMachine(name, { transport: "local" });
          console.log(`Added local machine "${name}" to ${getGlobalConfigPath()}`);
          return;
        }

        if (options.ssh) {
          const parts = options.ssh.split("@");
          const machine: { transport: "ssh"; host: string; user?: string } = {
            transport: "ssh",
            host: parts.length > 1 ? parts[1] : parts[0],
          };
          if (parts.length > 1) {
            machine.user = parts[0];
          }

          appendMachine(name, machine);
          console.log(`Added SSH machine "${name}" (${options.ssh}) to ${getGlobalConfigPath()}`);
        }
      },
    );
}
