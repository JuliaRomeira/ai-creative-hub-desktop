# Estado do projeto

## Evolução Cliente → Projeto → Arte → Revisão — Etapa 4

- O fluxo real da interface permite cadastrar cliente, criar projeto, criar e escolher modelo, criar arte, registrar revisão, gerar contexto e salvar o novo rascunho.
- Operações pendentes exibem `Processando…`, usam `aria-busy` e mantêm navegação e edição bloqueadas para evitar ações concorrentes.
- Erros continuam preservados no alerta global e agora levam a janela ao início para que a mensagem não fique fora da área visível.
- Modais mantêm foco preso, fecham com `Esc` e devolvem o foco ao controle que os abriu. O defeito de retorno de foco foi encontrado pelo teste de teclado e corrigido.
- O fluxo completo foi validado na janela mínima suportada pelo Electron, 850 × 650, sem rolagem horizontal. Larguras móveis não se aplicam porque o produto desktop impede reduzir a janela abaixo de 850 px.
- Não foram encontrados botões simulados no fluxo crítico; os controles exercitados chamam a persistência Java real.
- Validação com uma designer em uso cotidiano: **pendente**, conforme o critério de conclusão.

## Evolução Cliente → Projeto → Arte → Revisão — Etapa 3

- O gerador determinístico agora recebe cliente, projeto, arte e revisão explícitos e valida todos os vínculos antes de montar o texto.
- O contexto combina identidade visual, regras permanentes, decisões do projeto, snapshot do modelo, briefing da arte, instruções da revisão e referências aplicáveis ao escopo selecionado.
- A aba **Contexto** permite escolher a arte e a revisão. O rascunho continua editável e só é substituído após confirmação.
- Elementos marcados simultaneamente para preservar e modificar são rejeitados. Pedidos para alterar logotipo, cores ou tipografia protegidos pelas regras permanentes também são rejeitados sem modificar os dados.
- O cenário automatizado de publicação para Instagram altera somente a imagem principal, preserva cores, logotipo e tipografia e confirma que dados de outro projeto ou cliente não entram no resultado.
- O funcionamento continua totalmente local: nenhuma API, internet, modelo de IA ou dependência nova foi adicionada.
- Detecção semântica livre não foi implementada; conflitos são detectados por vínculos, seleções explícitas e termos protegidos conhecidos, de forma previsível e testável.

## Evolução Cliente → Projeto → Arte → Revisão — Etapa 2

- Implementado contrato JSON v2 com projetos, artes, modelos, revisões, decisões por projeto e referências com escopo validado.
- Bases v1 da 0.3.0 são migradas em memória sem escrita ao abrir; a primeira mutação preserva os bytes em `workspace.json.before-v2` e mantém o snapshot legado.
- Projetos e artes podem ser criados e editados; modelos podem ser criados, editados, duplicados e reutilizados por snapshot; revisões são acrescentadas, podem partir de versão antiga e podem ser aprovadas sem sobrescrever o histórico.
- A interface real foi integrada ao v2 na aba **Modelos e artes**. O fluxo automatizado cria projeto, modelo, segunda arte e duas revisões, aprova uma versão, reinicia o Electron e recupera tudo.
- Corrigida a restauração de backup válido sobre base corrompida: o arquivo inválido é preservado e não bloqueia a substituição validada.
- Exclusão e cascata não foram implementadas porque não fazem parte dos critérios e aumentariam o risco de perda de dados.

## Evolução Cliente → Projeto → Arte → Revisão — Etapa 1

- Arquitetura, funcionalidades reutilizáveis, persistência v1 e `ContextService` mapeados em [ARQUITETURA-EVOLUCAO.md](ARQUITETURA-EVOLUCAO.md).
- Proposto contrato JSON v2 com projetos, artes, revisões e modelos, preservando React/TypeScript → Electron → Java 17 → JSON local.
- Planejada migração da 0.3.0 sem escrita ao apenas abrir a base, com snapshot byte a byte antes da primeira gravação v2 e conversão determinística de campanhas.
- Riscos críticos identificados: perda de dados v1, mistura entre projetos e sobrescrita de histórico. A Etapa 2 não deve avançar sem testes de migração, reinício e falha sem gravação parcial.
- Nesta etapa não houve alteração de código, contrato de dados, interface, base pessoal ou distribuição.

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

## Recuperação do Java — 04/11/2026 (correção local)
- Bug reproduzido: com contexto editado e não salvo, cancelar o fechamento mantinha a janela aberta, mas `before-quit` já encerrava o Java. O encerramento agora ocorre em `will-quit`, depois de a janela aceitar fechar.
- Se o Java encerrar inesperadamente, a próxima operação espera o processo anterior terminar e inicia uma única conexão compartilhada. O aplicativo empacotado continua usando exclusivamente o runtime incluído.
- Uma operação interrompida não é reenviada automaticamente: a resposta informa que não foi possível confirmar o resultado e orienta conferir os dados antes de repetir. Isso evita duplicar uma gravação já concluída cuja resposta se perdeu.
- Interface, contrato JSON v1, appId, userData, anexos e regras Java preservados. Dados reais não foram abertos ou alterados.
- A causa exata do episódio da captura enviada pela usuária não foi comprovada. O defeito de saída cancelada foi reproduzido separadamente; não há registro persistente do encerramento original.
- Verificações e artefatos desta correção estão registrados em QA.md.
- Fechamento: JUnit 11/11, Node 11/11, build aprovado, desenvolvimento 7/7 aplicáveis; portátil real corrigido 8/8, com Java externo indisponível no ambiente do processo e runtime incluído confirmado após reconexão. Instalador e portátil disponíveis em `release-validation/java-recovery/`, com hashes em QA.md e SHA256SUMS.txt. Instalação/reinstalação/SmartScreen deste build não verificados; versão pessoal não substituída.

## Prompt orientado ao resultado — 05/11/2026 (local)
- A aba Contexto agora exige uma intenção explícita: arte final, roteiro de conteúdo, prompt para ferramenta de imagem ou somente contexto. Arte final é a seleção inicial.
- O Java acrescenta a tarefa e o formato de entrega antes do briefing. Uma instrução antiga no pedido sobre o tipo de entrega é substituída somente nesse ponto; marca, conteúdo e decisões válidas permanecem obrigatórios.
- Nenhuma IA ou API foi adicionada. O aplicativo prepara o prompt; a ferramenta escolhida pelo usuário produz a imagem ou o texto final. O contrato JSON v1 e os rascunhos existentes permanecem inalterados.
- Na validação local: JUnit 13/13; Node 11/11; build TypeScript/Vite aprovado; Electron 8/8 aplicáveis, mais um teste do executável empacotado ignorado até gerar o novo artefato.
- Portátil local atualizado gerado em `release-validation/prompt-output/`. A suíte real do empacotado passou 9/9 com Java externo indisponível no processo, incluindo prompt orientado, base legada, anexos, backup, reinício e recuperação do Java. SHA-256 registrado em QA.md. Instalação NSIS e computador final permanecem sem verificação desta mudança.
- Após a revisão de compatibilidade, o artefato definitivo local está em `release-validation/prompt-final/`; o Java incluído e o novo prompt passaram no pacote exato. Esse executável não foi publicado como nova release.
