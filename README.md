# AI Creative Hub Desktop

**Em desenvolvimento — primeira versão funcional**

Um espaço local para organizar clientes, campanhas, referências e decisões e preparar um contexto consistente para usar em diferentes ferramentas de IA.

## Por que existe

Na criação de artes, repetir o briefing em várias ferramentas pode fazer informações importantes se perderem. O AI Creative Hub mantém os dados da marca e o histórico das orientações juntos, por cliente e campanha. A utilidade desta primeira versão ainda será validada no fluxo real de trabalho.

O aplicativo funciona sem API, modelo local, conta ou conexão depois de instalado. Não gera textos ou imagens por inteligência artificial: organiza informações fornecidas pelo usuário com regras explícitas.

## Interface real

Capturas do aplicativo Electron durante o teste automatizado. **Ateliê Aurora é um cliente fictício**; a instalação começa vazia.

![Cliente e campanhas](docs/campanhas.png)

![Contexto revisável e referências](docs/contexto.png)

## O que funciona

- Cadastro e edição de clientes: empresa, público, tom, cores e orientações da marca; busca por nome.
- Referências por cliente: PNG, JPG, WEBP e PDF. Imagens têm prévia ampliada; qualquer referência pode ser salva como cópia. PDFs são consultados no visualizador externo depois de salvar a cópia.
- Campanhas com título, objetivo, público, formato, pedido e status.
- Orientações permanentes do cliente e decisões específicas de campanha.
- Correção e invalidação com motivo e data, mantendo o registro anterior no histórico.
- Contexto determinístico usando a marca, a campanha escolhida e somente decisões válidas. Rascunho editável, salvável e copiável.
- Relação das referências que devem ser anexadas manualmente. **Copiar o texto não envia arquivos para outra IA.**
- Persistência local entre sessões e backup completo, incluindo os bytes dos anexos.
- Importação validada, com confirmação da substituição e cópia local dos dados anteriores.
- Interface em português brasileiro, estados vazios e mensagens de erro.

## Exemplo de uso

1. Cadastre o cliente e preencha as informações da marca.
2. Em **Referências**, adicione logos e exemplos aprovados.
3. Crie uma campanha com o pedido atual.
4. Em **Decisões**, registre regras permanentes ou orientações exclusivas da campanha aberta.
5. Abra **Contexto → Atualizar com dados atuais**. Revise o texto, edite se necessário, salve o rascunho e copie.
6. Na ferramenta escolhida, cole o texto e anexe as referências separadamente.
7. Registre as próximas decisões. Use **Corrigir** ou **Invalidar** quando uma orientação deixar de valer e atualize o contexto novamente.

O rascunho é uma versão revisada manualmente: mudanças na marca ou nas decisões não o substituem automaticamente. O botão de atualização pede confirmação antes de sobrescrever edições.

## Instalar e executar pelo código

Requisitos: Windows, Git e Node.js **22.12 ou superior**. Validado no Windows com Node.js 24.22.1. A primeira instalação precisa de internet para baixar as dependências e o Electron.

```powershell
git clone https://github.com/JuliaRomeira/ai-creative-hub-desktop.git
cd ai-creative-hub-desktop
npm ci
npm start
```

`npm start` verifica o TypeScript, compila a interface e abre o aplicativo desktop. Não é um site hospedado e não exige servidor ou chave de API.

Para gerar a distribuição portátil do Windows:

```powershell
npm run package
```

O executável é gerado em `release/`. Não é assinado digitalmente. A distribuição portátil também guarda os dados no perfil do Windows, não ao lado do executável. Não há atualizador automático.

## Dados e backup

O processo principal do Electron salva `workspace/workspace.json` dentro do diretório `userData`. No Windows, o caminho padrão desta versão é:

```text
%APPDATA%\ai-creative-hub-desktop\workspace\workspace.json
```

Os anexos são copiados para a base em Base64; o arquivo original pode ser movido ou removido. A gravação usa arquivo temporário, sincronização em disco e substituição atômica. Uma cópia `workspace.json.previous` guarda o estado anterior à última gravação. Só uma instância do aplicativo pode gravar na base de cada vez.

**Exportar backup** salva um JSON com clientes, campanhas, decisões, rascunhos e anexos. Guarde uma cópia fora do computador. **Restaurar backup** valida a versão e as relações antes de substituir a base; não mescla dados. Uma cópia `workspace.json.before-restore-*` preserva o estado anterior à restauração, além da cópia da última gravação.

Se a base não puder ser lida, o aplicativo exibe o erro sem reinicializá-la. É possível restaurar um backup pelo menu lateral. Para recuperar uma cópia automática, selecione uma cópia dela com extensão `.json` no importador. A base e os backups **não são criptografados**; proteja esses arquivos como qualquer documento de cliente.

Limites explícitos da primeira versão: **10 MB por referência e 100 MB para a base/backup JSON**, incluindo o aumento de tamanho do Base64. Esta arquitetura prioriza uma base pequena e simples; não é destinada a bibliotecas grandes de mídia.

## Arquitetura

| Camada | Responsabilidade |
| --- | --- |
| React + TypeScript, em `src/` | Formulários, navegação, revisão e montagem determinística do contexto |
| Electron, em `electron/main.cjs` | Janela, diálogos de arquivo, área de transferência e operações autorizadas |
| Preload isolado | Ponte restrita entre a interface e o processo principal |
| `electron/store.cjs` | Esquema versionado com Zod, validação, histórico, arquivos e gravação atômica |
| Vite | Compilação local da interface |
| Node Test + Playwright | Testes de armazenamento e fluxo no Electron real |

A interface não acessa o Node diretamente: usa isolamento de contexto, sandbox e uma ponte limitada. Navegações e novas janelas são bloqueadas; a política de conteúdo não permite conexões externas. A preparação de contexto está separada em `src/context.ts`, permitindo futuras integrações sem simular IA nesta versão.

## Verificação

```powershell
npm run check
npm audit
npm run package
```

O teste end-to-end abre o Electron, preenche a interface e usa diretórios temporários com dados fictícios. As caixas nativas de seleção de arquivo e confirmação são substituídas por respostas determinísticas durante o teste; a leitura, gravação e restauração dos arquivos são reais.

Cobertura da entrega:

- Cadastro e edição de cliente e campanha.
- Orientações permanentes e de campanha, correção e invalidação preservando o histórico.
- Exclusão de decisões antigas do contexto e manutenção das válidas.
- Edição e persistência do rascunho e cópia para a área de transferência do sistema.
- Encerramento e nova abertura do Electron com dados e rascunho preservados.
- Anexo original removido e cópia salva após reinício, com comparação byte a byte.
- Exportação e restauração em perfil vazio, incluindo anexos e histórico.
- Rejeição de backup malformado sem perda da base atual.
- Validação de referências órfãs, identificadores duplicados, versões desconhecidas e limite por anexo.
- Compilação TypeScript e verificação de ausência de rolagem horizontal em janela de 900 × 700.

As capturas em `docs/` são geradas pelo próprio teste. Bancos, backups, dependências, executáveis e resultados temporários não entram no Git.

## Limitações e próximos passos

- Validação de uso cotidiano ainda pendente com o profissional de criação.
- Sem geração de imagem, IA integrada, login, cobrança ou sincronização em nuvem.
- Sem exclusão de clientes, campanhas ou referências nesta primeira versão; decisões podem ser invalidadas.
- O histórico versiona orientações; edições dos campos de cliente e campanha substituem os valores anteriores.
- PDFs não têm visualizador embutido. Use **Salvar cópia** e abra no leitor de PDF.
- Armazenamento JSON com anexos em memória durante o uso, adequado a projetos pequenos dentro dos limites acima.
- Distribuição Windows sem assinatura; macOS e Linux não foram validados.

### Roadmap — ainda não implementado

- IA local opcional.
- Revisão assistida de briefing.
- Busca de contexto relevante.
- Agentes com ferramentas.
- Integrações opcionais por API.
- Evolução do armazenamento e do empacotamento após o uso real.

## Referências técnicas

[Segurança no Electron](https://www.electronjs.org/docs/latest/tutorial/security) · [Testes Electron com Playwright](https://playwright.dev/docs/api/class-electron)
