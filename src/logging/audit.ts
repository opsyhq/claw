import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const LOG_DIR = path.join(os.homedir(), ".config", "claw", "logs");

let logStream: fs.WriteStream | null = null;
let currentDate: string | null = null;

function getLogStream(): fs.WriteStream {
  const today = new Date().toISOString().split("T")[0];

  if (logStream && currentDate === today) {
    return logStream;
  }

  if (logStream) {
    logStream.end();
  }

  fs.mkdirSync(LOG_DIR, { recursive: true });
  currentDate = today;
  logStream = fs.createWriteStream(path.join(LOG_DIR, `${today}.log`), {
    flags: "a",
  });

  return logStream;
}

export function auditLog(
  host: string,
  tool: string,
  params: Record<string, any>,
): void {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      host,
      tool,
      params,
    };
    getLogStream().write(JSON.stringify(entry) + "\n");
  } catch {
    // Don't let logging failures break tool execution
  }
}

export function closeAuditLog(): void {
  if (logStream) {
    logStream.end();
    logStream = null;
    currentDate = null;
  }
}
