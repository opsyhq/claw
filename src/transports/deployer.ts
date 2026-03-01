import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pipeline } from "node:stream/promises";
import type { Client, SFTPWrapper } from "ssh2";

const VERSION = "0.1.6";
const REMOTE_DIR = ".claw";
const REMOTE_BINARY_REL = `${REMOTE_DIR}/pincer`;
const RELEASE_URL_BASE = "https://github.com/opsyhq/claw/releases/download";
const CACHE_DIR = path.join(os.homedir(), ".config", "claw", "bin");

function getArchName(unameMArch: string): string {
  const archMap: Record<string, string> = {
    x86_64: "amd64",
    aarch64: "arm64",
    arm64: "arm64",
  };
  return archMap[unameMArch] ?? "amd64";
}

function getCachedPath(goArch: string): string {
  return path.join(CACHE_DIR, `pincer-linux-${goArch}-${VERSION}`);
}

function getDownloadUrl(goArch: string): string {
  return `${RELEASE_URL_BASE}/v${VERSION}/pincer-linux-${goArch}`;
}

function getLocalDevPath(goArch: string): string | null {
  // Check for locally-built binary (development use)
  const candidates = [
    path.join(process.cwd(), "pincer-bin", `pincer-linux-${goArch}`),
  ];

  // Walk up from this file's location
  let dir = path.dirname(new URL(import.meta.url).pathname);
  for (let i = 0; i < 5; i++) {
    candidates.push(path.join(dir, "pincer-bin", `pincer-linux-${goArch}`));
    dir = path.dirname(dir);
  }

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function downloadPincer(goArch: string): Promise<string> {
  const cached = getCachedPath(goArch);
  if (fs.existsSync(cached)) return cached;

  const url = getDownloadUrl(goArch);
  const res = await fetch(url, { redirect: "follow" });

  if (!res.ok || !res.body) {
    throw new Error(
      `Failed to download pincer from ${url}: ${res.status} ${res.statusText}`,
    );
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const tmpPath = `${cached}.tmp`;
  const fileStream = fs.createWriteStream(tmpPath);
  await pipeline(res.body as any, fileStream);
  fs.chmodSync(tmpPath, 0o755);
  fs.renameSync(tmpPath, cached);

  return cached;
}

async function resolvePincerBinary(goArch: string): Promise<string> {
  // 1. Check local dev build first
  const localPath = getLocalDevPath(goArch);
  if (localPath) return localPath;

  // 2. Check cache / download from GitHub Releases
  return downloadPincer(goArch);
}

async function execCommand(conn: Client, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);

      let output = "";
      let stderr = "";
      stream.on("data", (data: Buffer) => {
        output += data.toString();
      });
      stream.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });
      stream.on("close", (code: number) => {
        if (code !== 0 && !output.trim()) {
          reject(new Error(`Command failed (exit ${code}): ${stderr.trim()}`));
        } else {
          resolve(output.trim());
        }
      });
    });
  });
}

function getSftp(conn: Client): Promise<SFTPWrapper> {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) reject(err);
      else resolve(sftp);
    });
  });
}

export async function ensurePincer(conn: Client): Promise<string> {
  // Detect remote home directory and architecture
  const [remoteHome, arch] = await Promise.all([
    execCommand(conn, "echo $HOME"),
    execCommand(conn, "uname -m"),
  ]);

  const goArch = getArchName(arch);
  const remoteBinaryPath = `${remoteHome}/${REMOTE_BINARY_REL}`;

  // Check if pincer already exists with correct version
  try {
    const remoteVersion = await execCommand(
      conn,
      `${remoteBinaryPath} --version`,
    );
    if (remoteVersion === VERSION) {
      return remoteBinaryPath;
    }
  } catch {
    // pincer doesn't exist yet
  }

  // Resolve local binary (dev build or download from GitHub Releases)
  const localPath = await resolvePincerBinary(goArch);

  // Kill stale pincer processes (separate exec so pkill doesn't match the shell running our commands)
  try {
    await execCommand(conn, `pkill -x pincer 2>/dev/null || true`);
  } catch {
    // Ignore — no matching process is fine
  }

  // Remove old binary (can't overwrite a running executable on Linux) and ensure directory exists
  await execCommand(conn, `mkdir -p ${remoteHome}/${REMOTE_DIR} && rm -f ${remoteBinaryPath}`);

  // Upload binary via SFTP
  const sftp = await getSftp(conn);

  await new Promise<void>((resolve, reject) => {
    sftp.fastPut(localPath, remoteBinaryPath, (err) => {
      if (err) reject(new Error(`SFTP upload failed: ${err.message}`));
      else resolve();
    });
  });

  sftp.end();

  // Make executable
  await execCommand(conn, `chmod +x ${remoteBinaryPath}`);

  return remoteBinaryPath;
}
