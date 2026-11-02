# Instalação Windows — 0.3.0

## Para usar

1. Abra a [página de versões](https://github.com/JuliaRomeira/ai-creative-hub-desktop/releases) e escolha a versão aprovada.
2. Baixe `AI-Creative-Hub-Setup-0.3.0-x64.exe` para Windows 10/11 x64.
3. Execute o arquivo. Abra **AI Creative Hub** pelo atalho na área de trabalho ou no menu Iniciar.

Java, Node.js e Maven não precisam ser instalados. Não configure PATH ou JAVA_HOME. Depois de baixar o pacote, a instalação e o uso não precisam de internet, conta ou API.

Para usar sem instalação, abra `AI-Creative-Hub-Portable-0.3.0-x64.exe`. O portátil também inclui Java. Os dois formatos usam os dados no perfil do Windows, não ao lado do executável.

O programa não tem assinatura digital. O Windows pode mostrar aviso de editor desconhecido/SmartScreen; computadores de empresas podem impedir a execução por política interna. Não há atualizador automático.

## Atualizar e fazer backup

1. No aplicativo anterior, clique em **Exportar backup** e guarde o JSON fora do computador.
2. Feche o aplicativo. Execute o instalador novo ou substitua o portátil.
3. Abra a nova versão: ela usa o mesmo perfil e formato de dados, sem conversão de banco.

**Restaurar backup** valida o JSON e substitui a base atual, preservando uma cópia local anterior. Para transferir para outro computador, leve também o backup; copiar somente o portátil não transfere os dados.

A desinstalação normal preserva `%APPDATA%\ai-creative-hub-desktop\workspace\`. Não use a opção técnica `--delete-app-data` do desinstalador se quiser manter os dados. Backups e base não são criptografados.

## Gerar e verificar a distribuição

Em Windows x64, com Node.js e JDK conforme o README:

```powershell
npm ci
npm run check
npm run package
```

Os dois executáveis ficam em `release/`. O empacotamento não publica automaticamente. `scripts/prepare-runtime.cjs` baixa o Temurin JDK 17 fixado, verifica SHA-256 inclusive no cache, extrai novamente e usa `jdeps` e `jlink`. Apenas o runtime reduzido é incluído; JDK, compilador, cabeçalhos e manuais ficam fora da distribuição. Licenças e DLLs são preservadas; `resources/runtime/SOURCE.json` registra origem, checksum, código-fonte e módulos.

Para atualizar o runtime, revise a publicação oficial da Adoptium e altere versão, diretório, URL, fonte e checksum juntos. Repita todos os testes. O Java pessoal do desenvolvedor não é copiado para o pacote.

Testar o **portátil real**, sem Java acessível ao aplicativo:

```powershell
$env:AICH_EXECUTABLE = (Resolve-Path 'release/AI-Creative-Hub-Portable-0.3.0-x64.exe').Path
try { npx playwright test } finally { Remove-Item Env:AICH_EXECUTABLE }
```

Testar o executável extraído ou instalado:

```powershell
$env:AICH_DIRECT_EXECUTABLE = (Resolve-Path 'release/win-unpacked/AI Creative Hub.exe').Path
try { npx playwright test } finally { Remove-Item Env:AICH_DIRECT_EXECUTABLE }
```

Os testes usam perfis temporários e dados fictícios, removem Java do PATH, configuram JAVA_HOME inexistente e conferem o caminho real do processo Java filho. Incluem leitura legada sem regravação, snapshot, edição, campanhas, contexto, histórico, anexos, backup e reinício.

`scripts/test-installed.ps1 -Installer <caminho>` testa instalação, reinstalação e desinstalação somente em conta descartável de CI. O preflight recusa instalação, atalhos ou perfil anteriores. O GitHub Actions também remove os JDKs do runner descartável antes de testar os pacotes; não execute essa remoção no computador pessoal.

Sem executável informado, o fluxo exclusivo do empacotado fica ignorado; isso não comprova a distribuição. Consulte [QA.md](QA.md) para resultados e limites, incluindo a diferença entre ambiente local com PATH isolado e Windows com instalações Java removidas.

## Referências

- [jlink no Java 17](https://docs.oracle.com/en/java/javase/17/docs/specs/man/jlink.html)
- [Instalador NSIS do electron-builder](https://www.electron.build/nsis.html)
- [Licenciamento do Temurin](https://adoptium.net/docs/faq)
