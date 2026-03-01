import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "bin/claw.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  splitting: true,
  sourcemap: true,
  dts: true,
  banner: {
    js: "// @opsyhq/claw - MCP server for remote machine access",
  },
});
