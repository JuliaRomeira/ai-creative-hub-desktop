# Evolução Cliente → Projeto → Arte → Revisão

## Objetivo e limite desta etapa

Este documento registra a análise e a arquitetura implementada para evoluir o AI Creative Hub Desktop a partir da versão 0.3.0. A versão 0.4.0 mantém o funcionamento local, determinístico e sem internet, API paga ou modelo de IA instalado.

Neste plano, **gerar contexto** significa montar um texto completo e copiável com regras explícitas. O aplicativo não gera a imagem final nem o texto criativo por conta própria, pois isso exigiria um mecanismo de geração que está fora das restrições atuais.

Baseline analisada: branch criada sobre `feat/guided-prompts-java-recovery`, que contém a 0.3.0 e a alteração local já validada de prompts orientados ao resultado e recuperação do processo Java. Essa escolha evita regredir funcionalidades que ainda não estão em `main`.

## Arquitetura atual

```text
React/TypeScript
  → preload isolado
  → handlers IPC permitidos no Electron
  → pedidos JSON por linha em stdin/stdout
  → Java 17
      ├─ Main: roteamento dos pedidos
      ├─ WorkspaceService: casos de uso e histórico
      ├─ ContextService: montagem determinística do contexto
      ├─ WorkspaceValidator: integridade e limites
      └─ WorkspaceRepository: JSON local, backup e escrita atômica
```

Não há servidor HTTP, porta aberta, banco de dados, Spring Boot ou regra de negócio duplicada no Electron. O Electron controla a janela, os diálogos nativos, a área de transferência e o ciclo do Java. O Java é a autoridade sobre relações, validação, contexto e persistência.

### Funcionalidades existentes e pontos reutilizáveis

| Área | O que já existe | Reutilização planejada |
| --- | --- | --- |
| Clientes | Criar, editar, buscar e selecionar | Manter o cadastro e a seleção como raiz da navegação |
| Campanhas | Criar, editar, listar por cliente e salvar rascunho | Migrar para Projeto; reutilizar formulários, cartões e seleção |
| Orientações | Criar, corrigir e invalidar, preservando histórico | Manter como regras permanentes do cliente ou específicas do projeto |
| Referências | Copiar PNG, JPG, WEBP e PDF para o JSON e recuperar após reinício | Ampliar o vínculo para cliente, projeto ou arte sem mudar a proteção dos bytes |
| Contexto | Combinar marca, campanha, decisões válidas e referências; quatro tipos de saída | Evoluir a mesma classe para projeto, arte, modelo e revisão |
| Interface | Estados vazios, modais, mensagens, bloqueio durante operações e confirmação de rascunho não salvo | Manter os padrões e acrescentar níveis de navegação, sem criar uma segunda aplicação |
| Electron | Ponte restrita, recuperação do Java, confirmação de importação e diálogos de arquivo | Estender apenas os pedidos necessários; nenhuma regra nova no Node |
| Persistência | Validação integral, bloqueio de segundo escritor, escrita atômica, cópias de recuperação e limite de tamanho | Preservar todas as garantias durante e depois da migração |
| Testes | JUnit, testes da ponte e Playwright com perfis temporários e base legada fictícia | Acrescentar fixtures v1/v2 e fluxos reais de projeto, arte e revisão |

Funcionalidades ainda inexistentes: entidade Projeto separada de Campanha, múltiplas artes por projeto, revisões de arte, modelos reutilizáveis, aprovação de revisão, referências por projeto/arte e consulta do histórico visual de revisões.

## Persistência atual

O arquivo principal é `%APPDATA%\ai-creative-hub-desktop\workspace\workspace.json`. O contrato atual usa `version: 1` e quatro coleções de topo:

```text
Workspace v1
├─ clients[]
├─ campaigns[]  → clientId
├─ decisions[]  → clientId + campaignId opcional
└─ references[] → clientId + bytes em Base64
```

`WorkspaceRepository` lê e valida o documento inteiro antes de usá-lo. Ao salvar, serializa e valida em memória, preserva a base anterior, força a gravação do arquivo temporário no disco e faz substituição atômica. A primeira escrita Java sobre uma base antiga também preserva os bytes originais em `workspace.json.before-java-v020`. A restauração valida o backup antes de criar o snapshot e substituir a base. Apenas abrir o aplicativo não regrava o arquivo.

Os limites atuais são 100 MB para a base e 10 MB para cada referência. A base não é criptografada e mantém anexos em memória; essa limitação permanece válida até uma etapa futura explicitamente aprovada.

## ContextService atual

`ContextService.prepare` recebe `clientId`, `campaignId` e o resultado desejado. Antes de montar o texto, confirma que a campanha pertence ao cliente. Depois inclui:

1. a tarefa correspondente ao resultado desejado;
2. os dados permanentes da marca;
3. somente orientações permanentes válidas daquele cliente;
4. somente a campanha selecionada;
5. somente orientações válidas daquela campanha;
6. referências daquele cliente para anexar manualmente.

Orientações invalidadas, campanhas de outro cliente e decisões de outra campanha são excluídas. Os testes atuais cobrem essa separação e também bloqueiam a interface enquanto uma resposta está pendente, evitando que uma resposta atrasada seja salva em outro cliente.

## Modelo de dados proposto

O próximo contrato será `version: 2`. As coleções continuam no mesmo documento JSON para preservar a arquitetura simples e local.

```text
Client 1 ── N Project 1 ── N Art 1 ── N Revision
   │             │           │              │
   ├── Decision  └── Decision│              └── sourceRevisionId opcional
   │                         │
   └── Reference             └── Reference

Template 1 ── N Art (valores copiados para a arte ao reutilizar)
```

### Entidades e relações

| Entidade | Campos essenciais | Regras |
| --- | --- | --- |
| `Client` | `id`, `name`, `description`, `audience`, `tone`, `colors`, `guidelines` | Mantém o formato e os dados existentes |
| `Project` | `id`, `clientId`, `title`, `objective`, `audience`, `status` | Pertence a exatamente um cliente; substitui Campanha |
| `Art` | `id`, `projectId`, `title`, `format`, `briefing`, `templateId`, `templateName`, `templateInstructions` | Pertence a exatamente um projeto; guarda uma cópia dos valores do modelo usados na criação |
| `Revision` | `id`, `artId`, `sequence`, `sourceRevisionId`, `instructions`, `preserveElements[]`, `modifyElements[]`, `generatedContext`, `createdAt`, `approvedAt` | Sequência única por arte; origem, quando presente, aponta para revisão anterior da mesma arte; aprovação não apaga outras versões |
| `Template` | `id`, `name`, `format`, `instructions` | Reutilizável e sem dados de cliente; duplicar cria novo ID e copia os campos |
| `Decision` | campos atuais, trocando `campaignId` por `projectId` opcional | `projectId` nulo significa regra permanente da marca; correção/invalidação continuam imutáveis no histórico |
| `Reference` | campos atuais + `projectId` e `artId` opcionais | Sempre possui `clientId`; vínculo vazio é do cliente, projeto exige o mesmo cliente e arte exige projeto do mesmo cliente |

Todos os identificadores continuam UUID e são únicos no documento inteiro. Exclusões em cascata não serão introduzidas nesta evolução sem regra explícita de recuperação, pois podem destruir histórico e anexos.

O snapshot de modelo dentro de `Art` é deliberado: editar um modelo no futuro não pode alterar silenciosamente uma arte ou um contexto já criado. `templateId` registra a origem, mas o contexto usa os valores copiados para a arte.

## ContextService proposto

A montagem permanece uma função Java determinística. A entrada passa a ser `clientId`, `projectId`, `artId`, `revisionId` e o resultado desejado.

Ordem obrigatória:

1. validar toda a cadeia de propriedade antes de ler conteúdo;
2. carregar identidade e regras permanentes válidas do cliente;
3. carregar apenas o projeto selecionado e suas decisões válidas;
4. carregar a arte e o snapshot do modelo usado nela;
5. carregar briefing, referências aplicáveis e a revisão selecionada;
6. separar explicitamente elementos a preservar e a modificar;
7. detectar conflito entre a revisão e regras obrigatórias da marca;
8. retornar contexto e conflitos de forma estruturada para a interface.

Um conflito não altera a regra permanente. A interface deve mostrar o conflito e exigir que a instrução da revisão seja corrigida; não deve resolver silenciosamente a favor da instrução mais recente. O contexto só inclui dados das entidades validadas na cadeia selecionada.

O teste crítico desta camada usará dois clientes, dois projetos de um mesmo cliente e artes distintas. A publicação de Instagram deverá manter cores, logotipo e tipografia obrigatórios, alterar apenas a imagem principal e não conter nenhum marcador exclusivo do outro projeto.

## Fluxo de navegação proposto

```text
Início
└─ selecionar ou criar Cliente
   ├─ Marca e regras permanentes
   ├─ Referências do cliente
   └─ Projetos
      └─ selecionar ou criar Projeto
         ├─ Dados e regras do projeto
         ├─ Referências do projeto
         └─ Artes
            └─ criar Arte em branco ou a partir de Modelo
               ├─ Briefing e referências da arte
               ├─ Gerar contexto
               └─ Revisões
                  ├─ nova revisão a partir da atual
                  ├─ nova revisão a partir de versão anterior
                  ├─ preservar / modificar
                  ├─ consultar contexto e instruções anteriores
                  └─ aprovar revisão
```

Modelos ficam em uma área própria do espaço de trabalho. Criar uma arte a partir de um modelo copia seus campos; editar ou duplicar o modelo não modifica artes existentes.

O caminho principal validável será: selecionar cliente → criar projeto → escolher modelo → criar arte → gerar contexto → iniciar revisão. Operações assíncronas continuarão bloqueando navegação conflitante, e rascunhos não salvos continuarão exigindo confirmação antes de sair.

## Migração segura da versão 0.3.0

A 0.3.0 usa JSON v1. A migração será explícita e testada, sem depender do nome da versão do executável.

### Conversão v1 → v2

| Origem v1 | Destino v2 |
| --- | --- |
| `Client` | Mesmo ID e mesmos campos em `Client` |
| `Campaign` | `Project` com o mesmo ID, cliente, título, objetivo, público e status |
| `Campaign.format` e `Campaign.request` | Uma `Art` inicial do projeto, com ID determinístico derivado do ID da campanha, formato e briefing preservados |
| `Campaign.draft` preenchido | Primeira `Revision` da arte, com ID determinístico e `generatedContext` idêntico; data e aprovação ficam ausentes porque a v1 não possui essas informações |
| `Campaign.draft` vazio | Nenhuma revisão fictícia é criada |
| `Decision.campaignId` | `Decision.projectId` com o mesmo valor; IDs e cadeia `replaces` são preservados |
| `Reference` | Mesmo ID e bytes, inicialmente no escopo do cliente (`projectId` e `artId` ausentes) |

O status `Aprovada` de uma campanha será preservado no projeto, mas não marcará automaticamente uma revisão como aprovada. Isso evitará inventar uma decisão que não existe nos dados antigos.

### Ordem e proteção

1. detectar `version: 1` e validar integralmente com as regras v1;
2. converter em memória para v2 com IDs determinísticos;
3. validar integralmente relações, IDs, limites, Base64 e sequências v2;
4. não alterar o arquivo apenas por abrir o aplicativo;
5. antes da primeira escrita v2, preservar os bytes v1 em `workspace.json.before-v2`, sem sobrescrever cópia existente;
6. escrever v2 pelo mesmo mecanismo atômico e manter `workspace.json.previous`;
7. aceitar backup v1 e v2 na restauração; validar e migrar antes de qualquer substituição;
8. manter a cópia `before-restore-*` e falhar sem alterar a base se qualquer validação ou gravação falhar.

Testes usarão cópias fictícias de v1, nunca a base pessoal. Eles compararão todos os campos e bytes de anexos antes/depois, reabrirão o repositório, verificarão restauração e confirmarão que uma migração inválida não produz gravação parcial.

## Alcance das mudanças futuras

| Área | Mudança necessária |
| --- | --- |
| Modelos Java | Adicionar Project, Art, Revision e Template; adaptar Workspace, Decision e Reference |
| Persistência | Leitor v1, migrador v1→v2, validação v2, snapshot antes da primeira escrita e backup compatível |
| Casos de uso | CRUD de projeto/arte/modelo, duplicação de modelo e criação/aprovação de revisão |
| Contexto | Nova cadeia de IDs, preservação/modificação, conflitos e isolamento por projeto |
| Protocolo | Novas operações Java e parâmetros; manter a ponte Electron restrita |
| Tipos React | Espelhar o contrato v2 e respostas estruturadas do contexto |
| Interface | Navegação hierárquica, formulários reais, histórico e estados de erro/carregamento |
| Testes/fixtures | v1 e v2, migração, reinício, isolamento, histórico, arquivos ausentes e fluxos Electron |
| Documentação | README, estado, QA, instalação e limitações verificadas |

## Riscos e controles

| Risco | Gravidade | Controle obrigatório |
| --- | --- | --- |
| Perda ou reserialização incorreta da base v1 | Crítica | Snapshot byte a byte antes da primeira escrita, migração em memória, testes de falha e restauração |
| Mistura de cliente/projeto em contexto ou resposta atrasada | Crítica | Validar a cadeia completa no Java, bloquear navegação durante operação e testar marcadores exclusivos |
| Sobrescrever histórico ao editar arte/revisão | Crítica | Revisões somente por acréscimo; aprovação como metadado; nenhuma atualização destrutiva do conteúdo antigo |
| Editar modelo e alterar arte já existente | Alta | Snapshot do modelo na arte |
| Relações órfãs ou IDs duplicados | Alta | Validação integral antes de qualquer gravação |
| Arquivo de referência ausente | Alta | Manter bytes copiados no armazenamento atual; se o armazenamento mudar, representar indisponibilidade sem impedir abertura |
| Base e anexos próximos de 100 MB | Média | Manter limites atuais, erros claros e testes de borda; não migrar para banco sem necessidade comprovada |
| Complexidade excessiva na interface | Média | Evoluir os padrões existentes e validar o fluxo principal antes de telas secundárias |
| Regressão da recuperação do Java ou do empacotado | Alta | Manter testes da ponte, recuperação e runtime incluído; empacotamento só na etapa final |
| Confundir contexto com arte final gerada | Alta | Nomear o resultado como contexto/prompt e documentar que a geração final permanece externa nas restrições atuais |

## Sequência de implementação e bloqueios

1. Implementar e testar contrato v2, migração e persistência. Não iniciar a interface nova enquanto houver risco crítico de perda ou corrupção.
2. Implementar casos de uso Java e `ContextService` com testes de isolamento e conflito.
3. Integrar protocolo Electron e interface ao modelo real; não usar dados fictícios fora dos testes.
4. Implementar referências por escopo e histórico/aprovação de revisões.
5. Executar regressão completa, migração/reinício, empacotamento e atualizar documentação.

Cada etapa termina com relatório de arquivos, testes, critérios, pendências e commits. Falha crítica mantém a etapa aberta e impede avanço.
