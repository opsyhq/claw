import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Client, SFTPWrapper } from "ssh2";

const REMOTE_DIR = ".claw";
const REMOTE_BINARY = `${REMOTE_DIR}/pincer`;
const LOCAL_PINCER_DIR = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "..",
  "pincer-bin",
);

function getPincerPath(arch: string): string {
  const archMap: Record<string, string> = {
    x86_64: "amd64",
    aarch64: "arm64",
    arm64: "arm64",
  };
  const goArch = archMap[arch] ?? "amd64";
  return path.join(LOCAL_PINCER_DIR, `pincer-linux-${goArch}`);
}

async function execCommand(
  conn: Client,
  command: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);

      let output = "";
      stream.on("data", (data: Buffer) => {
        output += data.toString();
      });
      stream.stderr.on("data", (data: Buffer) => {
        output += data.toString();
      });
      stream.on("close", () => resolve(output.trim()));
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
  // Detect remote architecture
  const arch = await execCommand(conn, "uname -m");

  // Check if pincer already exists and get its version
  let remoteVersion = "";
  try {
    remoteVersion = await execCommand(conn, `~/${REMOTE_BINARY} --version`);
  } catch {
    // pincer doesn't exist yet
  }

  // Check local pincer version
  const localPath = getPincerPath(arch);
  if (!fs.existsSync(localPath)) {
    throw new Error(
      `Pincer binary not found at ${localPath}. Run 'npm run build-pincer' first.`,
    );
  }

  // TODO: Compare versions properly. For now, deploy if missing.
  if (remoteVersion) {
    return `~/${REMOTE_BINARY}`;
  }

  // Deploy pincer
  const sftp = await getSftp(conn);

  // Create remote directory
  await new Promise<void>((resolve) => {
    sftp.mkdir(`${os.homedir().replace(os.homedir(), "")}${REMOTE_DIR}`, () => {
      // Ignore error if dir exists
      resolve();
    });
  });

  await execCommand(conn, `mkdir -p ~/${REMOTE_DIR}`);

  // Upload binary
  await new Promise<void>((resolve, reject) => {
    sftp.fastPut(localPath, REMOTE_BINARY, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Make executable
  await execCommand(conn, `chmod +x ~/${REMOTE_BINARY}`);

  return `~/${REMOTE_BINARY}`;
}
