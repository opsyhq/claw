import type { Transport } from "./interface.js";
import type { ToolResult } from "../tools/bash.js";
import { bash } from "../tools/bash.js";
import { read } from "../tools/read.js";
import { write } from "../tools/write.js";
import { edit } from "../tools/edit.js";
import { grep } from "../tools/grep.js";
import { glob } from "../tools/glob.js";
import { ls } from "../tools/ls.js";

export class LocalTransport implements Transport {
  async execute(tool: string, params: Record<string, any>): Promise<ToolResult> {
    switch (tool) {
      case "bash":
        return bash(params as any);
      case "read":
        return read(params as any);
      case "write":
        return write(params as any);
      case "edit":
        return edit(params as any);
      case "grep":
        return grep(params as any);
      case "glob":
        return glob(params as any);
      case "ls":
        return ls(params as any);
      default:
        return { content: `Unknown tool: ${tool}`, isError: true };
    }
  }
}
