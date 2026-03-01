import fs from "node:fs";
import path from "node:path";
import type { Client, SFTPWrapper } from "ssh2";

const REMOTE_DIR = ".claw";
const REMOTE_BINARY_REL = `${REMOTE_DIR}/pincer`;

function findPincerBinDir(): string {
  // Walk up from this file's location to find pincer-bin/
  // Works both in dev (src/) and built (dist/) contexts
  let dir = path.dirname(new URL(import.meta.url).pathname);
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, "pincer-bin");
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  // Fallback: look relative to cwd
  const cwdCandidate = path.join(process.cwd(), "pincer-bin");
  if (fs.existsSync(cwdCandidate)) return cwdCandidate;
  throw new Error("Cannot find pincer-bin/ directory");
}

function getPincerPath(arch: string): string {
  const archMap: Record<string, string> = {
    x86_64: "amd64",
    aarch64: "arm64",
    arm64: "arm64",
  };
  const goArch = archMap[arch] ?? "amd64";
  return path.join(findPincerBinDir(), `pincer-linux-${goArch}`);
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

  const remoteBinaryPath = `${remoteHome}/${REMOTE_BINARY_REL}`;

  // Check if pincer already exists and get its version
  let remoteVersion = "";
  try {
    remoteVersion = await execCommand(conn, `${remoteBinaryPath} --version`);
  } catch {
    // pincer doesn't exist yet
  }

  // Check local pincer binary exists
  const localPath = getPincerPath(arch);
  if (!fs.existsSync(localPath)) {
    throw new Error(
      `Pincer binary not found at ${localPath}. Run 'npm run build-pincer' first.`,
    );
  }

  // Skip deploy if already present (TODO: version comparison)
  if (remoteVersion) {
    return remoteBinaryPath;
  }

  // Create remote directory
  await execCommand(conn, `mkdir -p ${remoteHome}/${REMOTE_DIR}`);

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
