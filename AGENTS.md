# Coordenação do AI Creative Hub Desktop

## Antes de trabalhar
- Leia este arquivo, o README.md, docs/ESTADO-PROJETO.md e o código relacionado à tarefa, incluindo seus chamadores e testes.
- A migração 0.2.0 já usa Java 17 para regras, validação, contexto e persistência. React/TypeScript apresenta a interface; Electron controla a janela e transporta JSON por stdin/stdout. Não reintroduza regras duplicadas no Node ou na interface.
- A 0.3.0 distribui instalador NSIS e portátil Windows x64 com runtime Temurin 17 fixado, verificado e reduzido por jlink. No aplicativo empacotado, use exclusivamente o runtime incluído; não dependa de Java externo. Preserve appId/nome/userData e dados na desinstalação. Consulte docs/INSTALACAO.md.
- Preserve funcionalidades, contrato JSON version 1, dados e backups existentes. O produto deve funcionar sem API paga, modelo local instalado, conta ou conexão após a instalação.
- Não altere dados pessoais, arquivos sincronizados em sources/, dependências ou design fora da tarefa. Não publique, faça commit ou distribua sem solicitação.

## Coordenador
- Delegue ao desenvolvedor e ao QA quando agentes auxiliares estiverem disponíveis. Caso contrário, informe a limitação e faça desenvolvimento e revisão de QA em etapas separadas na sessão principal.
- Defina a propriedade dos arquivos antes das alterações: desenvolvedor altera aplicação; QA altera testes. O coordenador mantém documentação. Não permita edições simultâneas no mesmo arquivo.
- Encaminhe bugs comprovados ao desenvolvedor; depois solicite ao QA a repetição dos testes afetados e a verificação de regressões.
- Registre estado, verificações, limitações e pendências em docs/ESTADO-PROJETO.md; mantenha relatórios de QA reproduzíveis em docs/QA.md. Não apresente suspeitas como bugs confirmados.

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
