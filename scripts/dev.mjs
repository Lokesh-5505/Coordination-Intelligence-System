import { spawn } from "node:child_process";
import process from "node:process";
import net from "node:net";

const childSpecs = [
  ["@workspace/api-server", "API"],
  ["@workspace/coordination-intelligence", "Frontend"],
];

const requiredPorts = [3000, 5000];

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "localhost" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(true);
    });
  });
}

const unavailablePorts = [];
for (const port of requiredPorts) {
  if (!(await isPortAvailable(port))) unavailablePorts.push(port);
}

if (unavailablePorts.length) {
  console.error(
    `Development stack is already running or another process owns port${unavailablePorts.length > 1 ? "s" : ""} ${unavailablePorts.join(", ")}. Stop the existing project session before running npm run dev again.`,
  );
  process.exit(1);
}

const children = childSpecs.map(([filter, label]) => {
  const command = process.platform === "win32" ? "cmd.exe" : "pnpm";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", `pnpm --filter ${filter} run dev`]
      : ["--filter", filter, "run", "dev"];
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    windowsHide: false,
  });

  child.on("error", (error) => {
    console.error(`[${label}] failed to start: ${error.message}`);
  });
  child.on("exit", (code, signal) => {
    if (!shuttingDown && code !== 0) {
      console.error(
        `[${label}] exited with code ${code ?? "unknown"}${signal ? ` (${signal})` : ""}`,
      );
      shutdown(code || 1);
    }
  });

  return child;
});

let shuttingDown = false;

function killProcessTree(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else {
    child.kill("SIGTERM");
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  children.forEach(killProcessTree);
  setTimeout(() => process.exit(code), 250);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("exit", () => children.forEach(killProcessTree));
