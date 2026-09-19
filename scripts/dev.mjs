// Starts the whole TRAC stack for development in one terminal:
// the AI service (port 8001), the backend (port 8000) and the frontend (port 3000).
// Usage, from the repo root:  npm run dev   (Ctrl+C stops everything)
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const windows = process.platform === "win32";
const python = path.join(root, ".venv", windows ? "Scripts" : "bin", windows ? "python.exe" : "python");
const nextBin = path.join(root, "frontend", "node_modules", "next", "dist", "bin", "next");

for (const [file, what] of [
  [python, "The Python environment (.venv)"],
  [nextBin, "The frontend's packages"],
]) {
  if (!existsSync(file)) {
    console.error(`${what} isn't set up yet. Run "npm run setup" first.`);
    process.exit(1);
  }
}

const services = [
  {
    name: "ai",
    color: 35,
    cwd: path.join(root, "ai-service"),
    command: python,
    args: ["-m", "uvicorn", "service:app", "--port", "8001", "--reload"],
  },
  {
    name: "api",
    color: 34,
    cwd: root,
    command: python,
    args: ["-m", "uvicorn", "backend.main:app", "--port", "8000", "--reload", "--reload-dir", "backend"],
  },
  {
    name: "web",
    color: 32,
    cwd: path.join(root, "frontend"),
    command: process.execPath,
    args: [nextBin, "dev", "--port", "3000"],
  },
];

console.log("Starting TRAC: AI service :8001, backend :8000, frontend http://localhost:3000 (Ctrl+C to stop)\n");

const children = services.map(({ name, color, cwd, command, args }) => {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, FORCE_COLOR: "1", PYTHONUNBUFFERED: "1" },
  });
  const prefix = `\x1b[${color}m${name.padEnd(3)} |\x1b[0m `;
  for (const stream of [child.stdout, child.stderr]) {
    let partial = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      const lines = (partial + chunk).split(/\r?\n/);
      partial = lines.pop();
      for (const line of lines) process.stdout.write(prefix + line + "\n");
    });
  }
  child.on("exit", (code) => {
    process.stdout.write(`${prefix}stopped${code ? ` (exit code ${code})` : ""}\n`);
    if (children.every((c) => c.exitCode !== null || c.signalCode !== null)) process.exit(0);
  });
  return child;
});

// Ctrl+C reaches every program in this terminal, so the services shut themselves down.
// Anything still running a few seconds later is stopped.
function stopEverything(forward) {
  if (forward) for (const child of children) child.kill();
  setTimeout(() => {
    for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill();
    process.exit(0);
  }, 5000).unref();
}

process.on("SIGINT", () => stopEverything(false));
process.on("SIGTERM", () => stopEverything(true));
