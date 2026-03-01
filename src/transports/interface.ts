import type { ToolResult } from "../tools/bash.js";

export interface Transport {
  execute(tool: string, params: Record<string, any>): Promise<ToolResult>;
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
}
