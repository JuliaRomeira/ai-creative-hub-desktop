# Estado do projeto

## Arquitetura observada
- Versão 0.2.1: Java 17, Maven e Gson; React/TypeScript; Electron; instalador NSIS Windows x64 com JRE incluído.
- Migração implementada: regras e armazenamento em backend/, transporte em electron/java-backend.cjs, interface em src/.
- Persistência JSON version 1 compatível com a versão anterior; snapshots e gravação atômica descritos no README.
- Funcionamento determinístico, sem geração de IA, API paga ou modelo instalado.
- Exclusão de clientes, campanhas e referências não implementada nesta versão; decisões são invalidadas com histórico.

## Sessão de 29/10/2026
- Responsabilidades de coordenação, desenvolvimento e QA registradas no AGENTS.md.
- Agentes auxiliares de desenvolvimento e QA executados separadamente; propriedade de aplicação/testes/documentação respeitada.
- Corrigido QA-01: resposta assíncrona de contexto podia preencher rascunho de outro cliente após navegação. Interface agora bloqueia navegação e edição durante operações pendentes.
- Testes adicionados para corrida da interface, isolamento entre dois clientes, campos inválidos e rejeição de vínculos sem gravação parcial.
- `npm run check` passou: 11 JUnit + 3 ponte Node/Java + 3 E2E Electron, com compilação Java/TypeScript/Vite. `git diff --check` passou.
- Primeiro check teve erro de limpeza temporária JUnit, não reproduzido nas duas execuções Java seguintes; causa não comprovada. Consulte [QA.md](QA.md).
- Nenhuma alteração no contrato de armazenamento ou nos dados pessoais; sem commit, publicação ou geração de distribuição nesta tarefa.

## Pendências conhecidas
- Validar a distribuição no computador final Windows limpo; cliente não precisa mais instalar Java separadamente na 0.2.1.
- Validar uso cotidiano e bases próximas dos limites documentados no README.
- Não há autorização nesta tarefa para implementar itens do roadmap ou publicar uma distribuição.

## Instalador solicitado em 29/10/2026
- `npm run package` gerou o instalador local 0.2.1, sem publicação. Veja [INSTALACAO.md](INSTALACAO.md).
- Temurin JRE 17.0.20.1+1 Windows x64 incluído com licenças, DLLs e identificação de fonte/checksum. Download somente no build; cliente usa runtime próprio, sem PATH/JAVA_HOME.
- NSIS por usuário, atalhos e abertura após instalação interativa. AppId, nome e diretório de dados mantidos; desinstalação normal preserva dados.
- Java pelo código-fonte ainda exige JDK. O instalador é sem assinatura e ainda usa o ícone padrão do Electron.
- QA de instalação e empacotamento em andamento; resultados finais em QA.md.

## Versão 0.3.0 — validação de 02/11/2026

- Branch `release/0.3.0` criada de `origin/main` (5bd0135). Trabalho anterior recuperado do stash sem apagá-lo; branch de migração Java 25 e arquivos locais preservados. Mantido Java 17 conforme o requisito desta versão.
- Arquitetura React/TypeScript → preload → Electron → pipes privados → Java preservada. Sem HTTP, Spring Boot, modelo de IA ou API paga. Sem mudança de contrato JSON v1, appId, nome ou diretório de dados.
- Incluída correção já existente no trabalho recuperado: navegação e edição bloqueadas durante resposta de contexto pendente, evitando mistura de rascunho entre clientes.
- Runtime Temurin 17.0.20.1+1 para Windows x64, download JDK com SHA-256 verificado. `jdeps` + `jlink` geram runtime de 32.096.014 bytes. Licenças, DLLs e origem/código-fonte mantidos. Apenas runtime vai ao usuário; não o JDK de build.
- Instalador NSIS por usuário e portátil; ambos usam exclusivamente resources/runtime/bin/java.exe. Desenvolvimento continua usando JDK local.
- Electron atualizado de 45.1.0 para 45.2.1. Auditoria de produção: zero vulnerabilidades. Auditoria completa: 15 moderadas na cadeia minimatch/electron-builder. Não aplicado downgrade incompatível sugerido pelo npm nem override de major sem compatibilidade comprovada.
- CI testa Java, Node, interface, runtime, portátil real e ciclo instalação/reinstalação/desinstalação. Job descartável remove instalações Java externas antes dos E2E. Release por tag repete verificações e só publica artefatos aprovados, com checksums.
- Autorização nesta tarefa inclui commits, PR, merge e publicação, condicionados à aprovação dos testes obrigatórios. Resultados e limitações atuais em QA.md; estado remoto ainda em verificação.

## Configuração persistente de agentes — 02/11/2026
- Análise da aplicação, persistência, IPC, interface, testes, empacotamento, Actions e roadmap indicou três especialistas: hub_developer, hub_qa e hub_windows. Arquitetura, documentação e Git/GitHub permanecem no principal; tarefas simples não exigem delegação.
- Formato oficial atual: .codex/agents/*.toml independentes e .codex/config.toml; nenhum modelo, provider, MCP ou permissão global adicionado. Limite de três filhos, além do principal, respeitando limites menores do ambiente.
- Arquivos e saídas compartilhadas exigem responsável único e execução serializada de dependências/build/Playwright. Uso apenas de fixtures e dados temporários; sem modificações na aplicação ou dados reais nesta configuração.
- Codex CLI 0.164.0-alpha.11.1: configuração estrita aprovada e três tipos registrados executados em sessão nova somente leitura. Teste com --ephemeral falhou por ausência de rollout e não foi contado como aprovação; sessão normal concluiu as três tarefas e reuniu os resultados.
- Validação TOML e workflow executada com Python 3.12.14; revisão independente de QA sem bloqueadores. Escopos, permissões reais, exemplos e limitações em docs/AGENTES.md.

## Fechamento técnico da 0.3.0
- PR #3 integrado à main em 65a43524268ebd0491fae06d2be3f21e5571c686 após CI 41530964122 aprovado.
- Runner Windows com JDK/JRE externos removidos fisicamente: portátil 5/5, instalado 5/5, reinstalado 5/5; desinstalação preservou os bytes da base legada fictícia. Testes Java 11/11 e Node/compilação/fluxos de desenvolvimento aprovados. Nenhum dado pessoal utilizado.
- Tag v0.3.0 criada; workflow de publicação 41533881804 repete os testes antes de disponibilizar a release. Consulte a página de Releases para o resultado definitivo e o manifesto de hashes dos artefatos publicados.
- SmartScreen/interação manual e computador final do tio continuam fora da cobertura automatizada; assinatura digital ausente e 15 alertas moderados de desenvolvimento do empacotador permanecem documentados.

## Publicação confirmada — 02/11/2026
- Release estável v0.3.0 publicada às 22:51 UTC: https://github.com/JuliaRomeira/ai-creative-hub-desktop/releases/tag/v0.3.0 (draft=false, prerelease=false).
- Workflow 41533881804 aprovado após repetição do job de inventário: build e todos os testes Windows sem Java externo passaram; portátil 5/5, instalado 5/5, reinstalado 5/5 e desinstalação preservando os bytes da base fictícia. Primeira tentativa cancelada por demora na varredura, sem publicar antecipadamente.
- Artefatos publicados: instalador 140.180.814 bytes; portátil 128.234.065 bytes. Manifesto SHA256SUMS.txt incluído e hashes conferidos pelo workflow antes da publicação. Estes são os tamanhos definitivos do CI, distintos dos builds locais.
- Configuração persistente dos três agentes publicada no PR #4, branch chore/codex-specialized-agents. Workflow Verificar agentes Codex 41535464841 aprovado; delegação nativa real documentada em AGENTES.md. PR permanece aberto para revisão.
