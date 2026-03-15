const HELP: Record<string, string> = {
  root: `claw — your agent's claw on every machine

Commands:
  bash       Run a shell command
  read       Read a file (with optional line range)
  write      Write content to a file (content via stdin)
  edit       Find-and-replace in a file (payload via stdin)
  grep       Search file contents with regex
  glob       Find files matching a glob pattern
  ls         List directory contents
  machines   Manage configured machines

Usage:
  claw("bash host=myserver", stdin="docker ps")
  claw("read host=myserver path=/etc/hosts")
  claw("machines list")
  claw("<command> --help")`,

  bash: `bash — Run a shell command

Params:
  host       Machine name (required)
  timeout    Timeout in ms (default: 120000)

The shell command goes in stdin.

Example:
  claw("bash host=prod", stdin="docker ps | grep nginx")`,

  read: `read — Read a file

Params:
  host       Machine name (required)
  path       Absolute file path (required)
  offset     Start line, 0-indexed (optional)
  limit      Number of lines to read (optional)

Example:
  claw("read host=prod path=/etc/hosts")
  claw("read host=prod path=/var/log/app.log offset=100 limit=50")`,

  write: `write — Write content to a file

Params:
  host       Machine name (required)
  path       Absolute file path (required)

File content goes in stdin.

Example:
  claw("write host=prod path=/tmp/config.yaml", stdin="key: value\\nother: 123")`,

  edit: `edit — Find and replace text in a file

Params:
  host       Machine name (required)
  path       Absolute file path (required)

stdin must be JSON with old_string and new_string:
  {"old_string": "text to find", "new_string": "replacement"}

The old_string must be unique in the file.

Example:
  claw("edit host=prod path=/etc/hosts", stdin='{"old_string":"old","new_string":"new"}')`,

  grep: `grep — Search file contents with regex

Params:
  host       Machine name (required)
  pattern    Regex pattern (required)
  path       Directory to search in (default: cwd)
  include    Glob filter for files (e.g. "*.ts")

Example:
  claw("grep host=prod pattern='ERROR' path=/var/log include='*.log'")`,

  glob: `glob — Find files matching a glob pattern

Params:
  host       Machine name (required)
  pattern    Glob pattern (required)

Example:
  claw("glob host=prod pattern='**/*.ts'")`,

  ls: `ls — List directory contents

Params:
  host       Machine name (required)
  path       Directory path (required)

Example:
  claw("ls host=prod path=/var/log")`,

  machines: `machines — Manage configured machines

Actions:
  list       List all machines
  add        Add a new machine
  remove     Remove a machine
  update     Update machine config

Usage:
  claw("machines <action> [params...]")
  claw("machines <action> --help")`,

  "machines.list": `machines list — List all configured machines

No additional params.

Example:
  claw("machines list")`,

  "machines.add": `machines add — Add a new SSH machine

Params:
  name           Machine name (required)
  host           SSH hostname or IP (required)
  user           SSH user (default: current user)
  port           SSH port (default: 22)
  identityFile   Path to SSH private key

Example:
  claw("machines add name=prod host=10.0.0.1 user=deploy")`,

  "machines.remove": `machines remove — Remove a machine

Params:
  name       Machine name (required)

Example:
  claw("machines remove name=prod")`,

  "machines.update": `machines update — Update a machine

Params:
  name           Machine name (required)
  host           New hostname (optional)
  user           New user (optional)
  port           New port (optional)
  identityFile   New identity file (optional)

Example:
  claw("machines update name=prod host=10.0.0.2")`,
};

export function getHelp(command: string, action?: string): string {
  if (!command) return HELP.root;
  const key = action ? `${command}.${action}` : command;
  return (
    HELP[key] ??
    `Unknown command: "${command}". Run claw("--help") for available commands.`
  );
}
