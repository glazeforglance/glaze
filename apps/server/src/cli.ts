import { runHashPassword } from "./hash-password.ts";

// Entry for `pnpm --filter server hash-password` (dist/cli.js in production).
process.exitCode = await runHashPassword();
