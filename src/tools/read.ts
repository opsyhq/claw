import fs from "node:fs/promises";
import type { ToolResult } from "./bash.js";

export interface ReadParams {
  path: string;
  offset?: number;
  limit?: number;
}

export async function read(params: ReadParams): Promise<ToolResult> {
  try {
    const content = await fs.readFile(params.path, "utf-8");
    const lines = content.split("\n");

    const offset = params.offset ?? 0;
    const limit = params.limit ?? lines.length;
    const sliced = lines.slice(offset, offset + limit);

    // Format with line numbers (1-indexed)
    const numbered = sliced
      .map((line, i) => `${offset + i + 1}\t${line}`)
      .join("\n");

    return { content: numbered };
  } catch (err: any) {
    return {
      content: `Error reading file: ${err.message}`,
      isError: true,
    };
  }
}
