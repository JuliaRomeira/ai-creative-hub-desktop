# Especialistas do projeto no Codex

O projeto utiliza três especialistas e o agente principal como coordenador. Eles servem ao desenvolvimento; não fazem parte do aplicativo distribuído e não precisam existir no computador do cliente.

## Decisão baseada no repositório

O Java concentra domínio, validação, contexto, anexos e persistência JSON v1. React/TypeScript apresenta os dados; Electron controla a janela, os diálogos e o transporte privado por stdin/stdout. A base tem gravação atômica, bloqueio de escritor e snapshots. JUnit, Node e Playwright verificam regras e integração real. A distribuição Windows combina JAR, runtime reduzido por jlink, NSIS, portátil e CI sem Java externo.

Separar permanentemente Java e frontend acrescentaria passagens de trabalho em alterações que atravessam o IPC. Segurança e integridade dos dados fazem parte da revisão de qualidade. Arquitetura e documentação permanecem no coordenador. O roadmap de IA não justifica criar agentes para funcionalidades ainda inexistentes.

| Papel registrado | Quando utilizar | Responsabilidade de edição padrão |
| --- | --- | --- |
| `hub_developer` | Implementação ou correção na aplicação | `backend/src/main/`, `src/`, `electron/`, `index.html` |
| `hub_qa` | Reprodução de bugs, revisão independente, regressão, segurança e dados | `backend/src/test/`, `tests/`, `playwright.config.cjs`, `scripts/test-installed.ps1` |
| `hub_windows` | Java distribuído, build, instaladores, dependências de empacotamento e Actions | Scripts de build/runtime/inventário e `.github/workflows/` |

`package.json`, `package-lock.json` e `backend/pom.xml` exigem responsável único definido para cada tarefa. Os escopos podem ser reatribuídos explicitamente; não autorizam edições simultâneas. O principal mantém decisões de arquitetura, documentação, revisão final e operações Git/GitHub.

## Formato e persistência

A documentação oficial atual define agentes personalizados em arquivos TOML independentes em `.codex/agents/`, com `name`, `description` e `developer_instructions`. `.codex/config.toml` habilita a delegação e limita a três subagentes concorrentes, excluindo o principal. O nome registrado vem de `name`; o nome de uma tarefa não substitui a seleção desse papel. [Documentação oficial](https://learn.chatgpt.com/docs/agent-configuration/subagents).

Os arquivos e o `AGENTS.md` são versionados. Uma nova sessão do Codex deve iniciar neste repositório e carregar a configuração local de um projeto confiável. Projetos não confiáveis podem ignorar as camadas locais. Não alteramos confiança, autenticação ou configurações globais. [Configuração por projeto](https://learn.chatgpt.com/docs/config-file/config-basic).

Não fixamos modelo, provider ou serviço pago. Cada especialista herda o modelo e as permissões da sessão principal. As funcionalidades de apps e plugins são desativadas nos três papéis; não adicionamos servidores MCP ou credenciais. Configurar `sandbox_mode` ou `approval_policy` dentro de um agente não cria permissões diferentes: essas opções pertencem à sessão principal. Atribuição de arquivos e instrução de somente leitura são limites de coordenação, não uma barreira de segurança do sistema operacional.

As definições persistem entre sessões; processos, tarefas e resultados intermediários não ficam executando em segundo plano. Recomenda-se iniciar uma nova sessão após alterar definições. Não prometemos recarregamento automático de uma sessão já aberta.

## Como ocorre a delegação

O principal lê o pedido, identifica o risco e seleciona o especialista pelo nome registrado. As descrições dos papéis e as regras de `AGENTS.md` orientam essa decisão; não há daemon ou monitor de arquivos criado pelo projeto.

1. Definir critérios de aceite e arquivos atribuídos.
2. Delegar somente trabalho necessário e separável. Documentação simples pode ficar inteiramente com o principal.
3. Paralelizar leituras e alterações independentes, com um escritor por arquivo.
4. Serializar instalação de dependências, builds, empacotamento e suites que compartilham saídas. Perfis de dados distintos não isolam `dist/`, `backend/target/`, `release/` ou `test-results/`.
5. Para bugs, QA reproduz; desenvolvimento corrige a causa; QA repete a regressão. Segurança e dados recebem revisão proporcional ao risco.
6. O principal reúne evidências, revisa o diff e verifica os critérios antes de concluir ou publicar.

Os especialistas não publicam, mudam branches nem alteram arquivos de outro responsável por iniciativa própria. Uma autorização do usuário deve acompanhar a atribuição do coordenador para operações Git/GitHub. Instalação/desinstalação e remoção de Java para QA ficam nos ambientes descartáveis protegidos pelos scripts; nunca se simulam variáveis de CI no computador pessoal.

## Verificação reproduzível

Ambiente de referência: Codex CLI `0.164.0-alpha.11.1`, consultado em 02/11/2026. A validação envolve três níveis distintos:

- TOML e campos obrigatórios: workflow `Verificar agentes Codex`, sem inferência, credenciais ou dependências extras.
- Carregamento nativo: `codex app-server --strict-config --print-startup-config`, executado na raiz. A saída pode conter preferências locais; não a publique integralmente.
- Delegação real: nova sessão Codex, somente leitura, com os três papéis registrados executando verificações independentes e devolvendo resultados ao principal. Saída bem-sucedida do processo, por si só, não comprova que os filhos iniciaram.

`codex agents` lista sessões, não um catálogo de definições. A ferramenta `collaboration.spawn_agent` disponível em alguns ambientes permite nomear uma tarefa, mas pode não oferecer seletor de papel registrado. Nesses ambientes, informe a limitação; não confunda nomear uma tarefa com comprovar carregamento de uma definição.

Para repetir o teste seguro em um processo novo:

```powershell
codex exec --json --sandbox read-only --strict-config "Use os tipos registrados hub_developer, hub_qa e hub_windows para três verificações independentes somente de leitura: caminho IPC de contexto, proteção de snapshots legados e seleção do Java empacotado. Não altere arquivos, dados, Git ou configurações; não execute builds nem testes. Aguarde os três e reúna os resultados. Informe qualquer falha real de delegação."
```

Confira eventos/metadados da execução e resultados de cada filho; uma resposta declarando que delegou não basta. Logs locais de validação ficam fora do controle de versão. Na CLI testada, a tentativa com `--ephemeral` falhou ao recuperar o contexto dos filhos por ausência de rollout; essa tentativa não foi contada como sucesso. O teste deve utilizar uma sessão normal até essa limitação ser resolvida.

### Resultado observado em 02/11/2026

- TOML dos quatro arquivos carregado por `tomllib` do Python 3.12.14, sem BOM; validação do workflow executada localmente com sucesso.
- Configuração nativa estrita aprovada pela CLI 0.164.0-alpha.11.1.
- Sessão normal iniciada com `--sandbox read-only`: o registro da sessão contém três chamadas `spawn_agent`, com `agent_type` igual a `hub_developer`, `hub_qa` e `hub_windows`. Os retornos criaram as tarefas `trace_context`, `check_data_protection` e `check_windows_runtime`; todas terminaram e tiveram seus resultados reunidos pelo principal.
- Desenvolvimento traçou o caminho React → preload → Electron → ponte → Java → `ContextService`; QA identificou versão v1, leitura sem regravação, bloqueio e snapshots; Windows conferiu o Java privado e os dois formatos de distribuição. Essas verificações foram de leitura de código, não testes novos dos executáveis.
- Revisão independente de QA não encontrou bloqueadores. Nenhum código de produção, dado pessoal, instalação ou configuração global foi alterado por essa estrutura.

O teste comprova esta instalação e este processo novo do Codex; não garante disponibilidade idêntica em outras versões, contas ou interfaces. O limite do ambiente pode ser menor que o configurado. Os agentes nativos `default`, `worker` e `explorer` não foram substituídos.

## Exemplos de pedidos

- “Corrija este bug de campanha, preserve o JSON e solicite uma regressão de QA.”
- “Revise a integridade dos backups sem alterar produção.”
- “Gere os executáveis Windows e valide o Java incluído, sem publicar.”
- “Use `hub_qa` para investigar se uma resposta de contexto pode misturar clientes.”
- “Atualize esta instrução do README.” — normalmente o principal resolve sozinho.

Esses pedidos não autorizam implementar o roadmap, mudar a arquitetura ou publicar versões fora do escopo solicitado.
