import { Command } from "commander";
import { registerServe } from "./serve.js";
import { registerInit } from "./init.js";
import { registerAdd } from "./add.js";
import { registerInstall } from "./install.js";

export const cli = new Command()
  .name("claw")
  .description("MCP server for remote machine access over SSH")
  .version("0.1.4");

registerServe(cli);
registerInit(cli);
registerAdd(cli);
registerInstall(cli);
