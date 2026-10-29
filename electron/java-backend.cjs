const { spawn } = require("node:child_process");
const path = require("node:path");

/** Transporte apenas. As regras, os arquivos e o contexto pertencem ao Java. */
class JavaBackend {
  constructor(folder, jar, options = {}) {
    this.pending = new Map();
    this.nextId = 0;
    this.closed = false;
    this.buffer = "";
    const java =
      options.java ||
      (process.env.JAVA_HOME
        ? path.join(
            process.env.JAVA_HOME,
            "bin",
            process.platform === "win32" ? "java.exe" : "java",
          )
        : "java");
    this.child = spawn(
      java,
      ["-Xmx512m", "-Dfile.encoding=UTF-8", "-jar", jar, folder],
      {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    this.diagnostic = "";
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk) => {
      this.diagnostic = (this.diagnostic + chunk).slice(-4000);
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => {
      this.buffer += chunk;
      if (this.buffer.length > 150 * 1024 * 1024)
        return this.fail(new Error("Resposta Java acima do limite."));
      let end;
      while ((end = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, end);
        this.buffer = this.buffer.slice(end + 1);
        try {
          const response = JSON.parse(line);
          const request = this.pending.get(response.id);
          if (!request) continue;
          this.pending.delete(response.id);
          clearTimeout(request.timer);
          if (response.ok) request.resolve(response.value);
          else request.reject(new Error(response.error));
        } catch {
          this.fail(
            new Error(
              "Resposta inválida do Java. Feche e reabra o aplicativo.",
            ),
          );
        }
      }
    });
    this.child.on("error", () =>
      this.fail(
        new Error(
          "Não foi possível iniciar o Java. Instale Java 17 ou superior e confira JAVA_HOME ou PATH.",
        ),
      ),
    );
    this.child.stdin.on("error", () =>
      this.fail(
        new Error(
          "A comunicação com o Java foi interrompida. Reabra o aplicativo.",
        ),
      ),
    );
    this.child.on("exit", () =>
      this.fail(
        new Error(
          "O back-end Java foi encerrado. Confira Java 17 ou superior, feche outras instâncias e reabra o aplicativo." +
            (this.diagnostic.includes("UnsupportedClassVersionError")
              ? " A versão instalada do Java é antiga."
              : ""),
        ),
      ),
    );
  }
  request(method, params = {}) {
    if (this.closed)
      return Promise.reject(
        new Error(
          "O back-end Java está indisponível. Feche e reabra o aplicativo.",
        ),
      );
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () =>
          this.fail(
            new Error(
              "O Java não respondeu no prazo. Reabra o aplicativo e confira o estado dos dados antes de repetir a operação.",
            ),
          ),
        60000,
      );
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ id, method, params }) + "\n");
    });
  }
  fail(error) {
    if (this.closed) return;
    this.closed = true;
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
    this.child.kill();
  }
  async close() {
    if (this.closed) return;
    // EOF permite ao Java terminar uma gravação em andamento e liberar o lock.
    this.child.stdin.end();
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.child.kill();
        resolve();
      }, 5000);
      this.child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
}
module.exports = { JavaBackend };
