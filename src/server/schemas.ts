import { z } from "zod";

export const bashSchema = {
  host: z.string().describe("Machine name to run the command on"),
  command: z.string().describe("Bash command to execute"),
  timeout: z
    .number()
    .optional()
    .describe("Timeout in milliseconds (default: 120000)"),
};

export const readSchema = {
  host: z.string().describe("Machine name to read from"),
  path: z.string().describe("Absolute path to the file to read"),
  offset: z
    .number()
    .optional()
    .describe("Line number to start reading from (0-indexed)"),
  limit: z.number().optional().describe("Number of lines to read"),
};

export const writeSchema = {
  host: z.string().describe("Machine name to write to"),
  path: z.string().describe("Absolute path to the file to write"),
  content: z.string().describe("Content to write to the file"),
};

export const editSchema = {
  host: z.string().describe("Machine name to edit on"),
  path: z.string().describe("Absolute path to the file to edit"),
  old_string: z.string().describe("The exact text to find and replace (must be unique in the file)"),
  new_string: z.string().describe("The replacement text"),
};

export const grepSchema = {
  host: z.string().describe("Machine name to search on"),
  pattern: z.string().describe("Regex pattern to search for"),
  path: z
    .string()
    .optional()
    .describe("Directory to search in (default: cwd)"),
  include: z
    .string()
    .optional()
    .describe("Glob pattern to filter files (e.g. '*.ts')"),
};

export const globSchema = {
  host: z.string().describe("Machine name to search on"),
  pattern: z.string().describe("Glob pattern to match files"),
};

export const lsSchema = {
  host: z.string().describe("Machine name to list on"),
  path: z.string().describe("Directory path to list"),
};

export const machinesSchema = {
  action: z
    .enum(["list", "add", "remove", "update"])
    .describe("Action to perform"),
  name: z
    .string()
    .optional()
    .describe("Machine name (required for add/remove/update)"),
  host: z
    .string()
    .optional()
    .describe("SSH hostname or IP address (required for add)"),
  user: z.string().optional().describe("SSH user (default: current user)"),
  port: z.number().optional().describe("SSH port (default: 22)"),
  identityFile: z
    .string()
    .optional()
    .describe("Path to SSH private key file (e.g. ~/.ssh/id_rsa). Defaults to ~/.ssh/id_ed25519, id_rsa, or id_ecdsa"),
};
