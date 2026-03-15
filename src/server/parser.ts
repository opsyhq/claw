export interface ParsedCommand {
  command: string;
  action?: string;
  params: Record<string, string>;
  help: boolean;
}

const COMMANDS_WITH_ACTIONS = new Set(["machines"]);

export function parseCommand(input: string): ParsedCommand {
  const tokens = tokenize(input.trim());

  let help = false;
  const positional: string[] = [];
  const params: Record<string, string> = {};

  for (const token of tokens) {
    if (token === "--help" || token === "-h") {
      help = true;
      continue;
    }

    const eqIdx = token.indexOf("=");
    if (eqIdx > 0) {
      params[token.slice(0, eqIdx)] = token.slice(eqIdx + 1);
    } else {
      positional.push(token);
    }
  }

  const command = positional[0] || "";
  const action =
    COMMANDS_WITH_ACTIONS.has(command) && positional.length > 1
      ? positional[1]
      : undefined;

  return { command, action, params, help };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: string | null = null;

  for (const ch of input) {
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === " " || ch === "\t") {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }

  if (current) tokens.push(current);
  return tokens;
}
