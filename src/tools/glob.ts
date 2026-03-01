import { glob as globFn } from "glob";
import type { ToolResult } from "./bash.js";

export interface GlobParams {
  pattern: string;
}

export async function glob(params: GlobParams): Promise<ToolResult> {
  try {
    const files = await globFn(params.pattern, {
      absolute: true,
      nodir: false,
      dot: true,
      ignore: ["**/node_modules/**", "**/.git/**"],
    });

    if (files.length === 0) {
      return { content: "No files matched the pattern." };
    }

    return { content: files.join("\n") };
  } catch (err: any) {
    return {
      content: `Error: ${err.message}`,
      isError: true,
    };
  }
}
