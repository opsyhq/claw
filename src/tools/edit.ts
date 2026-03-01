import fs from "node:fs/promises";
import type { ToolResult } from "./bash.js";

export interface EditParams {
  path: string;
  old_string: string;
  new_string: string;
}

export async function edit(params: EditParams): Promise<ToolResult> {
  try {
    const content = await fs.readFile(params.path, "utf-8");

    const occurrences = content.split(params.old_string).length - 1;
    if (occurrences === 0) {
      return {
        content: `Error: old_string not found in ${params.path}`,
        isError: true,
      };
    }
    if (occurrences > 1) {
      return {
        content: `Error: old_string found ${occurrences} times in ${params.path}. It must be unique. Provide more context to make it unique.`,
        isError: true,
      };
    }

    const newContent = content.replace(params.old_string, params.new_string);
    await fs.writeFile(params.path, newContent, "utf-8");

    return { content: `Successfully edited ${params.path}` };
  } catch (err: any) {
    return {
      content: `Error editing file: ${err.message}`,
      isError: true,
    };
  }
}
