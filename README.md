<p align="center">
  <h1 align="center">🦞 Claw</h1>
  <p align="center"><strong>Your agent's claw on every machine.</strong></p>
  <p align="center">
    An MCP server that lets any AI agent work across remote machines —<br/>
    bash, read, write, edit, grep, and glob — over SSH.
  </p>
  <p align="center">
    Built by <a href="https://github.com/opsyhq">OpsyHQ</a>
  </p>
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#tools">Tools</a> ·
  <a href="#configuration">Configuration</a>
</p>

---

## Why

AI agents can write code, but they're stuck on one machine. They can't check logs on prod, grep for errors across services, or edit a config on staging.

Claw gives your agent the same tools it already knows — bash, read, write, edit, grep, glob — on any machine you can SSH into.

```
You: "Check why the API is returning 500s on prod, look at the logs, and fix the nginx config"

Agent: connects to prod-api via SSH
       greps /var/log/nginx/error.log for errors
       reads the nginx config
       edits the misconfigured upstream block
       runs nginx -t && systemctl reload nginx

Done. Across machines. Autonomously.
```

## Quickstart

### 1. Add your machines

```bash
# Import from your SSH config
npx @opsyhq/claw init --from-ssh

# Or add manually
npx @opsyhq/claw add prod-api --ssh user@prod-api.example.com
npx @opsyhq/claw add staging --ssh user@staging.example.com
npx @opsyhq/claw add local --local
```

### 2. Connect to your agent

<details>
<summary><strong>Claude Code</strong></summary>

```bash
npx @opsyhq/claw install claude-code
```

Or add manually to `.claude/settings.json`:
```json
{
  "mcpServers": {
    "claw": {
      "command": "npx",
      "args": ["@opsyhq/claw", "serve"]
    }
  }
}
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
      "args": ["@opsyhq/claw", "serve"]
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
      "args": ["@opsyhq/claw", "serve"]
    }
  }
}
```
</details>

<details>
<summary><strong>OpenClaw</strong></summary>

Add to `openclaw.json`:
```json
{
  "mcp": {
    "servers": [
      {
        "name": "claw",
        "command": "npx",
        "args": ["@opsyhq/claw", "serve"]
      }
    ]
  }
}
```
</details>

<details>
<summary><strong>Any MCP client</strong></summary>

```bash
npx @opsyhq/claw serve
# Starts MCP server on stdio
```
</details>

### 3. Go

Talk to your agent. It now has claws on every machine you configured.

```
"Show me running containers on prod-api"
"Grep for 'connection refused' in the logs on staging"
"Find all .env files across prod-api and staging"
"Edit the upstream block in nginx.conf on prod-api"
```

## How it works

```
┌──────────────────────────────────────────┐
│  AI Agent (Claude Code, Cursor, etc.)    │
│       ↓ MCP tool calls                   │
├──────────────────────────────────────────┤
│  Claw (runs locally)                     │
│                                          │
│  ┌────────────┐  ┌───────────────────┐   │
│  │ Tool Router │  │ Connection Pool   │   │
│  └─────┬──────┘  └────────┬──────────┘   │
│        └──────────┬───────┘              │
│           ┌───────┴────────┐             │
│           │ SSH │ │ Local  │             │
│           └──┬──┘ └───┬───┘             │
└──────────────┼────────┼─────────────────┘
               ▼        ▼
           ┌──────┐ ┌──────┐
           │ prod │ │ your │
           │ api  │ │ mac  │
           └──────┘ └──────┘
```

On first connect, Claw deploys a small static binary (`claw-agent`) to the remote host. This binary speaks JSON-RPC over stdin/stdout and handles all tool execution — structured file editing, safe command handling, grep with regex support.

Connections are persistent. No reconnecting per command.

No ports to open. No daemons. No root required.

## Tools

Claw exposes 8 MCP tools. The agent discovers machines with `claw_list_machines`, then targets any machine by name.

These match the tools agents already know from local development (Claude Code's Read/Write/Edit/Bash/Grep/Glob/LS) — just extended to remote machines.

| Tool | What it does | Example |
|------|-------------|---------|
| **claw_list_machines** | Discover available machines | `claw_list_machines()` |
| **claw_bash** | Run a shell command | `claw_bash(host: "prod", command: "docker ps")` |
| **claw_read** | Read a file (with optional line range) | `claw_read(host: "prod", path: "/var/log/app.log", offset: 0, limit: 100)` |
| **claw_write** | Create or overwrite a file | `claw_write(host: "staging", path: "/app/config.yaml", content: "...")` |
| **claw_edit** | Find-and-replace in a file | `claw_edit(host: "staging", path: "/app/config.yaml", old: "port: 80", new: "port: 8080")` |
| **claw_grep** | Search file contents with regex | `claw_grep(host: "prod", pattern: "error\|timeout", path: "/var/log", include: "*.log")` |
| **claw_glob** | Find files by pattern | `claw_glob(host: "prod", pattern: "/app/src/**/*.ts")` |
| **claw_ls** | List directory contents | `claw_ls(host: "staging", path: "/app")` |

### Discovery

The agent's first call is typically `claw_list_machines`:

```json
→ claw_list_machines()
← [
    { "name": "prod-api", "transport": "ssh", "host": "prod-api.example.com", "status": "available" },
    { "name": "staging", "transport": "ssh", "host": "staging.example.com", "status": "connected" },
    { "name": "local", "transport": "local", "status": "connected" }
  ]
```

From there, the agent knows what's available and can target any machine by name in subsequent tool calls.

## Configuration

### Global config

`~/.config/claw/machines.yaml`

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

### Project config

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
- **No open ports** — All connections are outbound from your machine.
- **No persistence** — The remote binary only runs during your session.
- **Audit log** — Every tool call is logged to `~/.config/claw/logs/`.
- **Want guardrails?** — For approval workflows and policy enforcement on remote operations, check out [Opsy](https://github.com/opsyhq/opsy).

## Roadmap

- [x] SSH transport
- [x] Local transport
- [ ] Docker transport
- [ ] Kubernetes transport
- [ ] AWS SSM transport
- [ ] Companion Agent Skill

---

<p align="center">
  <a href="https://github.com/opsyhq"><strong>OpsyHQ</strong></a> · Your agent's claw on every machine. 🦞
</p>

## License

MIT
