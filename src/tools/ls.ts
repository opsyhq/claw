import fs from "node:fs/promises";
import path from "node:path";
import type { ToolResult } from "./bash.js";

export interface LsParams {
  path: string;
}

export async function ls(params: LsParams): Promise<ToolResult> {
  try {
    const entries = await fs.readdir(params.path, { withFileTypes: true });

    const lines: string[] = [];
    for (const entry of entries) {
      const prefix = entry.isDirectory() ? "[DIR]" : "[FILE]";
      let size = "";

      if (!entry.isDirectory()) {
        try {
          const stat = await fs.stat(path.join(params.path, entry.name));
          size = ` (${formatSize(stat.size)})`;
        } catch {
          // ignore stat errors
        }
      }

      lines.push(`${prefix} ${entry.name}${size}`);
    }

    if (lines.length === 0) {
      return { content: "(empty directory)" };
    }

    return { content: lines.join("\n") };
  } catch (err: any) {
    return {
      content: `Error listing directory: ${err.message}`,
      isError: true,
    };
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}
