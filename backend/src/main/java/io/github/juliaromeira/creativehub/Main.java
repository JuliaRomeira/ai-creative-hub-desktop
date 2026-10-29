package io.github.juliaromeira.creativehub;

import com.google.gson.*;
import io.github.juliaromeira.creativehub.persistence.WorkspaceRepository;
import io.github.juliaromeira.creativehub.service.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;

/** Um pedido JSON por linha no stdin, uma resposta no stdout. Nenhuma porta aberta. */
public final class Main {
  public static void main(String[] args) throws Exception {
    if (args.length != 1) throw new IllegalArgumentException("Informe a pasta de dados.");
    try (WorkspaceRepository repository = new WorkspaceRepository(Path.of(args[0]));
        BufferedReader input =
            new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        PrintWriter output =
            new PrintWriter(new OutputStreamWriter(System.out, StandardCharsets.UTF_8), true)) {
      WorkspaceService service = new WorkspaceService(repository);
      String line;
      while ((line = input.readLine()) != null) {
        JsonObject response = new JsonObject();
        try {
          JsonObject request = WorkspaceRepository.JSON.fromJson(line, JsonObject.class);
          response.add("id", request.get("id"));
          JsonObject params = request.getAsJsonObject("params");
          String method = WorkspaceService.string(request, "method");
          Object result =
              switch (method) {
                case "health" -> "ready";
                case "read" -> repository.read();
                case "update" ->
                    service.update(
                        WorkspaceService.string(params, "type"), params.getAsJsonObject("input"));
                case "context" ->
                    new ContextService()
                        .prepare(
                            repository.read(),
                            WorkspaceService.string(params, "clientId"),
                            WorkspaceService.string(params, "campaignId"));
                case "attach" ->
                    service.addReferences(
                        WorkspaceService.string(params, "clientId"),
                        List.of(
                            WorkspaceRepository.JSON.fromJson(
                                params.get("files"), String[].class)));
                case "reference-name" ->
                    service.reference(WorkspaceService.string(params, "id")).name();
                case "save-reference" -> {
                  service.saveReference(WorkspaceService.string(params, "id"), path(params));
                  yield true;
                }
                case "export" -> {
                  repository.exportBackup(path(params));
                  yield true;
                }
                case "validate-backup" -> {
                  repository.readFile(path(params));
                  yield true;
                }
                case "import" -> repository.restore(path(params));
                default -> throw new IllegalArgumentException("Operação desconhecida.");
              };
          response.addProperty("ok", true);
          response.add("value", WorkspaceRepository.JSON.toJsonTree(result));
        } catch (Exception error) {
          response.addProperty("ok", false);
          response.addProperty(
              "error",
              error.getMessage() == null
                  ? "Não foi possível concluir a operação."
                  : error.getMessage());
        }
        output.println(WorkspaceRepository.JSON.toJson(response));
        if (output.checkError()) break;
      }
    }
  }

  private static Path path(JsonObject params) {
    return Path.of(WorkspaceService.string(params, "path"));
  }
}
