import { execFile } from "node:child_process";

export interface BashParams {
  command: string;
  timeout?: number;
}

export interface ToolResult {
  content: string;
  isError?: boolean;
}

const DEFAULT_TIMEOUT = 120_000; // 2 minutes

export async function bash(params: BashParams): Promise<ToolResult> {
  const timeout = params.timeout ?? DEFAULT_TIMEOUT;

  return new Promise((resolve) => {
    execFile(
      "/bin/bash",
      ["-c", params.command],
      { timeout, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const output = [stdout, stderr].filter(Boolean).join("\n");

        if (error && !stdout && !stderr) {
          resolve({
            content: `Error: ${error.message}`,
            isError: true,
          });
          return;
        }

        resolve({
          content: output || "(no output)",
          isError: !!error,
        });
      },
    );
  });
}
