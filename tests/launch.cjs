const { _electron: electron, expect } = require("@playwright/test");
const path = require("node:path");
const { spawnSync, execFileSync } = require("node:child_process");

const packaged = !!(
  process.env.AICH_EXECUTABLE || process.env.AICH_DIRECT_EXECUTABLE
);

async function launchApp(profile) {
  const env = {
    ...process.env,
    AICH_TEST_DATA: profile,
    AICH_TEST_NODE: process.execPath,
  };
  for (const key of Object.keys(env)) {
    if (
      /^electron_run_as_node$/i.test(key) ||
      (packaged &&
        /^(path|java_home|jdk_java_options|java_tool_options|_java_options)$/i.test(
          key,
        ))
    )
      delete env[key];
  }
  if (packaged) {
    env.PATH = path.join(process.env.SystemRoot, "System32");
    env.JAVA_HOME = path.join(profile, "java-inexistente");
    const where = spawnSync(path.join(env.PATH, "where.exe"), ["java"], {
      env,
      encoding: "utf8",
    });
    expect(
      where.status,
      "Java externo deve estar indisponível para o aplicativo",
    ).not.toBe(0);
  }
  const app = await electron.launch({
    args: packaged ? [] : ["."],
    executablePath: process.env.AICH_EXECUTABLE
      ? path.join(__dirname, "portable-launch.cmd")
      : process.env.AICH_DIRECT_EXECUTABLE || undefined,
    cwd: path.resolve(__dirname, ".."),
    env,
  });
  if (packaged) {
    try {
      // The main window is created only after the Java health handshake succeeds.
      await app.firstWindow();
      const actual = await app.evaluate(({ app }) => ({
        packaged: app.isPackaged,
        portable: process.env.PORTABLE_EXECUTABLE_FILE,
        resources: process.resourcesPath,
        pid: process.pid,
      }));
      expect(actual.packaged).toBe(true);
      if (process.env.AICH_EXECUTABLE)
        expect(path.resolve(actual.portable).toLowerCase()).toBe(
          path.resolve(process.env.AICH_EXECUTABLE).toLowerCase(),
        );
      const child = execFileSync(
        path.join(env.PATH, "WindowsPowerShell/v1.0/powershell.exe"),
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `Get-CimInstance Win32_Process -Filter 'ParentProcessId = ${actual.pid}' | Where-Object Name -eq 'java.exe' | Select-Object -ExpandProperty ExecutablePath`,
        ],
        { encoding: "utf8", windowsHide: true },
      ).trim();
      expect(child.toLowerCase()).toBe(
        path.join(actual.resources, "runtime/bin/java.exe").toLowerCase(),
      );
    } catch (error) {
      await app.close();
      throw error;
    }
  }
  return app;
}

module.exports = { launchApp, packaged };
