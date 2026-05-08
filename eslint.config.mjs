import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "**/.next/**",
    "out/**",
    "build/**",
    "dist/**",
    "next-env.d.ts",
    "node_modules/**",
    "**/node_modules/**",
    ".claude/**",
    ".cursor/**",
    ".firecrawl/**",
    ".playwright-mcp/**",
    "_skills/**",
    "madison-image-pipeline-diagnostic/**",
    "pipeline/**",
    // Root-level CJS utility scripts not part of the Next.js app
    "format_json.js",
    "scripts/**",
    "clear_loop.mjs",
  ]),
  {
    files: ["convex/**/*.ts", "tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);

export default eslintConfig;
