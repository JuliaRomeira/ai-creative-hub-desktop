# Relatório de QA — 29/10/2026

## Etapa 3 — contexto e controle de alterações — 11/11/2026

- JUnit: 19/19 aprovados. Os quatro testes de prompt cobrem compatibilidade anterior, tipos de entrega, isolamento, composição Cliente → Projeto → Arte → Revisão, preservação dos dados e conflitos com elementos protegidos.
- Node/ponte Java: 12/12 aprovados, mantendo comunicação, persistência, runtime e recuperação.
- Electron/Playwright: 9/9 fluxos aplicáveis aprovados e 1 teste do executável empacotado ignorado, como esperado sem um novo pacote. A primeira execução revelou regressão na orientação sobre instrução antiga de entrega; a frase obrigatória foi restaurada e o teste direcionado passou antes da suíte completa.
- Duas tentativas agregadas de `npm run check` pararam na limpeza de pastas temporárias pelo JUnit no Windows (`DirectoryNotEmptyException`), em testes diferentes e depois de todas as asserções. A repetição isolada do Java passou 19/19; Node e Electron foram executados separadamente. O incidente é classificado como falha intermitente de limpeza do ambiente, não como aprovação de uma execução agregada limpa.
- Cenário crítico fictício: publicação Instagram, revisão para trocar apenas a imagem principal, preservando cores, logotipo e tipografia. O resultado inclui marca, modelo, briefing, revisão, decisão e referência corretos e exclui marcadores de outro projeto e cliente.
- Dados exclusivamente fictícios e diretórios temporários. Nenhuma base pessoal, serviço externo, instalação ou executável publicado foi usado.
- Validação prática com uma designer permanece pendente; a Etapa 4 deve registrá-la como pendência se não for realizada.

## Etapa 2 — estrutura e persistência v2 — 10/11/2026

- JUnit: 17/17 aprovados. Quatro testes específicos cobrem migração v1 sem escrita na leitura, snapshot byte a byte, IDs determinísticos, múltiplos projetos/artes, snapshot de modelo, duplicação, revisões derivadas, aprovação, relações inválidas, falha sem gravação parcial e backup/restauração v1/v2.
- Node/ponte Java: 12/12 aprovados, incluindo criação de projeto, modelo, arte e duas revisões, encerramento do Java, reabertura e recuperação do JSON v2.
- Electron/Playwright: fluxo v2 cria dados pela interface real, reinicia e confirma projeto, modelo, duas artes, duas revisões e aprovação. A regressão existente também valida base legada, isolamento, recuperação do Java, anexos e contexto.
- Dados exclusivamente fictícios em diretórios temporários. Nenhuma base pessoal, instalação ou executável publicado foi alterado.
- A validação de uso cotidiano por designer permanece pendente; empacotamento, instalador e SmartScreen pertencem à etapa final.

## Método e isolamento
- Agentes separados: QA escreve testes, desenvolvedor altera aplicação, coordenador mantém documentação.
- Dados fictícios em diretórios temporários; nenhuma base pessoal usada.
- Leitura de README, instruções, Java, interface e ponte Electron antes da revisão.

## QA-01 — Alta — resposta pendente mistura contexto entre clientes
- Reprodução: abrir contexto da campanha A; solicitar atualização e reter a resposta IPC; navegar para cliente/campanha B; liberar a resposta de A.
- Esperado: rascunho de B continua sendo `Rascunho exclusivo B`.
- Obtido antes da correção: textarea de B recebe `CONTEXTO EXCLUSIVO A`; o texto incorreto poderia ser salvo em B.
- Evidência: teste `tests/isolation.e2e.cjs`, asserção do valor do contexto falhou antes da correção.
- Método: Electron e interface reais; resposta IPC de contexto simulada e retida para controlar a latência. A persistência no caminho corrigido usa Java real. Este teste verifica a corrida da interface; testes Java verificam a montagem do contexto.
- Causa: navegação e edição permaneciam disponíveis durante operação assíncrona; a resposta atualizava o estado de outra seleção.
- Correção: `src/main.tsx` bloqueia navegação, abertura de formulários e edição do contexto enquanto `busy`; guardas em `run` e `canLeave` impedem novas operações durante a espera.
- Reteste: `npm run check` passou. O teste de regressão confirma controles bloqueados durante a resposta pendente, contexto A salvo somente em A e rascunho B preservado na interface e no JSON.

## Ocorrência não classificada como bug da aplicação
- Primeira execução de `npm run check`: JUnit concluiu sem falhas de asserção, mas houve erro de limpeza de diretório temporário (`DirectoryNotEmptyException`, teste `restoreKeepsSeparateRecoverySnapshot`). O diretório desapareceu em seguida. Não se repetiu nas duas execuções Java posteriores; causa não comprovada, sem alteração de teste para ocultar o erro.

## Verificações concluídas
- `npm run check`: sucesso (exit 0), com 11 testes JUnit, 3 testes da ponte Node/Java e 3 fluxos Electron/Playwright; compilação Java, TypeScript e Vite concluída.
- `npm run test:java`: 11/11 passaram também em execução separada.
- Novos testes Java verificam dois clientes existentes, contexto/referências separados, rejeição de transferência da campanha para outro cliente válido, campos obrigatórios em branco, orientação órfã e ausência de gravação parcial após rejeição.
- Suíte existente verifica cadastro/edição, histórico, rascunho, reinício, anexos e backup, base legada, Java ausente, queda do processo e segundo escritor.
- `git diff --check`: sucesso. Capturas geradas pela suíte sem diferenças no Git.
- Um bug da aplicação confirmado e corrigido (QA-01); nenhum defeito adicional comprovado no Java nesta revisão. Isso não significa ausência de outros bugs.

## Limites
- Exclusão de clientes, campanhas e referências não existe nesta versão. Não foi implementada para testar; decisões usam invalidação e histórico.
- Instalação e execução no computador final do cliente não verificadas nesta sessão; o teste local de instalação 0.2.1 está descrito abaixo.
- Testes controlados não comprovam comportamento de todos os sistemas de arquivos, falhas físicas de disco, uso prolongado ou bases próximas de 100 MB.

## Instalador 0.2.1 — verificação de 29/10/2026
- Antes: o teste do empacotado falhou no portátil antigo pela ausência de `resources/runtime/bin/java.exe`, confirmando a dependência anterior de Java externo.
- `npm run package`: sucesso. Instalador NSIS x64 por usuário, com JRE Temurin e licenças incluídos.
- Artefato: `release/AI-Creative-Hub-Setup-0.2.1-x64.exe`, 150.805.880 bytes, SHA-256 `721116D7918E62EAA845C751B9EF02697080DC9E4D911E84CD7934528C5632DD`.
- `tests/runtime.test.cjs`: 3/3 passaram (ZIP alterado, release divergente e runtime incompleto rejeitados). Ponte + runtime: 6/6 testes Node passaram.
- Executável em `win-unpacked`: teste `tests/packaged.e2e.cjs` passou; `PATH` restrito a System32, `where java` sem resultado e `JAVA_HOME` inexistente. Consulta do processo filho confirmou Java em `resources/runtime/bin/java.exe`.
- Instalação real silenciosa em diretório temporário: exit 0, executável/runtime presentes, registro HKCU versão 0.2.1 e atalhos de área de trabalho/menu Iniciar criados. Preflight confirmou ausência de instalação, chaves e atalhos anteriores antes da execução.
- Executável instalado: o mesmo E2E passou (6,6 s), com base legada fictícia, snapshot original, edição de cliente, criação de campanha, geração/salvamento de contexto e reinício. Perfil de dados temporário; base pessoal não foi usada.
- Uma tentativa inicial do teste consultava o PID do launcher em vez do processo principal Electron. O teste foi corrigido para consultar o processo principal real; não foi defeito da aplicação.
- Reinstalação/desinstalação e suíte final: em andamento.
- Esta execução local, inclusive instalação silenciosa, não comprova todos os fluxos interativos/SmartScreen nem substitui teste em outra máquina Windows limpa. O instalador permanece sem assinatura digital.

## Validação 0.3.0 — 02/11/2026

- Base verificada: main 5bd0135, com trabalho de runtime e proteção de contexto recuperado do stash, mantido intacto. Branch de migração Java25 não foi usada como baseline desta entrega Java17.
- `npm run check`: 11/11 JUnit, 7/7 Node naquele momento, 4/4 fluxos de desenvolvimento Electron. Fluxo adicional do empacotado ignorado somente nessa execução, conforme esperado.
- Depois, adicionados testes de Java incorporado ausente (sem fallback, mensagem de reparo e sem dados criados) e DLL ausente. QA executou 9/9 testes Node com sucesso.
- Runtime positivo: Java17, módulos, licenças e execução sem Java acessível via PATH/JAVA_HOME. jlink ocupa 32.096.014 bytes; saúde do JAR retorna ready usando runtime próprio.
- O primeiro check foi afetado por atualização simultânea do Electron (falha de lançamento e EBUSY); repetição após concluir a atualização passou. Falha de ambiente de teste, sem alteração de asserções para ocultar problema.
- Primeiro empacotamento em release/ encontrou EBUSY em default_app.asar. Repetido em release-validation/v030 para preservar artefatos e evitar interferência com saída anterior; resultado final abaixo.
- Auditoria npm: produção zero; completa 15 moderadas por minimatch no empacotador. Electron atualizado para 45.2.1; builder 26.18.0 já é a versão mais recente consultada. Downgrade automático para 20.23.1 não aplicado. Entradas de glob são arquivos/configuração do projeto durante build, não dados de clientes em uso.
- Segurança do aplicativo revisada: renderer sem Node, sandbox e isolamento, preload restrito, verificação de origem IPC, navegação/janelas externas bloqueadas, CSP sem conexões externas. Sem novas credenciais ou serviços. Revisão não equivale a auditoria formal de segurança.
- Sandbox indisponível no host e Hyper-V sem acesso: testes locais com PATH restrito não comprovam desinstalação do Java da máquina. A verificação Windows sem instalações Java será executada no runner descartável separado de CI.
- Empacotamento em release-validation/v030: sucesso (NSIS + portátil, exit0). Instalador local 140.180.814 bytes (SHA256 61fd47fa66d8ab282fe42b019d76082493ee88516465e01334ae3e1fb5c7bb82); portátil local 128.235.558 bytes (SHA256 972c94bb0ba0e3c0fd6f68ba6d68f755dbb200ee6b07e6d734c865d586562549). Artefatos do CI podem ter hashes/tamanhos diferentes por metadados do build; use o manifesto publicado junto deles.
- Executável empacotado direto: 5/5 Playwright passaram (14,9s). Uma falha anterior no teste de QA usava require dentro de app.evaluate; resolvido calculando o caminho fora do contexto Electron, sem alterar a aplicação ou reduzir asserções.
- Repetição final Node após todos os acréscimos: 9/9 passaram, incluindo Java incluído ausente sem fallback e DLL faltante.
- CI remoto e portátil real em validação; aprovação estável só após todos os jobs obrigatórios. A execução interativa de SmartScreen e o uso no computador final permanecem fora da cobertura automatizada.
- Portátil real: 5/5 Playwright passaram (1,6min), incluindo múltiplas extrações/reaberturas do lançador NSIS. Todas as inicializações confirmaram app.isPackaged, caminho do portátil original e processo Java em resources/runtime/bin/java.exe. Nenhum banco pessoal utilizado.
- Executável direto: 5/5; portátil: 5/5; desenvolvimento: 4/4; Node: 9/9; JUnit: 11/11. Instalação/reinstalação/desinstalação e ausência física de Java externo são verificações separadas obrigatórias do CI, ainda pendentes no momento deste registro.
- Inventário físico Java no CI anterior terminou e os quatro primeiros fluxos do portátil passaram sem Java externo. O quinto falhou por require no contexto de app.evaluate, erro do teste já corrigido em994e640 e validado localmente em5/5. Esse run antigo não autoriza publicação.
- Confirmada lentidão do inventário PowerShell: duas varreduras físicas levaram cerca de10min no runner. Substituída somente a enumeração por helper C#/.NET, preservando arquivos ocultos/sistema e aliases de arquivo e evitando ciclos de junction. Verificação pós-remoção e validação dos caminhos permanecem obrigatórias. Teste comparou resultados com Get-ChildItem em árvore temporária e verificou junction externa/cíclica; passou em1,4s. Symlink de arquivo requer privilégio indisponível localmente; o teste também tenta esse caso no CI.
- O novo teste de inventário integra npm test (10 testes Node). actions/setup-java atualizado para v5 após aviso de depreciação do v4 no runner; nenhuma mudança na linha Java17.
- O primeiro CI do inventário rápido identificou diferença de alias8.3 no caminho temporário (RUNNER~1 versus runneradmin), antes de testar o helper. Teste corrigido para construir seus caminhos a partir de fs.realpathSync.native; comparações exatas e testes de aliases preservados. Inventário1/1 e Node10/10 passaram localmente após a correção. Sem mudança na aplicação.
- CI com Java externo fisicamente removido: portátil5/5 passou. Instalação NSIS retornou0 e criou o executável, mas o teste procurava DisplayName sem versão; confirmado no código do electron-builder que o padrão inclui produto+versão. Corrigida descoberta com regex ancorada para produto e versões semver, mantendo Count1 e DisplayVersion obrigatórios e adicionando diagnóstico dos registros encontrados. Oito registros fictícios verificaram descoberta e rejeição de nomes não relacionados; nenhum registro real foi alterado localmente. Novo CI obrigatório repetirá todo o ciclo.
- A primeira travessia C# também mostrou demora no runner. Corrigida para uma única DirectoryInfo.EnumerateFileSystemInfos por diretório e atributos em cache, mantendo os mesmos alvos e exclusão apenas de junctions de diretórios. Benchmark local delimitado em C:\Windows\Microsoft.NET, cinco medições alternadas: média282,68ms anterior versus131,10ms nova, resultados idênticos. Essa medição não comprova o tempo no volume completo do runner. Node10/10 passou após o ajuste; CI completo será repetido.
- CI reconheceu um layout adicional do Java8: jdk/jre/bin/java.exe sem release próprio. A seleção da raiz agora promove somente esse JRE para o JDK pai quando o pai tem JAVA_VERSION válido; todas as proteções de caminho e verificação posterior continuam ativas. Fixtures verificaram JDK8 aninhado, JRE independente e metadados inválidos, sem excluir arquivos. Dois testes de inventário passaram; suíte Node agora contém11 testes.

## Recuperação do Java — 04/11/2026
- Reprodução independente antes da correção, em perfil temporário: leitura inicial funcionou; editar contexto e cancelar `app.quit()` preservou a janela, mas a leitura seguinte falhou com Java indisponível. Gravidade: bloqueio de uso até reabrir, com rascunho ainda na janela.
- Correção: encerrar Java somente em `will-quit`; reconectar na operação seguinte após queda, aguardando liberação do processo anterior; não repetir pedidos sem confirmação.
- `npm run check`: JUnit 11/11, Node 11/11 e compilação aprovados. Dois testes novos inicialmente falharam por `require` indisponível no contexto de avaliação do Playwright; corrigido exclusivamente o carregamento do módulo do teste com `createRequire`.
- Após correção do teste, `npx playwright test`: 7 aprovados e 1 ignorado (exclusivo de executável empacotado). `tests/recovery.e2e.cjs`: 3/3 aprovados. Cancelar saída mantém a instância Java original viva; queda permite próxima edição sem reabrir; mutação interrompida mostra aviso e não sofre replay; pedidos concorrentes iniciam apenas um Java substituto. Clientes, campanhas, decisões e referências legadas fictícias preservados.
- Testes usam diretórios temporários; não alteram a instalação nem a base pessoal. O teste de symlink de arquivo requer privilégios indisponíveis; cobertura de junction permanece ativa.
- Causa exata do incidente original não comprovada; não atribuir a captura ao bug reproduzido sem evidência adicional.
- Artefatos locais gerados em `release-validation/java-recovery/`: instalador NSIS e portátil 0.3.0 corrigidos (não são a release publicada). A interrupção da sessão ocorreu durante a criação do portátil; a etapa foi retomada com `npx electron-builder --win portable --x64 --publish never --prepackaged release-validation/java-recovery/win-unpacked --config.directories.output=release-validation/java-recovery`.
- Portátil real: `AICH_EXECUTABLE` apontando o executável acima + `npx playwright test`: **8/8 aprovados**, sem ignorados, em 1,7 min. PATH sem Java e JAVA_HOME inexistente apenas no processo de teste; Java externo não foi removido do computador. Validado runtime incluído também na instância recriada após queda.
- SHA-256 portátil: `d020af59803b110255313985b47aeafaf160c4f1292e3465a2f58ebce717336f`; instalador: `ddcab393d35510f29db8bce03262a302887d2389659d2003b5ff5265f0661914`. Manifesto local `SHA256SUMS.txt` junto aos executáveis.
- Não realizado nesta correção: instalar/reinstalar/desinstalar NSIS, SmartScreen, assinatura digital ou computador final. A instalação pessoal não foi substituída e uma nova release não foi criada.

## Prompt orientado ao resultado — 05/11/2026
- JUnit: 13/13. Inclui compatibilidade do contexto legado, quatro tipos de resultado, rejeição de modo inválido, isolamento entre clientes/campanhas, decisões invalidadas ausentes e nenhuma mutação dos dados durante a preparação.
- `npm run check`: Node 11/11, compilação Java/TypeScript/Vite aprovada e Electron 8/8 aplicáveis; o caso exclusivo do empacotado foi ignorado porque esta etapa ainda usava o build de desenvolvimento.
- O novo fluxo Electron confirma que trocar o resultado desejado não sobrescreve o rascunho; atualizar para arte final inclui pedido de imagem pronta e resolução de instrução antiga conflitante; roteiro gera instrução própria; valor inválido é rejeitado no Java.
- A demonstração fictícia Café Aurora foi refeita em perfil isolado. O prompt começa com `TAREFA PARA A IA` e pede a arte final, embora o pedido antigo ainda contenha `Não gere a imagem nesta etapa`; o bloco `COMO USAR O BRIEFING` define que a escolha atual substitui somente essa instrução antiga.
- Portátil real `release-validation/prompt-output/AI-Creative-Hub-Portable-0.3.0-x64.exe`: Playwright **9/9**, sem ignorados, em 2,6 min. O processo de teste remove PATH/JAVA_HOME externos e confirmou o runtime incluído também após reconexão. SHA-256: `56226877e13b686f2c61b04686a75d22d1da52aea462ba64c91cb395a79bf093`.
- Revisão final em 08/11/2026: chamada sem `output` continua produzindo o contexto legado; seletor acessível por teclado e sem rolagem horizontal na largura mínima de 850 px. JUnit 13/13, build e teste direcionado 1/1 aprovados.
- Portátil final desta alteração: `release-validation/prompt-final/AI-Creative-Hub-Portable-0.3.0-x64.exe`, 128.235.884 bytes, SHA-256 `cf02ce697061591fbd93e146dc030d1f53e16c6497af26eb0a50b90341226088`. No artefato exato, os testes de Java incluído/dados e prompt passaram 2/2 com Java externo indisponível no processo.
- Não verificado nesta mudança: instalação/reinstalação/desinstalação NSIS, SmartScreen, assinatura digital e computador final. Nenhum dado pessoal foi usado e a instalação existente não foi substituída.
