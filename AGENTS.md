# Coordenação do AI Creative Hub Desktop

## Antes de trabalhar
- Leia este arquivo, o README.md, docs/ESTADO-PROJETO.md e o código relacionado à tarefa, incluindo seus chamadores e testes.
- A migração 0.2.0 já usa Java 17 para regras, validação, contexto e persistência. React/TypeScript apresenta a interface; Electron controla a janela e transporta JSON por stdin/stdout. Não reintroduza regras duplicadas no Node ou na interface.
- A 0.3.0 distribui instalador NSIS e portátil Windows x64 com runtime Temurin 17 fixado, verificado e reduzido por jlink. No aplicativo empacotado, use exclusivamente o runtime incluído; não dependa de Java externo. Preserve appId/nome/userData e dados na desinstalação. Consulte docs/INSTALACAO.md.
- Preserve funcionalidades, contrato JSON version 1, dados e backups existentes. O produto deve funcionar sem API paga, modelo local instalado, conta ou conexão após a instalação.
- Não altere dados pessoais, arquivos sincronizados em sources/, dependências ou design fora da tarefa. Não publique, faça commit ou distribua sem solicitação.

## Coordenação e seleção dos especialistas
- O agente principal coordena requisitos, arquitetura, atribuição de arquivos, revisão final, documentação e operações Git/GitHub. Não crie outro coordenador subordinado.
- Os especialistas do projeto estão em `.codex/agents/`: `hub_developer`, `hub_qa` e `hub_windows`. Use o papel registrado quando a ferramenta permitir escolher o tipo de agente; um nome de tarefa não comprova a seleção desse papel. Consulte `docs/AGENTES.md`.
- Resolva tarefas triviais e independentes no agente principal. Não acione todos os especialistas por padrão. Delegue quando houver risco, revisão independente ou trabalho separável que justifique a participação.
- Regras Java, persistência, React ou IPC: `hub_developer`. Mudanças com risco de dados, isolamento entre clientes, comportamento assíncrono ou segurança exigem verificação de `hub_qa` antes de concluir.
- Bugs: `hub_qa` reproduz com fixture; `hub_developer` corrige a causa; QA repete a regressão. Uma suspeita não autoriza alterar regras nem enfraquecer testes.
- Runtime Java, Maven/JAR, NSIS, portátil, dependências de empacotamento ou Actions: `hub_windows`; QA verifica os artefatos reais quando o comportamento distribuído for afetado.
- Mudança simples de documentação ou correção localizada sem risco pode ficar no principal. Segurança integra a revisão de qualidade; não exige outro especialista permanente.
- Se o ambiente não oferecer subagentes ou não selecionar papéis registrados, informe a limitação. O principal pode executar as etapas separadamente; não declare uma delegação que não ocorreu.

## Propriedade e trabalho paralelo
- Antes de delegar, informe objetivo, critérios de aceite, arquivos atribuídos, armazenamento isolado e resultado esperado. Cada agente devolve alterações, evidências, comandos/resultados, riscos e itens não verificados.
- `hub_developer`: `backend/src/main/`, `src/`, `electron/`, `index.html`. `hub_qa`: `backend/src/test/`, `tests/`, `playwright.config.cjs`, `scripts/test-installed.ps1`. `hub_windows`: scripts de build/runtime/inventário e `.github/workflows/`.
- `package.json`, `package-lock.json` e `backend/pom.xml` são compartilhados: atribua um único responsável por arquivo em cada tarefa. Alterar arquivo de outra área exige reatribuição pelo principal.
- Leituras e tarefas com arquivos independentes podem ocorrer em paralelo. Nunca edite o mesmo arquivo simultaneamente. Agentes não mudam branch, fazem commit, push, PR, merge, tag ou release sem atribuição explícita do principal dentro da autorização do usuário.
- Serialize `npm ci`, atualizações de dependências, build, empacotamento e suites Playwright que compartilhem `node_modules/`, `backend/target/`, `dist/`, `release/`, `test-results/` ou capturas em `docs/`. Diretórios de dados temporários não isolam essas saídas de build.
- O limite configurado é de três subagentes concorrentes, além do principal; o ambiente pode impor limite menor. Espere uma tarefa terminar antes de iniciar outra quando não houver capacidade.
- Registre estado, verificações, limitações e pendências em `docs/ESTADO-PROJETO.md`; mantenha relatórios reproduzíveis em `docs/QA.md`. Separe fatos, suspeitas e casos não testados.

## Agente desenvolvedor
- Leia as instruções, README e implementação antes de cada tarefa e confirme o estado da migração.
- Implemente melhorias e corrija causas de bugs no Java e React/TypeScript com o menor escopo completo.
- Preserve persistência local, compatibilidade e recuperação dos dados. Não remova validações ou funcionalidades para contornar falhas.
- Investigue os problemas encaminhados pelo QA e corrija o código da aplicação; não altere testes apenas para fazê-los passar.
- Execute as verificações disponíveis e explique de forma simples o que mudou, por quê e o que foi ou não verificado.

## Agente de QA
- Leia instruções e implementação. Investigue clientes, campanhas, campos vazios/inválidos, edição e exclusão de registros vinculados, reinício, comunicação React/Electron/Java e preparação de contexto.
- Priorize mistura de dados entre clientes e operações com risco de perda de dados. Exclusão ainda não implementada é limitação documentada, não autorização para criar a funcionalidade.
- Crie e execute testes automatizados relevantes com dados fictícios em diretórios temporários isolados. Nunca abra ou modifique a base real do usuário.
- Pode escrever testes; encaminhe correções da aplicação ao desenvolvedor. Coordene alterações em arquivos compartilhados antes de editar.
- Para cada bug confirmado, registre gravidade, passos de reprodução, esperado, obtido e evidências. Separe suspeitas, limitações e itens não testados.
- Após correções, repita testes afetados e confira regressões. Não declare funcionamento sem verificação, especialmente instalação e execução no computador final.

## Verificações
- Consulte os scripts atuais em package.json. Use npm run check para JUnit, ponte Node/Java, compilação e fluxos Electron/Playwright.
- Testes devem usar armazenamento isolado, sem depender de APIs externas ou modelos de IA.
- Distingua compilação, testes automatizados, empacotamento e validação da instalação final. Atualize a documentação com evidências reais, sem inventar resultados.
- Após alterar empacotamento/runtime, gere o instalador e execute tests/packaged.e2e.cjs com AICH_EXECUTABLE, perfil temporário e Java externo indisponível. O teste ignorado sem essa variável não comprova o empacotado. Instalação/desinstalação exige preflight para não substituir registro, atalhos ou instalação existentes.
- Selecione os checks pelo risco: Java/dados exige JUnit e ponte, com fixtures legadas e snapshots; UI/IPC exige TypeScript e fluxos Electron; distribuição exige runtime e executáveis reais. `npm run check` cobre a regressão integrada. Não repita checks já aprovados sem mudança ou preocupação nova.
- Remover Java externo ou instalar/reinstalar/desinstalar para QA somente nos ambientes descartáveis protegidos pelos scripts. Nunca simule variáveis de CI para contornar esses guardas no computador pessoal.
- Publicação continua centralizada no principal: conferir autorização, commit, versão, todos os testes obrigatórios, hashes e artefatos testados. Não publicar estável com falha crítica ou verificação obrigatória pendente.
- Configurações dos especialistas herdam permissões, modelo e provider da sessão. Atribuição de arquivos e instrução de somente leitura são regras de coordenação, não sandbox por arquivo. Não adicione credenciais, APIs, permissões globais ou modelos obrigatórios à configuração do projeto.
