# AI Creative Hub Desktop

**Em desenvolvimento — primeira versão funcional**

Versão **0.4.0**: back-end Java 17, React/TypeScript e Electron, com instalador e portátil Windows e runtime Java reduzido com jlink.

Um espaço local para organizar clientes, projetos, artes, revisões, referências e decisões e preparar um contexto consistente para usar em diferentes ferramentas de IA.

## Por que existe

Na criação de artes, repetir o briefing em várias ferramentas pode fazer informações importantes se perderem. O AI Creative Hub mantém os dados da marca e o histórico das orientações juntos, por cliente e campanha. A utilidade desta primeira versão ainda será validada no fluxo real de trabalho.

O aplicativo funciona sem API, modelo local, conta ou conexão depois de instalado. Ele monta, com regras explícitas, um prompt completo para pedir arte final, roteiro ou um prompt de imagem em outra IA. A imagem ou o texto final são gerados pela ferramenta escolhida pelo usuário.

## Interface real

Capturas do aplicativo Electron durante o teste automatizado. **Ateliê Aurora é um cliente fictício**; a instalação começa vazia.

![Cliente e campanhas](docs/campanhas.png)

![Contexto revisável e referências](docs/contexto.png)

## O que funciona

- Cadastro e edição de clientes: empresa, público, tom, cores e orientações da marca; busca por nome.
- Referências por cliente, projeto ou arte: PNG, JPG, WEBP e PDF. O escopo fica identificado na interface; imagens têm prévia ampliada e qualquer referência pode ser salva como cópia. PDFs são consultados no visualizador externo depois de salvar a cópia.
- Vários projetos por cliente e várias artes por projeto.
- Modelos de arte editáveis, duplicáveis e reutilizáveis sem alterar artes existentes.
- Revisões acrescentadas ao histórico, com instruções e elementos preservados/modificados, origem opcional em versão anterior e aprovação sem sobrescrever outras versões.
- Orientações permanentes do cliente e decisões específicas de projeto.
- Correção e invalidação com motivo e data, mantendo o registro anterior no histórico.
- Prompt determinístico usando marca, projeto, modelo, arte, revisão e somente decisões e referências válidas para o escopo escolhido. O usuário seleciona a arte, a revisão e o tipo de entrega. O resultado é editável, salvável e copiável.
- Revisões indicam elementos a preservar ou modificar. Conflitos explícitos e tentativas de alterar logotipo, cores ou tipografia protegidos são bloqueados antes de gerar o contexto.
- Relação das referências que devem ser anexadas manualmente. **Copiar o texto não envia arquivos para outra IA.**
- Persistência local entre sessões e backup completo, incluindo os bytes dos anexos.
- Importação validada, com confirmação da substituição e cópia local dos dados anteriores.
- Interface em português brasileiro, estados vazios e mensagens de erro.

## Exemplo de uso

1. Cadastre o cliente e preencha as informações da marca.
2. Em **Referências**, adicione logos e exemplos aprovados.
3. Crie um projeto, escolha ou crie um modelo e registre as artes necessárias.
4. Em **Decisões**, registre regras permanentes ou orientações exclusivas do projeto aberto. Em **Modelos e artes**, registre a revisão e o que deve ser preservado ou modificado.
5. Abra **Contexto**, escolha a arte, a revisão e o resultado desejado e clique em **Atualizar com dados atuais**. O aplicativo acrescenta a tarefa para a IA ao briefing. Revise, edite se necessário, salve o rascunho e copie.
6. Na ferramenta escolhida, cole o texto e anexe as referências separadamente.
7. Registre as próximas decisões. Use **Corrigir** ou **Invalidar** quando uma orientação deixar de valer e atualize o contexto novamente.

O rascunho é uma versão revisada manualmente: mudanças na marca ou nas decisões não o substituem automaticamente. O botão de atualização pede confirmação antes de sobrescrever edições.

## Baixar para Windows

Na [página de versões](https://github.com/JuliaRomeira/ai-creative-hub-desktop/releases), procure a versão aprovada e baixe **`AI-Creative-Hub-Setup-0.4.0-x64.exe`**. O pacote inclui interface, back-end e Java próprio: não precisa instalar Java, Node.js, Maven ou configurar variáveis de ambiente. A instalação e o uso não baixam dependências.

Execute o instalador no **Windows 10/11 de 64 bits (x64)**. Ele instala para o usuário atual e cria atalhos na área de trabalho e no menu Iniciar. Abra o aplicativo pelo atalho. Dados e backups ficam no perfil do Windows e são preservados na atualização e na desinstalação normal.

Para usar sem instalar, baixe **`AI-Creative-Hub-Portable-0.4.0-x64.exe`** e abra o arquivo. O portátil também inclui Java e salva os dados no perfil do Windows; não leva a base junto ao copiar somente o executável.

Para atualizar: clique em **Exportar backup**, guarde o JSON fora do computador e feche a versão anterior. Execute o instalador novo ou substitua o portátil. Para recuperar uma base em outro computador, use **Restaurar backup**; a restauração substitui os dados atuais, mantendo uma cópia de recuperação local.

O instalador ainda não é assinado digitalmente: o Windows pode mostrar um aviso de editor desconhecido ou o SmartScreen. Não há atualizador automático. A [página de versões](https://github.com/JuliaRomeira/ai-creative-hub-desktop/releases) contém apenas o que já foi publicado; gerar o instalador localmente não o publica. O portátil **0.2.0 antigo exige Java externo**; a distribuição **0.1.0 não usa Java**.

## Instalar e executar pelo código

Requisitos: Windows, Git, Node.js **22.12 ou superior** e **JDK 17 ou superior** (incluindo `javac`). Validado localmente com Node.js 24.22.1 e JDK 17.0.12. Use uma distribuição JDK atualizada da linha 17 ou superior. Maven é baixado automaticamente pelo wrapper do projeto; não é necessário instalar Maven globalmente. A primeira instalação precisa de internet para baixar dependências, Maven e Electron.

```powershell
git clone https://github.com/JuliaRomeira/ai-creative-hub-desktop.git
cd ai-creative-hub-desktop
npm ci
npm start
```

`npm start` compila o Java em um JAR, verifica o TypeScript, compila a interface e abre o Electron. O Electron inicia `java -jar` e aguarda a resposta de inicialização antes de abrir a janela. Ao fechar o aplicativo, encerra a comunicação e o Java libera o arquivo de bloqueio e sai. Não é um site hospedado e não exige servidor ou chave de API.

Se o Java não for encontrado, confira `java -version` e `javac -version` em um novo terminal. `JAVA_HOME`, quando configurado, deve apontar para a pasta do JDK, não para `bin`. Não é necessário iniciar dois terminais nem abrir o back-end manualmente.

Para gerar o instalador e o portátil em uma máquina de desenvolvimento Windows x64:

```powershell
npm run package
```

Os dois executáveis são gerados em `release/`. O comando compila o projeto e baixa o Eclipse Temurin JDK 17 fixado em `scripts/prepare-runtime.cjs`, verificando SHA-256. `jdeps` identifica os módulos usados pelo JAR e `jlink` gera um runtime reduzido, sem compilador, cabeçalhos, manuais ou símbolos de depuração. O módulo `jdk.unsupported` permite a reflexão usada pelo Gson. Plataforma, arquitetura, versão, licenças e DLLs são conferidas antes do empacotamento em `resources/runtime/`. O Java pessoal do desenvolvedor não é redistribuído. O cliente não executa esse processo.

O aplicativo empacotado sempre usa o Java incluído, mesmo que `JAVA_HOME` esteja inválido ou haja outra versão de Java instalada. Para atualizar o runtime distribuído, revise a publicação oficial, atualize versão, URL e SHA-256 juntos no script e repita os testes e o empacotamento. A atualização do Java incluído é feita por uma nova versão do aplicativo.

## Dados e backup

O Java salva `workspace/workspace.json` no diretório informado pelo Electron, mantendo o mesmo `userData` da versão anterior. No Windows, o caminho padrão é:

```text
%APPDATA%\ai-creative-hub-desktop\workspace\workspace.json
```

Os anexos são copiados para a base em Base64; o arquivo original pode ser movido ou removido. A gravação usa arquivo temporário, sincronização em disco e substituição atômica com Java NIO. Se o sistema de arquivos não permitir substituição atômica, a operação falha em vez de usar uma gravação menos segura. Uma cópia `workspace.json.previous` guarda o estado anterior à última gravação. O Electron limita as instâncias, e o Java também mantém um bloqueio de arquivo para evitar dois escritores na mesma base.

**Exportar backup** salva um JSON com clientes, projetos, artes, modelos, revisões, decisões e anexos. Guarde uma cópia fora do computador. **Restaurar backup** aceita dados v1 da 0.3.0 e dados v2, valida a versão e as relações antes de substituir a base e não mescla dados. Uma cópia `workspace.json.before-restore-*` preserva o estado anterior à restauração, além da cópia da última gravação.

Se a base não puder ser lida, o aplicativo exibe o erro sem reinicializá-la. É possível restaurar um backup pelo menu lateral. Para recuperar uma cópia automática, selecione uma cópia dela com extensão `.json` no importador. A base e os backups **não são criptografados**; proteja esses arquivos como qualquer documento de cliente.

Limites explícitos da primeira versão: **10 MB por referência e 100 MB para a base/backup JSON**, incluindo o aumento de tamanho do Base64. Esta arquitetura prioriza uma base pequena e simples; não é destinada a bibliotecas grandes de mídia.

### Compatibilidade com a versão anterior

O contrato atual usa `version: 2`. Bases `version: 1` da 0.3.0 são validadas e convertidas em memória: campanhas tornam-se projetos, cada campanha ganha uma arte inicial e rascunhos existentes tornam-se a primeira revisão. Apenas abrir a base não a regrava.

Antes da primeira gravação v2 sobre uma base v1, o aplicativo preserva os bytes originais em `workspace.json.before-v2`. IDs criados pela migração são determinísticos, decisões e anexos mantêm seus IDs e referências antigas continuam no escopo do cliente. O status aprovado de uma campanha é preservado no projeto, mas não inventa aprovação de revisão.

Antes da primeira gravação Java sobre um arquivo existente, é criada a cópia **`workspace.json.before-java-v020`**, preservando os bytes originais. Ela não é sobrescrita por edições seguintes. A base fictícia gerada pela implementação 0.1.0 foi usada nos testes de compatibilidade; nenhum banco pessoal foi usado nos testes. Exporte um backup antes de atualizar, feche a versão anterior e não execute versões diferentes simultaneamente sobre a mesma base.

Para recuperar o estado anterior, faça uma cópia do snapshot para outra pasta, acrescente a extensão `.json` e use **Restaurar backup**. Restauração substitui os dados atuais, não mescla as alterações feitas depois.

## Arquitetura

As responsabilidades dos agentes e as regras de preservação de dados estão em [AGENTS.md](AGENTS.md). Consulte também o [estado do projeto e pendências](docs/ESTADO-PROJETO.md) e o [relatório de QA](docs/QA.md) antes de continuar o desenvolvimento.

| Camada | Responsabilidade |
| --- | --- |
| React + TypeScript, em `src/` | Formulários, navegação e revisão do texto retornado pelo Java |
| Electron, em `electron/main.cjs` | Janela, diálogos de arquivo, área de transferência e ciclo de vida do Java |
| Preload isolado | Ponte restrita entre a interface e o processo principal |
| `electron/java-backend.cjs` | Transporte de pedidos e respostas, detecção de falhas e prazo de resposta |
| Java, em `backend/src/main/java/` | Modelos, validação, cadastros, histórico, anexos, persistência e preparação de contexto |
| Gson | Leitura e escrita JSON compatível com os arquivos anteriores |
| Maven Wrapper | Compilação, dependências Java, JUnit e empacotamento do JAR |
| Vite | Compilação local da interface |
| JUnit + Node Test + Playwright | Regras Java, comunicação entre processos e fluxos no Electron real |

A interface não acessa o Node diretamente: usa isolamento de contexto, sandbox e uma ponte limitada. Navegações e novas janelas são bloqueadas; a política de conteúdo não permite conexões externas. A implementação antiga de armazenamento Node e a montagem de contexto em TypeScript foram removidas, evitando regras duplicadas.

```text
React/TypeScript → preload → Electron → stdin/stdout → Java
                                                      ├─ WorkspaceService
                                                      ├─ ContextService
                                                      ├─ WorkspaceValidator
                                                      └─ WorkspaceRepository → JSON local
```

Cada pedido e resposta ocupa uma linha JSON com identificador. O canal são os pipes privados do processo filho: **não há HTTP, porta aberta, API externa ou serviço em nuvem**. Os caminhos escolhidos nos diálogos nativos são encaminhados ao Java, responsável por validar e ler/gravar os arquivos. O back-end executa os pedidos em sequência para evitar gravações concorrentes.

**Por que sem Spring Boot?** O produto atual é local, monousuário e não precisa de servidor HTTP. Java puro com Maven e Gson reduz a configuração e deixa classes, coleções, validação, exceções e persistência visíveis para estudo. Spring Boot faria sentido se surgir uma necessidade concreta de API compartilhada, autenticação ou aplicação web. Ele não é necessário para praticar Java nesta etapa.

## Por onde estudar Java

Abra `backend/pom.xml` no IntelliJ como projeto Maven e selecione JDK 17 ou superior. Siga o [roteiro de estudo Java](docs/ESTUDAR-JAVA.md), começando pelos modelos e pelo `ContextService`, antes de avançar para persistência e comunicação entre processos.

## Verificação

```powershell
npm run check
npm audit
npm run package
```

O teste end-to-end abre o Electron, preenche a interface e usa diretórios temporários com dados fictícios. As caixas nativas de seleção de arquivo e confirmação são substituídas por respostas determinísticas durante o teste; a leitura, gravação e restauração dos arquivos são reais.

`npm run check` executa JUnit, testes da ponte Node/Java e do runtime e os fluxos Electron de cadastro, migração, isolamento, projetos, artes, revisões, referências e recuperação, além da compilação Java/TypeScript. Após empacotar, a suíte pode verificar o portátil real e o executável descompactado, incluindo um fluxo dedicado ao Java incorporado. Sem executável informado, esse fluxo adicional é ignorado explicitamente. Veja [como verificar a distribuição](docs/INSTALACAO.md) e os [resultados de QA](docs/QA.md). Para estudar somente o Java: `npm run test:java` ou, dentro de `backend`, `.\mvnw.cmd test`.

Cobertura da entrega:

- Cadastro e edição de clientes e projetos, com várias artes por projeto.
- Modelos reutilizáveis e revisões com preservação, modificação, origem e aprovação.
- Orientações permanentes e de projeto, correção e invalidação preservando o histórico.
- Exclusão de decisões antigas do contexto e manutenção das válidas.
- Edição e persistência do rascunho e cópia para a área de transferência do sistema.
- Encerramento e nova abertura do Electron com dados e rascunho preservados.
- Anexo original removido e cópia salva após reinício, com comparação byte a byte.
- Exportação e restauração em perfil vazio, incluindo anexos e histórico.
- Rejeição de backup malformado sem perda da base atual.
- Validação de referências órfãs, identificadores duplicados, versões desconhecidas e limite por anexo.
- Compilação TypeScript e verificação de ausência de rolagem horizontal em janela de 900 × 700.
- Base 0.1.0 aberta sem regravação e snapshot original comparado byte a byte após editar pelo Java.
- Separação do contexto por cliente, projeto e arte, preservando regras permanentes.
- Inicialização/encerramento do Java, comunicação concorrente, Java ausente e queda do processo.
- Bloqueio de segundo escritor e proteção contra exportação sobre o arquivo interno.

As capturas em `docs/` são geradas pelo próprio teste. Bancos, backups, dependências, executáveis e resultados temporários não entram no Git.

## Limitações e próximos passos

- Validação de uso cotidiano ainda pendente com o profissional de criação.
- Sem geração de imagem, IA integrada, login, cobrança ou sincronização em nuvem.
- Sem exclusão de clientes, campanhas ou referências nesta primeira versão; decisões podem ser invalidadas.
- O histórico versiona orientações; edições dos campos de cliente e campanha substituem os valores anteriores.
- PDFs não têm visualizador embutido. Use **Salvar cópia** e abra no leitor de PDF.
- Armazenamento JSON com anexos em memória durante o uso, adequado a projetos pequenos dentro dos limites acima.
- Instalador Windows x64 sem assinatura; macOS, Linux e Windows ARM64 não foram validados.
- O Java acompanha os dois pacotes 0.4.0; execução pelo código-fonte continua exigindo JDK instalado. Consulte o relatório de QA para o alcance do teste Windows sem Java externo.
- Bibliotecas grandes de mídia e uso prolongado com base próxima do limite ainda não foram validados. A JVM tem limite de heap de 512 MB e o armazenamento atual mantém o documento em memória.

### Roadmap — ainda não implementado

- IA local opcional.
- Revisão assistida de briefing.
- Busca de contexto relevante.
- Agentes com ferramentas.
- Integrações opcionais por API.
- Evolução do armazenamento e do empacotamento após o uso real.

## Referências técnicas

[Segurança no Electron](https://www.electronjs.org/docs/latest/tutorial/security) · [Testes Electron com Playwright](https://playwright.dev/docs/api/class-electron) · [Maven Wrapper](https://maven.apache.org/tools/wrapper/)
