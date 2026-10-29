const { spawnSync } = require("node:child_process");
const path = require("node:path");
// Maven Wrapper baixa a versão fixada apenas na primeira execução.
const windows = process.platform === "win32";
const result = spawnSync(
  windows ? "cmd.exe" : "./mvnw",
  windows
    ? [
        "/d",
        "/c",
        "mvnw.cmd -B -ntp " +
          (process.argv.includes("--test") ? "test" : "-DskipTests package"),
      ]
    : [
        "-B",
        "-ntp",
        ...(process.argv.includes("--test")
          ? ["test"]
          : ["-DskipTests", "package"]),
      ],
  {
    cwd: path.join(__dirname, "../backend"),
    stdio: "inherit",
    windowsHide: true,
  },
);
if (result.error)
  console.error("Não foi possível iniciar Maven/Java:", result.error.message);
process.exit(result.status ?? 1);
