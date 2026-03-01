import fs from "node:fs/promises";
import path from "node:path";
import { glob as globFn } from "glob";
import type { ToolResult } from "./bash.js";

export interface GrepParams {
  pattern: string;
  path?: string;
  include?: string;
}

const MAX_RESULTS = 1000;

export async function grep(params: GrepParams): Promise<ToolResult> {
  try {
    const searchPath = params.path ?? process.cwd();

    let regex: RegExp;
    try {
      regex = new RegExp(params.pattern);
    } catch (err: any) {
      return { content: `Invalid regex: ${err.message}`, isError: true };
    }

    // Find files to search
    const globPattern = params.include ?? "**/*";
    const files = await globFn(globPattern, {
      cwd: searchPath,
      absolute: true,
      nodir: true,
      dot: true,
      ignore: ["**/node_modules/**", "**/.git/**"],
    });

    const matches: string[] = [];

    for (const file of files) {
      if (matches.length >= MAX_RESULTS) break;

      try {
        const content = await fs.readFile(file, "utf-8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          if (matches.length >= MAX_RESULTS) break;
          if (regex.test(lines[i])) {
            const relPath = path.relative(searchPath, file);
            matches.push(`${relPath}:${i + 1}:${lines[i]}`);
          }
        }
      } catch {
        // Skip binary/unreadable files
      }
    }

    if (matches.length === 0) {
      return { content: "No matches found." };
    }

    let output = matches.join("\n");
    if (matches.length >= MAX_RESULTS) {
      output += `\n\n(results truncated at ${MAX_RESULTS} matches)`;
    }

    return { content: output };
  } catch (err: any) {
    return {
      content: `Error: ${err.message}`,
      isError: true,
    };
  }
}
