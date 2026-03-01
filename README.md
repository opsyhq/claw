<p align="center">
  <h1 align="center">🦞 Claw</h1>
  <p align="center"><strong>Your agent's claw on every machine.</strong></p>
  <p align="center">
    Give any AI agent bash, read, write, edit, grep, and glob<br/>
    on any machine you can SSH into.
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@opsyhq/claw"><img src="https://img.shields.io/npm/v/@opsyhq/claw" alt="npm version"></a>
  <a href="https://github.com/opsyhq/claw/blob/main/LICENSE"><img src="https://img.shields.io/github/license/opsyhq/claw" alt="license"></a>
  <a href="https://github.com/opsyhq/claw/actions/workflows/release.yml"><img src="https://github.com/opsyhq/claw/actions/workflows/release.yml/badge.svg" alt="build"></a>
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#tools">Tools</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#cli-reference">CLI</a>
</p>

---

AI agents can write code, but they're stuck on one machine. They can't check logs on prod, grep for errors across services, or edit a config on staging.

**Claw is an [MCP server](https://modelcontextprotocol.io) that extends your agent's tools to any remote machine.** 9 tools. Any host you can SSH into. Zero config on the remote.

```
You: "Check why the API is returning 500s on prod, look at the logs, and fix the nginx config"

Agent: connects to prod-api via SSH
       greps /var/log/nginx/error.log for errors
       reads the nginx config
       edits the misconfigured upstream block
       runs nginx -t && systemctl reload nginx

Done. Across machines. Autonomously.
```

> **No ports to open. No daemons. No root required.**
> Claw uses your SSH keys, deploys a tiny binary on first connect, and cleans up after itself.

## Quickstart

### 1. Install

```bash
npx -y @opsyhq/claw serve
# or install globally
npm install -g @opsyhq/claw
```

### 2. Connect to your agent

<details open>
<summary><strong>Claude Code</strong></summary>

```bash
claude mcp add claw -- npx -y @opsyhq/claw serve
```

Or run the installer:
```bash
npx -y @opsyhq/claw install claude-code
```
</details>

<details>
<summary><strong>Cursor</strong></summary>

Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "claw": {
      "command": "npx",
      "args": ["-y", "@opsyhq/claw", "serve"]
    }
  }
}
```
</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "claw": {
      "command": "npx",
      "args": ["-y", "@opsyhq/claw", "serve"]
    }
  }
}
```
</details>

<details>
<summary><strong>Any MCP client</strong></summary>

```bash
npx -y @opsyhq/claw serve
# Speaks MCP over stdio
```
</details>

### 3. Add your machines

The agent can add machines itself via the `claw_add_machine` tool, or you can set them up ahead of time:

```bash
# Import from your SSH config
claw init --from-ssh

# Or add manually
claw add prod-api --ssh deploy@prod-api.example.com
claw add staging --ssh deploy@staging.example.com
```

### 4. Go

Talk to your agent. It now has claws on every machine you configured.

```
"Show me running containers on prod-api"
"Grep for 'connection refused' in the logs on staging"
"Find all .env files across prod-api and staging"
"Edit the upstream block in nginx.conf on prod-api"
```

## How it works

```
┌─────────────────────────────────────┐
│  AI Agent (Claude, Cursor, etc.)    │
│       ↓ MCP tool calls              │
├─────────────────────────────────────┤
│  Claw (runs locally)               │
│                                     │
│  ┌─────────────┐ ┌───────────────┐  │
│  │ Tool Router  │ │ Conn Pool     │  │
│  └──────┬──────┘ └──────┬────────┘  │
│         └───────┬───────┘           │
│          ┌──────┴───────┐           │
│          │ SSH  │ Local  │           │
│          └──┬───┘───┬───┘           │
└─────────────┼───────┼──────────────┘
              ▼       ▼
          ┌──────┐ ┌──────┐
          │ prod │ │ your │
          │ api  │ │ mac  │
          └──────┘ └──────┘
```

On first connect, Claw auto-deploys a small static binary ([pincer](pincer/)) to `~/.claw/pincer` on the remote host. Pincer speaks JSON-RPC over stdin/stdout and handles all tool execution — structured file editing, safe command handling, grep with regex support.

Connections are persistent and pooled. No reconnecting per command.

## Tools

Claw exposes 9 MCP tools. These match the tools agents already know from local development (Claude Code's Read/Write/Edit/Bash/Grep/Glob/LS) — just extended to remote machines.

| Tool | Description |
|------|-------------|
| **claw_list_machines** | Discover available machines and their status |
| **claw_add_machine** | Add a new SSH machine on the fly |
| **claw_bash** | Run a shell command |
| **claw_read** | Read a file with optional line range |
| **claw_write** | Create or overwrite a file |
| **claw_edit** | Find-and-replace in a file |
| **claw_grep** | Search file contents with regex |
| **claw_glob** | Find files by pattern |
| **claw_ls** | List directory contents |

Every tool takes a `host` parameter — the machine name to target.

```
claw_bash(host: "prod-api", command: "docker ps")
claw_grep(host: "prod-api", pattern: "error|timeout", path: "/var/log", include: "*.log")
claw_edit(host: "staging", path: "/app/config.yaml", old_string: "port: 80", new_string: "port: 8080")
```

## Configuration

### Global config — `~/.config/claw/machines.yaml`

```yaml
machines:
  prod-api:
    transport: ssh
    host: prod-api.example.com
    user: deploy

  staging:
    transport: ssh
    host: staging.example.com
    user: deploy

  local:
    transport: local
```

SSH transport uses your existing `~/.ssh/config` automatically — keys, ports, jump hosts all just work.

### Project config — `claw.yaml`

Drop a `claw.yaml` in your project root:

```yaml
machines:
  dev:
    transport: local

  staging:
    transport: ssh
    host: staging.myapp.com
    user: deploy
```

Commit this to your repo. Your whole team gets the same machine setup, each using their own SSH keys.

## Security

- **Your existing access** — Claw uses your SSH keys. It can only reach what you already can.
- **No open ports** — All connections are outbound SSH from your machine.
- **No persistence** — The remote binary only runs during your session.
- **Audit log** — Every tool call is logged to `~/.config/claw/logs/`.
- **Want guardrails?** — For approval workflows and policy enforcement on remote operations, check out [Opsy](https://opsy.sh).

## CLI Reference

```bash
claw serve                # Start MCP server (stdio)
claw init --from-ssh      # Import machines from ~/.ssh/config
claw add <name> --ssh user@host   # Add a remote machine
claw add <name> --local           # Add local machine
claw install claude-code  # Write MCP config for Claude Code
claw install cursor       # Write MCP config for Cursor
```

## Roadmap

- [x] SSH transport
- [x] Local transport
- [x] Runtime binary download from GitHub Releases
- [x] npm trusted publishing (OIDC)
- [ ] Docker transport
- [ ] Kubernetes transport
- [ ] AWS SSM transport

## Contributing

PRs welcome. See the [development guide](#development) to get started.

<details>
<summary><strong>Development</strong></summary>

```bash
npm install         # Install dependencies
npm run build       # Build TypeScript
npm run typecheck   # Type-check without emitting
npm run build-pincer # Cross-compile pincer (requires Go)
npm run dev         # Watch mode
```

**Project structure:**
```
claw/
├── bin/claw.ts              # CLI entrypoint
├── src/
│   ├── cli/                 # CLI commands (serve, init, add, install)
│   ├── config/              # YAML config loading + SSH config parser
│   ├── server/              # MCP server, tool schemas, router
│   ├── tools/               # Local tool implementations
│   ├── transports/          # Transport layer (local, SSH, pool, deployer)
│   └── logging/             # Audit log
├── pincer/                  # Go binary deployed to remote hosts
│   ├── main.go              # JSON-RPC stdin/stdout server
│   ├── rpc/                 # Request dispatcher
│   └── tools/               # Tool implementations in Go
└── scripts/build-pincer.sh  # Cross-compile for linux/amd64+arm64
```
</details>

---

<p align="center">
  Built by <a href="https://github.com/opsyhq"><strong>OpsyHQ</strong></a> · MIT License<br/>
  Claw icon by <a href="https://game-icons.net">Lorc / Game Icons</a> (CC BY 3.0)
</p>
