# Estudando Java no AI Creative Hub

O Java cuida dos dados e das regras; React apresenta os formulários. Você pode estudar e testar o back-end sem abrir a interface.

## Comece pelo projeto Maven

No IntelliJ, abra `backend/pom.xml` como projeto Maven e configure JDK 17 ou superior. Aguarde o carregamento das dependências. Na pasta `backend`, execute:

```powershell
.\mvnw.cmd test
```

Não execute `Main` sem argumentos: ele espera a pasta de dados e mensagens do Electron. Para o uso normal, execute `npm start` na raiz; ele inicia os dois processos.

## Ordem sugerida

1. **[Client.java](../backend/src/main/java/io/github/juliaromeira/creativehub/model/Client.java)** e os outros arquivos de `model/`: representam os dados. `record` é um recurso do Java para declarar objetos de dados com construtor e métodos de acesso. Por exemplo, `client.name()` consulta o nome. Os campos de um record não são alterados por setters; uma edição cria outro objeto. As listas do `Workspace`, porém, são mutáveis.
2. **[ContextService.java](../backend/src/main/java/io/github/juliaromeira/creativehub/service/ContextService.java)**: bom primeiro ponto para praticar. Observe como encontra o cliente e a campanha, filtra decisões válidas e monta uma `String`. `stream().filter(...)` percorre uma coleção selecionando elementos; você pode reproduzir a lógica com `for` como exercício.
3. **[WorkspaceValidator.java](../backend/src/main/java/io/github/juliaromeira/creativehub/service/WorkspaceValidator.java)**: condições, limites, `Set` para IDs únicos, `Map` para localizar registros e exceções para recusar dados inválidos.
4. **[WorkspaceService.java](../backend/src/main/java/io/github/juliaromeira/creativehub/service/WorkspaceService.java)**: casos de uso. A correção invalida a orientação anterior e adiciona outra ligada a ela. A classe recebe um repositório pelo construtor; não precisa saber como o Electron funciona.
5. **[WorkspaceRepository.java](../backend/src/main/java/io/github/juliaromeira/creativehub/persistence/WorkspaceRepository.java)**: arquivos, JSON, `Path`, `try-with-resources`, cópias de segurança e gravação atômica. Estude esta parte depois das regras; uma alteração incorreta pode comprometer dados.
6. **[Main.java](../backend/src/main/java/io/github/juliaromeira/creativehub/Main.java)**: recebe pedidos do Electron, chama os serviços e devolve respostas. É a camada de entrada do back-end, não o lugar para concentrar as regras.

## Siga um exemplo concreto

Ao clicar em **Atualizar com dados atuais**:

1. React chama `window.hub.context(clientId, campaignId)`.
2. O preload envia o pedido ao Electron.
3. O Electron encaminha a operação `context` para o Java pelo stdin.
4. `Main` lê a base com `WorkspaceRepository` e chama `ContextService.prepare`.
5. O texto volta pelo stdout e aparece no campo editável da interface.

Não há modelo de IA nessa sequência. O resultado vem de regras explícitas sobre os dados salvos.

## Primeiro exercício

Abra **[WorkspaceTest.java](../backend/src/test/java/io/github/juliaromeira/creativehub/WorkspaceTest.java)**. Leia `contextDoesNotMixCampaignsOrClients` e explique por que uma regra permanente entra no contexto de outra campanha, mas uma decisão específica não entra.

Depois, em uma branch de estudo, tente acrescentar uma linha ao contexto indicando quantas decisões válidas foram consideradas. Escreva um teste para esse resultado e rode `.\mvnw.cmd test`. Use somente dados fictícios e não altere a persistência como primeiro exercício.

## O que ficou para depois

Spring Boot, API HTTP, banco relacional, IA local e integrações pagas não fazem parte desta versão. A próxima tecnologia deve resolver uma necessidade concreta; você já pode praticar orientação a objetos, coleções, validação, exceções, arquivos e testes com esta base.
