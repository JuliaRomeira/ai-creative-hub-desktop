package io.github.juliaromeira.creativehub.persistence;

import static java.nio.file.StandardOpenOption.*;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.Strictness;
import io.github.juliaromeira.creativehub.model.Workspace;
import io.github.juliaromeira.creativehub.service.WorkspaceValidator;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.UUID;

/** Acesso ao disco separado das regras de negócio; mantém o formato legado. */
public final class WorkspaceRepository implements AutoCloseable {
  public static final Gson JSON =
      new GsonBuilder()
          .serializeNulls()
          .disableHtmlEscaping()
          .setStrictness(Strictness.STRICT)
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
      Workspace data =
          JSON.fromJson(Files.readString(source, StandardCharsets.UTF_8), Workspace.class);
      validator.validate(data);
      return data;
    } catch (RuntimeException e) {
      throw new IllegalArgumentException("Dados inválidos: " + e.getMessage(), e);
    }
  }

  public Workspace save(Workspace data) throws IOException {
    byte[] bytes = encode(data);
    preserveBeforeJava();
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

  private void preserveBeforeJava() throws IOException {
    Path snapshot = file.resolveSibling("workspace.json.before-java-v020");
    if (Files.exists(file) && !Files.exists(snapshot)) {
      // Não reserializa: preserva exatamente os bytes da base anterior.
      atomicWrite(snapshot, Files.readAllBytes(file));
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
