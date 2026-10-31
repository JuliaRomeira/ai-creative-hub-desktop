// NSIS does not forward the child's stderr. Relay inspector discovery for Playwright.
const net = require("node:net");
const { spawn } = require("node:child_process");

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function endpoint(port, route) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/${route}`);
      const data = await response.json();
      const url = (Array.isArray(data) ? data[0] : data).webSocketDebuggerUrl;
      if (url) return url;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Portable inspector did not start on port ${port}.`);
}

(async () => {
  const inspect = await freePort();
  const chrome = await freePort();
  const child = spawn(
    process.env.AICH_EXECUTABLE,
    [`--inspect=127.0.0.1:${inspect}`, `--remote-debugging-port=${chrome}`],
    { stdio: "ignore", windowsHide: true },
  );
  child.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });
  child.on("exit", (code) => process.exit(code ?? 1));
  console.error(
    `Debugger listening on ${await endpoint(inspect, "json/list")}`,
  );
  console.error(
    `DevTools listening on ${await endpoint(chrome, "json/version")}`,
  );
  // Electron waits for its Node inspector to detach after Chromium closes.
  const monitor = setInterval(async () => {
    try {
      await fetch(`http://127.0.0.1:${chrome}/json/version`, {
        signal: AbortSignal.timeout(1000),
      });
    } catch {
      clearInterval(monitor);
      console.error("Waiting for the debugger to disconnect...");
    }
  }, 200);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
