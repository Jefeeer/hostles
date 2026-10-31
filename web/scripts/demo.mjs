// `pnpm demo`: run the app on localhost with an in-memory demo database.
import { spawn } from "node:child_process";

const port = String(Number(process.env.PORT) || 3000);
// One command string: on Windows pnpm is a .cmd shim, which needs a shell.
const child = spawn(`pnpm exec next dev -p ${port}`, {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DEMO_MODE: "1" },
});
child.on("exit", (code) => process.exit(code ?? 0));
