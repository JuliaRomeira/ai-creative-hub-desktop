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
