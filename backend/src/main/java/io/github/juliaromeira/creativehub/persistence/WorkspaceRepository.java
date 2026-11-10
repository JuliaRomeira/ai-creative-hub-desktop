package io.github.juliaromeira.creativehub.persistence;

import static java.nio.file.StandardOpenOption.*;

import com.google.gson.*;
import io.github.juliaromeira.creativehub.model.*;
import io.github.juliaromeira.creativehub.service.WorkspaceValidator;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** Acesso ao disco separado das regras de negócio; mantém o formato legado. */
public final class WorkspaceRepository implements AutoCloseable {
  private static final Gson PLAIN_JSON = gson().create();
  public static final Gson JSON =
      gson()
          .registerTypeAdapter(Workspace.class, new WorkspaceJsonAdapter())
          .create();
  private final Path file;
  private final WorkspaceValidator validator = new WorkspaceValidator();
  private final FileChannel lockChannel;
  private final FileLock lock;

  public WorkspaceRepository(Path directory) throws IOException {
    Files.createDirectories(directory);
    file = directory.resolve("workspace.json");
    lockChannel = FileChannel.open(directory.resolve("workspace.lock"), CREATE, WRITE);
    try {
      lock = lockChannel.tryLock();
      if (lock == null) throw new IOException("A base já está aberta por outro processo Java.");
    } catch (Exception e) {
      lockChannel.close();
      throw e;
    }
  }

  public Workspace read() throws IOException {
    return Files.exists(file) ? readFile(file) : Workspace.empty();
  }

  public Workspace readFile(Path source) throws IOException {
    if (Files.size(source) > WorkspaceValidator.MAX_FILE_BYTES)
      throw new IOException("Arquivo maior que 100 MB.");
    try {
      JsonObject root =
          JsonParser.parseString(Files.readString(source, StandardCharsets.UTF_8)).getAsJsonObject();
      Workspace data = readVersion(root);
      validator.validate(data);
      return data;
    } catch (RuntimeException e) {
      throw new IllegalArgumentException("Dados inválidos: " + e.getMessage(), e);
    }
  }

  public Workspace save(Workspace data) throws IOException {
    byte[] bytes = encode(data);
    preserveLegacy();
    if (Files.exists(file))
      atomicWrite(file.resolveSibling("workspace.json.previous"), Files.readAllBytes(file));
    atomicWrite(file, bytes);
    return data;
  }

  public void exportBackup(Path target) throws IOException {
    preventInternalOverwrite(target);
    atomicWrite(target, encode(read()));
  }

  public Workspace restore(Path source) throws IOException {
    Workspace data = readFile(source);
    // Valida também o tamanho serializado antes de criar qualquer snapshot.
    encode(data);
    if (Files.exists(file))
      atomicWrite(
          file.resolveSibling("workspace.json.before-restore-" + UUID.randomUUID()),
          Files.readAllBytes(file));
    return save(data);
  }

  public void saveReferenceFile(Path target, byte[] bytes) throws IOException {
    preventInternalOverwrite(target);
    atomicWrite(target, bytes);
  }

  private byte[] encode(Workspace data) {
    validator.validate(data);
    byte[] bytes = JSON.toJson(data).getBytes(StandardCharsets.UTF_8);
    WorkspaceValidator.require(
        bytes.length <= WorkspaceValidator.MAX_FILE_BYTES, "Limite de 100 MB atingido.");
    return bytes;
  }

  private static Workspace readVersion(JsonObject root) {
    if (!root.has("version") || !root.get("version").isJsonPrimitive())
      throw new IllegalArgumentException("Versão de dados ausente.");
    int version = root.get("version").getAsInt();
    if (version == 2) return JSON.fromJson(root, Workspace.class);
    if (version != 1) throw new IllegalArgumentException("Versão de dados não suportada.");

    List<Client> clients = list(root, "clients", Client.class);
    List<Campaign> campaigns = list(root, "campaigns", Campaign.class);
    List<Reference> references = new ArrayList<>();
    for (JsonElement element : array(root, "references")) {
      JsonObject reference = element.getAsJsonObject();
      references.add(
          new Reference(
              requiredString(reference, "id"),
              requiredString(reference, "clientId"),
              requiredString(reference, "name"),
              requiredString(reference, "mime"),
              requiredString(reference, "data"),
              requiredString(reference, "createdAt")));
    }
    List<Decision> decisions = new ArrayList<>();
    for (JsonElement element : array(root, "decisions")) {
      JsonObject decision = element.getAsJsonObject();
      decisions.add(
          new Decision(
              requiredString(decision, "id"),
              requiredString(decision, "clientId"),
              optionalString(decision, "campaignId"),
              requiredString(decision, "text"),
              requiredString(decision, "createdAt"),
              optionalString(decision, "invalidatedAt"),
              requiredString(decision, "reason"),
              optionalString(decision, "replaces")));
    }
    return new Workspace(1, clients, campaigns, decisions, references);
  }

  private void preserveLegacy() throws IOException {
    if (!Files.exists(file) || storedVersion() != 1) return;
    byte[] original = Files.readAllBytes(file);
    Path snapshot = file.resolveSibling("workspace.json.before-v2");
    if (!Files.exists(snapshot)) atomicWrite(snapshot, original);
    // Mantido para recuperação de instalações 0.2/0.3 já documentada.
    Path previousSnapshot = file.resolveSibling("workspace.json.before-java-v020");
    if (!Files.exists(previousSnapshot)) atomicWrite(previousSnapshot, original);
  }

  private int storedVersion() throws IOException {
    try {
      return JsonParser.parseString(Files.readString(file, StandardCharsets.UTF_8))
          .getAsJsonObject()
          .get("version")
          .getAsInt();
    } catch (RuntimeException error) {
      // A restauração já preservou o arquivo inválido e precisa conseguir substituí-lo.
      return -1;
    }
  }

  private static JsonArray array(JsonObject root, String key) {
    if (!root.has(key) || !root.get(key).isJsonArray())
      throw new IllegalArgumentException("Coleção de dados inválida.");
    return root.getAsJsonArray(key);
  }

  private static <T> List<T> list(JsonObject root, String key, Class<T> type) {
    List<T> result = new ArrayList<>();
    for (JsonElement element : array(root, key)) result.add(PLAIN_JSON.fromJson(element, type));
    return result;
  }

  private static String requiredString(JsonObject object, String key) {
    String value = optionalString(object, key);
    if (value == null) throw new IllegalArgumentException("Campo ausente: " + key);
    return value;
  }

  private static String optionalString(JsonObject object, String key) {
    if (!object.has(key) || object.get(key).isJsonNull()) return null;
    if (!object.get(key).isJsonPrimitive() || !object.getAsJsonPrimitive(key).isString())
      throw new IllegalArgumentException("Campo inválido: " + key);
    return object.get(key).getAsString();
  }

  private static GsonBuilder gson() {
    return new GsonBuilder()
        .serializeNulls()
        .disableHtmlEscaping()
        .setStrictness(Strictness.STRICT);
  }

  private static final class WorkspaceJsonAdapter
      implements JsonSerializer<Workspace>, JsonDeserializer<Workspace> {
    @Override
    public JsonElement serialize(
        Workspace source, java.lang.reflect.Type type, JsonSerializationContext context) {
      return PLAIN_JSON.toJsonTree(source);
    }

    @Override
    public Workspace deserialize(
        JsonElement json, java.lang.reflect.Type type, JsonDeserializationContext context) {
      JsonObject root = json.getAsJsonObject();
      if (root.has("version") && root.get("version").getAsInt() == 2)
        return PLAIN_JSON.fromJson(root, Workspace.class);
      return readVersion(root);
    }
  }

  private void preventInternalOverwrite(Path target) throws IOException {
    Path resolvedParent = target.toAbsolutePath().getParent().toRealPath();
    if (resolvedParent.equals(file.toAbsolutePath().getParent().toRealPath()))
      throw new IOException("Escolha uma pasta fora do armazenamento interno do aplicativo.");
  }

  public static void atomicWrite(Path target, byte[] bytes) throws IOException {
    Path absolute = target.toAbsolutePath();
    Path temporary = Files.createTempFile(absolute.getParent(), ".creative-hub-", ".tmp");
    try {
      try (FileChannel channel = FileChannel.open(temporary, WRITE)) {
        ByteBuffer buffer = ByteBuffer.wrap(bytes);
        while (buffer.hasRemaining()) channel.write(buffer);
        channel.force(true);
      }
      // Falhar é mais seguro que substituir a base sem atomicidade.
      Files.move(
          temporary, absolute, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
    } finally {
      Files.deleteIfExists(temporary);
    }
  }

  @Override
  public void close() throws IOException {
    lock.release();
    lockChannel.close();
  }
}
