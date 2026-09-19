// One-time setup for development: a Python environment (.venv) with the backend's and the
// AI service's packages, plus the frontend's npm packages.
// Usage, from the repo root:  npm run setup
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const windows = process.platform === "win32";
const venvPython = path.join(root, ".venv", windows ? "Scripts" : "bin", windows ? "python.exe" : "python");

function run(command, args, options = {}) {
  console.log(`\n> ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", cwd: root, ...options });
  if (result.status !== 0) {
    console.error(`\nSetup stopped: "${command} ${args.join(" ")}" failed.`);
    process.exit(1);
  }
}

function findPython() {
  for (const candidate of windows ? ["python", "py"] : ["python3", "python"]) {
    const result = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    if (result.status === 0) return candidate;
  }
  console.error("Python wasn't found. Install Python 3.10 or newer, then run npm run setup again.");
  process.exit(1);
}

if (!existsSync(venvPython)) run(findPython(), ["-m", "venv", ".venv"]);
run(venvPython, ["-m", "pip", "install", "-r", "requirements.txt", "-r", "ai-service/requirements.txt"]);
// npm is a .cmd file on Windows, which Node can only start through the shell.
run("npm", ["install"], { cwd: path.join(root, "frontend"), shell: windows });

console.log('\nSetup done. Start everything with: npm run dev');
