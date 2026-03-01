import fs from "node:fs/promises";
import path from "node:path";
import type { ToolResult } from "./bash.js";

export interface WriteParams {
  path: string;
  content: string;
}

export async function write(params: WriteParams): Promise<ToolResult> {
  try {
    await fs.mkdir(path.dirname(params.path), { recursive: true });
    await fs.writeFile(params.path, params.content, "utf-8");
    return { content: `Successfully wrote to ${params.path}` };
  } catch (err: any) {
    return {
      content: `Error writing file: ${err.message}`,
      isError: true,
    };
  }
}
