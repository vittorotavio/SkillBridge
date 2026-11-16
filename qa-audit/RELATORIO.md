# Relatório de Auditoria de QA — SkillBridge

> Branch: `qa-fixes` (criada a partir de `main` @ `d2aba64`) · Fase 1 executada em 16/11/2026
> **Status da Fase 1: concluída** (36 itens). Fase 2 só começa com a ordem "CORRIGIR".

## 1. Resumo executivo

**Estado geral: bom para um protótipo avançado, mas com alguns pontos que um usuário real vai sentir logo.** O código está limpo (build, lint, tipos e os 24 testes passam; nenhum segredo commitado; nenhum `console.log`, `any` ou TODO esquecido) e a maior parte das validações, proteções de rota e mensagens já foi bem pensada. Os problemas que sobram estão principalmente em **o que acontece quando algo dá errado** (rede, deploy, servidor) e em **acessibilidade/contraste**.

| Severidade | Quantidade | Confirmados | Suspeitas |
|---|---|---|---|
| Crítico | 1 | 0 | 1 |
| Alto | 3 | 2 | 1 |
| Médio | 11 | 10 | 1 |
| Baixo | 14 | 13 | 1 |
| Sugestão | 7 | — | — |
| **Total** | **36** | | |

**Os 5 mais urgentes**
1. **QA-002 — Tela totalmente branca depois de cada deploy** (ou com a internet oscilando): quem está com o app aberto e muda de tela vê uma página vazia, sem nenhuma mensagem.
2. **QA-001 — Verificar as regras de acesso do banco (RLS)** _(Suspeita, Crítico se confirmado)_: notas da auditoria anterior registram que um aluno poderia se colocar sozinho no treinamento de qualquer empresa. Não pude testar porque o único banco é o de produção.
3. **QA-003 — Não existe "Esqueci minha senha"**, e os e-mails de suporte são fictícios (QA-012): quem perde a senha perde a conta.
4. **QA-004 — Funções de servidor possivelmente não publicadas** _(Suspeita)_: "Cadastrar mentor", "Adicionar/remover administrador" e "Remover mentor" dependem delas.
5. **QA-005 — O login diz "E-mail ou senha inválidos" quando o problema é a internet ou o servidor**, e **QA-010 — no tema escuro vários textos e links ficam praticamente invisíveis**.

## 2. Ambiente e cobertura

### 2.1 Contexto deduzido (o prompt veio sem contexto)
- **O que é:** SkillBridge, plataforma de upskilling com três painéis — Aluno, Mentor e Empresa — mais site institucional público (README.md).
- **Quem usa:** visitante (vitrine pública, cadastro), aluno (cursos, aulas, certificados, mentoria, dúvidas por chat, vagas, atividades), mentor (agenda, horários, alunos, atividades, dúvidas, histórico, perfil) e administrador de empresa (alunos, mentores, cursos, treinamentos, vagas, relatórios, configurações).
- **Stack:** React 19 + Vite 8 (rolldown) + Tailwind 3 + Zustand 5 + React Router 7; back-end 100% Supabase (Auth + Postgres/RLS + RPCs + Edge Function `company-users` + Realtime). Deploy na Vercel (`vercel.json` com rewrite SPA). Node 24.14 / npm 11.10.
- **Usuários de teste:** o único banco disponível é o projeto Supabase `wwrrwxfcpafybvcvmnck`, usado pelo deploy da Vercel → tratado como **produção** (regra 1). **Nenhuma requisição foi feita a ele** (ver 2.3).

### 2.2 Inventário

**Rotas (src/App.tsx)** — 29 telas + 9 páginas institucionais:

| Perfil | Rotas |
|---|---|
| Público | `/`, `/login`, `/cadastro` (aluno/mentor; aceita `?tipo=mentor&email=&nome=`), `/cadastro/empresa`, `/precos`, `/sobre`, `/carreiras`, `/imprensa`, `/parceiros`, `/ajuda`, `/contato`, `/termos`, `/privacidade`; `*` → redireciona para `/` |
| Aluno | `/aluno`, `/aluno/cursos`, `/aluno/cursos/:courseId`, `/aluno/cursos/:courseId/aulas`, `/aluno/certificados/:certificateId`, `/aluno/atividades`, `/aluno/mentoria`, `/aluno/duvidas`, `/aluno/vagas`, `/aluno/perfil` |
| Empresa | `/empresa`, `/empresa/alunos`, `/empresa/mentores`, `/empresa/cursos`, `/empresa/treinamentos`, `/empresa/vagas`, `/empresa/relatorios`, `/empresa/configuracoes` |
| Mentor | `/mentor`, `/mentor/horarios`, `/mentor/alunos`, `/mentor/atividades`, `/mentor/duvidas`, `/mentor/historico`, `/mentor/perfil` |

**"Endpoints"** (o app não tem API própria; fala direto com o Supabase):
- Auth: `signInWithPassword`, `signUp` (aluno/mentor/empresa via metadados), `signOut`, `getSession`, `onAuthStateChange`.
- Tabelas (PostgREST): profiles, students, mentors, mentor_programs, availability, companies, company_admins, courses, modules, course_programs, programs, jobs, job_programs, job_applications, enrollments, lesson_progress, certificates, enrollment_requests, mentor_invites, mentor_sessions, mentor_session_notes, activity_items, mentor_activities, mentor_messages.
- RPCs: `enroll_in_course`, `apply_to_job`, `book_mentor_session`, `invite_existing_student`, `complete_lesson`, `submit_activity`, `cancel_mentor_session`, `review_mentor_session`, `accept_mentor_invites`, `unlink_company_mentor`, `release_past_session_slots`.
- Edge Function: `company-users` (create_mentor / create_admin / remove_admin). Realtime: INSERT em `mentor_messages`.

**Funcionalidades:** login com aba de tipo de conta; cadastro com confirmação de e-mail; aluno — catálogo com busca/filtro, matrícula, player de aulas, certificado imprimível, atividades (resposta + link), mentoria (buscar, agendar, cancelar, avaliar), chat, vagas, perfil; empresa — aprovar/recusar/vincular alunos, convidar/cadastrar/remover mentores, CRUD de cursos/treinamentos/vagas, relatórios, configurações + administradores; mentor — agenda, horários, anotações de sessão, atividades (atribuir/revisar/excluir), chat, histórico, perfil. **Não existem:** upload de arquivos (capa/logo são URLs), paginação, recuperação de senha.

### 2.3 Como o sistema foi rodado (sem produção)
- `npm ci` na raiz; build/lint/tsc/test do próprio projeto.
- **Supabase falso** (`qa-audit/scripts/mock-supabase.mjs`, sem dependências): imita Auth, PostgREST (filtros, embeds, upsert, `Prefer`), as RPCs usadas e a Edge Function (404 = "não publicada"); dados 100% fictícios em `qa-audit/scripts/fixtures.mjs` (contas `@qa.example.com`, senha `Teste#123`). Permite injetar erro 5xx, lentidão e "requisição que nunca responde", e registra cada chamada (para contar envios duplicados).
- App compilado em **modo produção** e servido com `vite preview` por `qa-audit/scripts/serve-app.mjs`: as variáveis vêm do próprio script (perfil `mock` → `http://127.0.0.1:54399`; perfil `empty` → nenhuma, para testar a falta de `.env`), o `.env` do projeto **nunca é lido**, e o script aborta se o build contiver a URL de um projeto `*.supabase.co`. Saída em `qa-audit/dist-qa-*` — nenhum arquivo do projeto alterado.
- Todo teste do Playwright conta requisições para `*.supabase.co`: **0 em todas as execuções**.
- Ferramentas (só em `qa-audit/package.json`): Playwright 1.65.1 (Chromium local 1248), @axe-core/playwright 4.14, Lighthouse 13.6.
- **Como reproduzir:** `cd qa-audit && npm ci && node scripts/mock-supabase.mjs` (terminal 1), `node scripts/serve-app.mjs mock` (terminal 2), depois `node scripts/<NN>-*.mjs`. Saídas em `qa-audit/logs/`, screenshots em `qa-audit/screenshots/` (ambas ignoradas pelo git, só locais).
- **Limite do método:** o Supabase falso não reproduz RLS, triggers nem a lógica real das RPCs — o que depende disso está em "Não testado" ou marcado como Suspeita.

| Script | O que cobre |
|---|---|
| `10-smoke-telas.mjs` | 29 telas × (desktop 1366 + celular 375) × perfil: screenshot, console, HTTP 4xx/5xx, textos técnicos |
| `20-fluxos-auth-rede.mjs`, `21-fluxos-complemento.mjs`, `22-vitrine-offline-espera.mjs` | login (senha/aba errada, offline, 5xx, sem resposta, duplo clique, Enter), rotas protegidas/de outro perfil/inexistentes, IDs inválidos, logout + voltar, duas abas, F5 com falha, erro/lentidão na carga, chunk indisponível, 3G |
| `30-formularios.mjs`, `31-progresso-apos-editar-curso.mjs` | cadastros, CNPJ, perfis, matrícula, aula, agendamento, entrega, chat, preço, horários, curso, treinamento, vaga, vincular aluno, cadastrar mentor, configurações; textos de 5.000 caracteres, XSS, SQL, emoji; duplo clique |
| `40-responsivo.mjs` | 320/375/414/683 (zoom 200%)/768/1024/1366/1920 em todas as telas; alvos de toque; menu mobile |
| `50-acessibilidade.mjs`, `51-dark-faixa.mjs`, `52-teclado.mjs` | axe-core WCAG 2.2 AA em 32 telas × tema claro/escuro (contraste medido); teclado, foco, modais |
| `60-lighthouse.mjs` | Lighthouse (mobile) em `/`, `/login`, `/cadastro`, `/cadastro/empresa`, `/sobre` |
| `contact-sheet.mjs` | monta pranchas de screenshots para revisão visual (todas as telas foram abertas e olhadas) |

### 2.4 Saúde técnica (1.2) — saídas em `qa-audit/logs/`

| Item | Comando | Resultado |
|---|---|---|
| Instalação | `npm ci` | ✅ 123 pacotes em 56 s; avisa 4 vulnerabilidades |
| Build | `npm run build` | ✅ sem erros nem warnings de código (só o informativo `[PLUGIN_TIMINGS]`); maiores chunks: `react` 228,9 kB (73,2 kB gzip), `supabase` 209,1 kB (54,1 kB gzip), `index` 68 kB |
| Lint | `npm run lint` (oxlint) | ✅ 0 avisos |
| Tipos | `npx tsc -b --force` | ✅ 0 erros (inclui `tests/` via `tsconfig.test.json`) |
| Testes | `npm test` | ✅ 24/24 |
| Auditoria | `npm audit` | ⚠️ 4 (3 altas, 1 moderada), **todas em dependências de desenvolvimento**; `npm audit --omit=dev` → 0 (QA-027) |
| README | seguido ao pé da letra | ✅ funciona, mas exige criar o `.env` à mão (não há `.env.example` — QA-017) |
| Variáveis faltando | build sem `VITE_SUPABASE_*` | ❌ página em branco (QA-017) |
| Segredos | `git grep` + histórico (`git log -p -G`) por JWT, `sb_secret_`, `service_role`, chaves AWS/privadas | ✅ nada; `.env` nunca foi commitado; a chave usada é `sb_publishable_…` (pública por design) |

## 3. Problemas

### 3.1 Tabela resumo

| ID | Título | Severidade | Categoria | Confiança | Status |
|----|--------|------------|-----------|-----------|--------|
| QA-001 | Regras de acesso do banco (RLS) a confirmar: aluno muda o próprio vínculo / conta cria linha de outro papel | Crítico | F/G | Suspeita | |
| QA-002 | Tela totalmente branca quando o arquivo de uma tela não carrega (todo deploy, rede instável) | Alto | E | Confirmado | |
| QA-003 | Não existe "Esqueci minha senha" | Alto | D | Confirmado | |
| QA-004 | Funções de servidor possivelmente não publicadas (company-users, RPCs, SQL de certificados) | Alto | F/D | Suspeita | |
| QA-005 | Login responde "E-mail ou senha inválidos" quando o problema é rede/servidor | Médio | E/D | Confirmado | |
| QA-006 | Mensagens de "Cadastrar mentor" e "Administradores" são descartadas (sempre "Tente novamente") | Médio | D | Confirmado | |
| QA-007 | Requisições sem tempo limite: "Entrando..." e carregamento do painel infinitos | Médio | E | Confirmado | |
| QA-008 | Falha momentânea ao abrir o app (F5) manda o usuário para o login | Médio | E | Confirmado | |
| QA-009 | Progresso do aluno vai para a aula errada depois que a empresa edita o curso | Médio | D | Confirmado | |
| QA-010 | Tema escuro: textos e links quase invisíveis (contraste 1,3–2,0:1) | Médio | A | Confirmado | |
| QA-011 | Contraste insuficiente no tema claro (texto auxiliar, rótulos, botão laranja) | Médio | A/H | Confirmado | |
| QA-012 | E-mails de contato/suporte são fictícios (example.com) | Médio | D | Confirmado | |
| QA-013 | Campos de texto sem limite: nome de 5.000 caracteres quebra telas de outros usuários | Médio | C | Confirmado | |
| QA-014 | Modal não prende o foco do teclado e não o devolve ao fechar | Médio | H | Confirmado | |
| QA-015 | Empresa não enxerga as sessões dos seus mentores ("Mentorias realizadas" sempre 0) | Médio | F/D | Suspeita | |
| QA-016 | Curso em rascunho abre pela URL e oferece "Matricular-se" | Baixo | D/F | Suspeita | |
| QA-017 | Sem variáveis de ambiente o app fica em branco; não há `.env.example` | Baixo | E/J | Confirmado | |
| QA-018 | Rota inexistente volta em silêncio para a home (sem página 404) | Baixo | D | Confirmado | |
| QA-019 | Leitor de tela: erro do login não anunciado, abas sem estado, rótulos ARIA incorretos, sem "pular para o conteúdo" | Baixo | H | Confirmado | |
| QA-020 | Celular: botões do topo de /empresa/mentores cortados; selo vaza em 320 px | Baixo | B | Confirmado | |
| QA-021 | Botões só de ícone menores que 44 px no celular | Baixo | B/H | Confirmado | |
| QA-022 | "Valor por sessão": sem teto, campo não esvazia ("0150"), formato "R$ 150,5" | Baixo | C/J | Confirmado | |
| QA-023 | Curso sem avaliação aparece como "★ 0" na home | Baixo | A | Confirmado | |
| QA-024 | "Recusar" solicitação de aluno sem confirmação, colado ao "Aprovar" | Baixo | D | Confirmado | |
| QA-025 | Capa de curso exibida sem validar o endereço | Baixo | G | Confirmado | |
| QA-026 | SEO/boas práticas: robots.txt devolve HTML, sem meta description, ordem de títulos, fonte bloqueante | Baixo | I | Confirmado | |
| QA-027 | Vulnerabilidades em dependências de desenvolvimento (vite 8.2.2 e outras) | Baixo | G | Confirmado | |
| QA-028 | Senha "123456" é aceita; mensagem de senha fraca promete regra que não existe | Baixo | G/C | Confirmado | |
| QA-029 | Arquivo vazio `SkillBridge` versionado na raiz | Baixo | J | Confirmado | |
| QA-030 | Aula não tem conteúdo; concluir = clicar, e isso emite certificado | Sugestão | D | — | |
| QA-031 | Números e depoimentos fictícios na home | Sugestão | A | — | |
| QA-032 | Link da entrega: aceitar "www..." e explicar o formato | Sugestão | C | — | |
| QA-033 | Horários de mentoria sem fuso horário | Sugestão | J | — | |
| QA-034 | Todos os dados carregados no login, sem paginação | Sugestão | I | — | |
| QA-035 | Termos em inglês na interface ("Dashboard", "skills") | Sugestão | A | — | |
| QA-036 | Esquema do banco não versionado no repositório (sem migrations) | Sugestão | F | — | |

### 3.2 Detalhes

---

#### QA-001 — Regras de acesso do banco (RLS) a confirmar: aluno muda o próprio vínculo / conta cria linha de outro papel
- **Severidade:** Crítico (se confirmado) · **Categoria:** F/G · **Confiança:** Suspeita
- **Onde:** banco Supabase (políticas de `students`, `mentors`, `company_admins`, `companies`); no app, `src/lib/supabase/queries/students.ts:53-65` (`updateStudentRow` grava `company_id`/`program_id`).
- **Origem da suspeita:** as notas da auditoria anterior (20/10/2026) registraram como **pendentes e não aplicadas**: (a) "students can set their own `company_id`/`program_id` (no WITH CHECK, column grants allow it)"; (b) as políticas de INSERT de `students`/`mentors`/`company_admins` só conferem `id = auth.uid()` e `companies_insert_self_serve` é `true`, permitindo que uma conta crie linhas de outro papel e (pela leitura da política) se insira como admin de uma empresa existente. O arquivo de SQL de correção citado (`skillbridge-correcoes-2026-10-20.sql`) **não existe mais** no disco. Não há como confirmar o estado atual sem consultar o banco de produção (regra 1).
- **Passos para verificar** (com autorização, de preferência num banco de teste): logado como um aluno sem empresa, executar no console do navegador `supabase.from('students').update({ company_id: '<id de outra empresa>', program_id: '<id de um treinamento dela>' }).eq('id', '<meu id>')` e recarregar o painel; e `supabase.from('company_admins').insert({ id: '<meu id>', company_id: '<empresa existente>', name: 'x', email: 'x', role: 'x' })`. Leitura sem risco: `select * from pg_policies where tablename in ('students','mentors','company_admins','companies')`.
- **Esperado × Obtido:** esperado: o banco recusa (42501). Obtido: não testado.
- **Impacto se confirmado:** qualquer aluno entra sozinho no treinamento de qualquer empresa e passa a ver cursos, mentores e vagas exclusivos; contas podem virar administradoras de empresas alheias.
- **Sugestão de correção:** `WITH CHECK` nas políticas de UPDATE de `students` impedindo o próprio aluno de alterar `company_id`/`program_id` (ou revogar UPDATE dessas colunas para `authenticated` e fazer o vínculo só por RPC); políticas de INSERT conferindo o `account_type` do perfil e se a empresa já tem admin. **Mexe em banco → na Fase 2 vira "Precisa de decisão".**

---

#### QA-002 — Tela totalmente branca quando o arquivo de uma tela não carrega (todo deploy, rede instável)
- **Severidade:** Alto · **Categoria:** E · **Confiança:** Confirmado (localmente); comportamento na Vercel: Provável
- **Onde:** qualquer navegação para uma tela ainda não aberta; `src/App.tsx:8-40` (todas as telas com `lazy()`), `src/App.tsx:52` (`<Suspense>` sem *error boundary*), `vercel.json` (rewrite `/(.*)` → `/index.html`).
- **Passos para reproduzir:** 1) abra `/` e espere carregar; 2) faça um novo deploy (ou derrube a rede); 3) clique em "Entrar".
- **Esperado × Obtido:** esperado: a tela abre, ou aparece "Não foi possível carregar, tente novamente". Obtido: **página totalmente em branco** (`#root` vazio), sem mensagem nem botão.
- **Evidência:** `logs/21-fluxos-complemento.json` → `chunk-da-tela-indisponivel`: `{"url":"/login","textoVisivel":"","htmlRoot":0,"pageErrors":["Failed to fetch dynamically imported module: …/assets/Login-BpNYwv6J.js"]}`; screenshot `fluxo_chunk-indisponivel.png`. Também `fluxo_login-offline` (1ª execução): só ficar offline antes do pedaço da tela chegar já derruba o app. E: `curl http://127.0.0.1:4173/assets/Nao-Existe-abc123.js` → **200 text/html** (o fallback de SPA devolve o `index.html` no lugar de um JS antigo — o mesmo que o rewrite da Vercel faz depois de um deploy, já que os nomes dos arquivos mudam a cada build).
- **Reteste (1.5):** `scripts/23-reteste-qa002.mjs` — (a) servindo HTML no lugar do JS de `/cadastro` (cenário pós-deploy) → `#root` com 0 caracteres; (b) rede cai ao clicar "Entrar" → `#root` com 0 caracteres. Screenshots `reteste_*.png`.
- **Causa provável:** falha de `import()` dinâmico sem tratamento; nenhum *error boundary*; o rewrite manda HTML para arquivos JS que não existem mais.
- **Sugestão de correção:** *error boundary* em volta das rotas com mensagem + botão "Recarregar"; ouvir `vite:preloadError` e recarregar a página uma vez; no `vercel.json`, não reescrever `/assets/*` (deixar dar 404 de verdade).

---

#### QA-003 — Não existe "Esqueci minha senha"
- **Severidade:** Alto · **Categoria:** D · **Confiança:** Confirmado
- **Onde:** `/login` (`src/pages/auth/Login.tsx:95-111`); busca por `esqueci|recuperar senha|resetPassword|redefinir` em `src/` → nenhum resultado.
- **Passos:** abra `/login` e procure como recuperar a senha.
- **Esperado × Obtido:** esperado: link "Esqueci minha senha" que envia e-mail de redefinição. Obtido: não existe. O único caminho seria o suporte, mas os e-mails de suporte são fictícios (QA-012) — **quem esquece a senha perde a conta**.
- **Evidência:** screenshot `desktop_visitante_-login.png`; grep sem resultados. (Registrado numa sessão anterior como "fora do escopo".)
- **Causa provável:** funcionalidade não implementada.
- **Sugestão de correção:** link + tela que chama `supabase.auth.resetPasswordForEmail()` e rota que recebe o link e chama `updateUser({ password })`. Exige configurar a URL de redirecionamento no Supabase → **Precisa de decisão** na Fase 2 (funcionalidade nova + configuração do servidor).

---

#### QA-004 — Funções de servidor possivelmente não publicadas
- **Severidade:** Alto (se confirmado) · **Categoria:** F/D · **Confiança:** Suspeita
- **Onde:** `src/lib/supabase/companyUsers.ts:23-34` (Edge Function `company-users`), `src/lib/supabase/rpc.ts:56-91` (`accept_mentor_invites`, `unlink_company_mentor`, `release_past_session_slots`), `src/lib/supabase/queries/sessions.ts:54` e `src/types/index.ts:154` (colunas "retrato" do certificado e FK `ON DELETE SET NULL`).
- **Origem da suspeita:** o próprio código prevê que essas peças "ainda não foram aplicadas/publicadas" e trata a ausência (PGRST202 / 404). As notas de 20/10/2026 registram tudo isso como **não aplicado**. Não verificado em produção.
- **Impacto se confirmado:** na empresa, "Cadastrar mentor", "Adicionar administrador", "Remover administrador" e "Remover mentor" **não funcionam**; mentor convidado não é vinculado sozinho ao entrar; horários de sessões passadas continuam presos; **apagar um curso apaga os certificados já emitidos** (o próprio aviso em `CoursesManagement.tsx:466-470` diz isso).
- **Passos para verificar:** `list_edge_functions` e `select proname from pg_proc where proname in ('accept_mentor_invites','unlink_company_mentor','release_past_session_slots')` (leitura) — ou, na interface, empresa → Mentores → "Cadastrar mentor".
- **Sugestão de correção:** publicar a Edge Function e aplicar o SQL revisado. **Mexe em banco/servidor → Precisa de decisão.**

---

#### QA-005 — Login responde "E-mail ou senha inválidos" quando o problema é rede/servidor
- **Severidade:** Médio · **Categoria:** E/D · **Confiança:** Confirmado
- **Onde:** `/login`; `src/lib/supabase/auth.ts:236-242`.
- **Passos:** 1) preencha e-mail e senha **corretos**; 2) desligue a internet (ou servidor com erro 5xx); 3) clique em "Entrar".
- **Esperado × Obtido:** esperado: "Sem conexão com o servidor…". Obtido: **"E-mail ou senha inválidos."** — o usuário acha que errou a senha (e não há como recuperá-la, QA-003).
- **Evidência:** `logs/21-fluxos-complemento.json` → `login-offline: {"erro":"E-mail ou senha inválidos."}`; `logs/20-fluxos-auth-rede.json` → `login-servidor-500: {"erro":"E-mail ou senha inválidos."}`; screenshot `fluxo_login-offline.png`. No `auth-js` (`node_modules/@supabase/auth-js/dist/module/lib/fetch.js:22-43`), falha de rede e status 500–530 viram `AuthRetryableFetchError` **sem `code`**, e `signIn` trata "sem code" como credencial inválida.
- **Causa provável:** `if (error?.code && …)` deixa erros sem código caírem em `INVALID_CREDENTIALS`.
- **Sugestão de correção:** só mostrar "e-mail ou senha inválidos" quando `error.code === 'invalid_credentials'`; para `AuthRetryableFetchError`/`status === 0`/5xx, mensagem de conexão. Teste unitário com um erro sem `code`.

---

#### QA-006 — Mensagens de "Cadastrar mentor" e "Administradores" são descartadas
- **Severidade:** Médio · **Categoria:** D · **Confiança:** Confirmado
- **Onde:** `/empresa/mentores` (Cadastrar mentor), `/empresa/configuracoes` (Adicionar/remover administrador); `src/lib/supabase/companyUsers.ts:26-34` lança `new Error(...)`; `src/lib/errors.ts:34` só repassa erros com `userFacing`.
- **Passos:** Empresa → Gestão de Mentores → "Cadastrar mentor" → preencha → "Cadastrar mentor".
- **Esperado × Obtido:** esperado: a mensagem específica já escrita no código ("Este recurso depende da função… não publicada", "Já existe uma conta com este e-mail", "A senha provisória precisa ter pelo menos 8 caracteres", "Você não pode remover o seu próprio acesso"…). Obtido: sempre **"Não foi possível cadastrar o mentor. Tente novamente."** / **"Não foi possível adicionar o administrador."** — tentar de novo nunca resolve.
- **Evidência:** `logs/30-formularios.json` → `empresa-cadastrar-mentor-funcao-ausente` e `empresa-config-logo-invalido-e-admin`; screenshots `form_empresa-*.png`.
- **Causa provável:** `new Error` em vez de `userError` em `callCompanyUsers`.
- **Sugestão de correção:** usar `userError(...)` nos três `throw`; teste unitário garantindo que `friendlyError` devolve a mensagem.

---

#### QA-007 — Requisições sem tempo limite: carregamento infinito
- **Severidade:** Médio · **Categoria:** E · **Confiança:** Confirmado
- **Onde:** `/login` e qualquer painel; `src/lib/supabaseClient.ts:12` (`createClient` sem `fetch` com timeout).
- **Passos:** servidor que aceita a conexão mas não responde (comum em instabilidade) → clicar em "Entrar", ou recarregar um painel.
- **Esperado × Obtido:** esperado: depois de ~15 s, mensagem "O servidor está demorando…" com opção de tentar de novo. Obtido: botão **"Entrando..." após 25 s**, e no painel **só o indicador girando após 20 s**, sem texto (o navegador só desiste após minutos).
- **Evidência:** `logs/20-fluxos-auth-rede.json` → `login-servidor-sem-resposta: {"botaoApos25s":"Entrando...","erro":null}`, `painel-carga-sem-resposta: {"texto":"","spinner":1}`; screenshots `fluxo_login-servidor-sem-resposta.png`, `fluxo_painel-carga-sem-resposta.png`.
- **Causa provável:** nenhuma requisição tem `AbortSignal.timeout`.
- **Sugestão de correção:** `createClient(url, key, { global: { fetch: (i, init) => fetch(i, { ...init, signal: init?.signal ?? AbortSignal.timeout(20000) }) } })` e tratar o erro de timeout em `friendlyError`.

---

#### QA-008 — Falha momentânea ao abrir o app (F5) manda o usuário para o login
- **Severidade:** Médio · **Categoria:** E · **Confiança:** Confirmado
- **Onde:** qualquer painel ao recarregar; `src/lib/supabase/auth.ts:179-180` ignora o `error` da consulta a `profiles`; `src/store/authStore.ts:39-47, 95-97`.
- **Passos:** logado em `/aluno/perfil`, recarregue a página num momento em que o servidor responde erro (simulado: 500 só em `profiles`).
- **Esperado × Obtido:** esperado: "Não foi possível carregar sua conta — tentar novamente", mantendo a sessão. Obtido: vai para **`/login`** pedindo senha, embora a sessão continue salva no navegador.
- **Evidência:** `logs/21-fluxos-complemento.json` → `f5-com-falha-500-ao-restaurar-conta: {"url":"/login","sessaoContinuaSalvaNoNavegador":true}`; screenshot `fluxo_f5-falha-restaurar-conta.png`.
- **Causa provável:** `const { data: profile } = await …maybeSingle()` descarta o erro; `profile` nulo vira "não logado".
- **Sugestão de correção:** lançar o erro da consulta (`if (error) throw error`) e, no `authStore`, distinguir "sem conta" de "falha ao carregar" (mostrar tela de erro com "Tentar novamente", como o `ProtectedRoute` já faz para os dados).

---

#### QA-009 — Progresso do aluno vai para a aula errada depois que a empresa edita o curso
- **Severidade:** Médio · **Categoria:** D · **Confiança:** Confirmado (lógica da interface; a RPC real usa o mesmo critério por posição, segundo `courses.ts:31`)
- **Onde:** `/empresa/cursos` (editar) → `/aluno/cursos/:id/aulas`; `src/lib/progress.ts:26-37` (aula concluída = `moduleIndex:lessonIndex`), `src/lib/supabase/queries/courses.ts:106-115` (salvar apaga e recria os módulos).
- **Passos:** 1) aluno conclui "Onboarding — aula 1"; 2) empresa edita o curso e insere uma aula nova no topo do módulo; 3) aluno abre o curso.
- **Esperado × Obtido:** esperado: "Onboarding — aula 1" continua concluída e a aula nova aparece pendente. Obtido: **a aula nova aparece concluída e o player pede para refazer "Onboarding — aula 1"** (`AULA 2 DE 3 … Onboarding — aula 1 … Concluir e avançar`). Remover uma aula/módulo do meio desloca tudo da mesma forma; o certificado pode ser emitido sem o aluno ter feito as aulas atuais.
- **Evidência:** `logs/31-progresso-apos-editar-curso.json`; screenshots `progresso_1-*.png`, `progresso_3-player-depois-da-edicao.png`.
- **Causa provável:** aulas sem identificador estável; progresso guardado por posição.
- **Sugestão de correção:** id estável por aula (ou por módulo + índice estável) e progresso referenciando esse id; enquanto isso, avisar a empresa ao editar um curso com alunos matriculados. **Mexe em banco/RPC → Precisa de decisão.**

---

#### QA-010 — Tema escuro: textos e links quase invisíveis
- **Severidade:** Médio · **Categoria:** A · **Confiança:** Confirmado (medido pelo axe)
- **Onde:** login/cadastro (aba selecionada `text-primary-700` sem variante `dark:` — `Login.tsx:85`, `RegisterStudentMentor.tsx:98,108`), links "Cadastre-se/Entrar" (`text-primary-600`), selos de data na agenda do mentor, categorias dos cursos (`text-primary-500`), selos `bg-primary-50 dark:bg-primary-500/10` com texto `primary-600/700`.
- **Passos:** ative o tema escuro (ícone da lua) e abra `/login`, `/mentor`, `/aluno/mentoria`.
- **Esperado × Obtido:** esperado ≥ 4,5:1. Obtido: **#392aa8 sobre #262e4c = 1,31:1** (texto da aba "Aluno" some), **#4b39d6 sobre #262e4c = 1,81:1**, **#4b39d6 sobre #1e293b = 1,98:1** (links), #6c5ce7 sobre #1e293b = 3,01:1 (categorias).
- **Evidência:** `logs/50-axe.json` (regra `color-contrast`, tema `dark`); pranchas `sheet-dark-1.png`, `sheet-dark-2.png`.
- **Causa provável:** classes de cor de texto sem par `dark:`.
- **Sugestão de correção:** adicionar `dark:text-primary-300`/`dark:text-primary-200` (tons já existentes na paleta) nesses pontos — não muda a identidade visual do tema claro.

---

#### QA-011 — Contraste insuficiente no tema claro
- **Severidade:** Médio · **Categoria:** A/H · **Confiança:** Confirmado (medido pelo axe; 367 ocorrências em 54 combinações tela/tema)
- **Onde / medições:**
  - Texto auxiliar `text-slate-400` (#94a3b8) — dicas dos campos ("Mínimo de 6 caracteres."), rótulo "Aluno/Empresa" no topo, rodapé "© 2026…", breadcrumbs: **2,25–2,56:1**.
  - Rótulo "Painel do Aluno/Empresa" `text-primary-400` (#8f80ef): **3,2:1**.
  - **Botão laranja principal ("Criar conta grátis", CTA)** texto branco sobre `#f2622e`: **3,2:1** em todas as telas públicas.
  - `text-slate-500` sobre o fundo #f8f7ff: 4,47:1 (no limite).
- **Passos:** rodar `scripts/50-acessibilidade.mjs`.
- **Esperado × Obtido:** ≥ 4,5:1 para texto normal (3:1 só para texto ≥ 18,66 px negrito).
- **Evidência:** `logs/50-axe.json`; Lighthouse acusa `color-contrast` em todas as páginas públicas (`logs/60-lighthouse.json`).
- **Sugestão de correção:** `slate-400` → `slate-500/600` em textos informativos; `primary-400` → `primary-600`. **O botão laranja é cor da marca → Precisa de decisão** (opções: escurecer o laranja para ~#c2410c, usar texto escuro sobre o laranja, ou aumentar a fonte do botão para ≥ 18,66 px negrito).

---

#### QA-012 — E-mails de contato/suporte são fictícios (example.com)
- **Severidade:** Médio · **Categoria:** D · **Confiança:** Confirmado
- **Onde:** `src/lib/site.ts:5-7` (`contato@`, `imprensa@`, `empresas@skillbridge.example.com`); formulário de `/contato` (`InfoPage.tsx:93-113`) abre o e-mail para esses endereços; `/ajuda`, `/imprensa`, `/termos` exibem os mesmos.
- **Passos:** `/contato` → preencha → "Enviar".
- **Esperado × Obtido:** esperado: a mensagem chega a alguém. Obtido: abre o programa de e-mail endereçado a um **domínio reservado que nunca entrega** (o próprio comentário do código diz "troque pelos reais antes de publicar", e o site já está publicado na Vercel). Mensagens de erro do app dizem "fale com o suporte".
- **Evidência:** código citado; screenshots das páginas institucionais.
- **Sugestão de correção:** trocar pelos endereços reais. **Precisa de decisão** (quais e-mails usar).

---

#### QA-013 — Campos de texto sem limite: nome de 5.000 caracteres quebra telas de outros usuários
- **Severidade:** Médio · **Categoria:** C · **Confiança:** Confirmado
- **Onde:** cadastro `/cadastro` (`RegisterStudentMentor.tsx:117`, sem `maxLength`), `/cadastro/empresa`, títulos de curso/vaga, bio, tema da mentoria etc.; topo do painel `Topbar.tsx:136` (nome sem `truncate`). Limites inconsistentes: perfil do aluno 80 (`Profile.tsx:65`), chat 2.000 (`ChatThread.tsx:83`, corta o texto colado **sem avisar**), cadastro ilimitado.
- **Passos:** cadastre um aluno com nome de 5.000 caracteres (sem espaços), confirme e entre.
- **Esperado × Obtido:** esperado: limite claro (ex.: 80) com aviso. Obtido: cadastro aceito; o painel ganha **51.137 px de rolagem horizontal** e o nome vaza do topo. O mesmo nome aparece nas listas da empresa e do mentor. (XSS no nome foi exibido como texto — ok.)
- **Evidência:** `logs/30-formularios.json` → `cadastro-nome-5000-xss-emoji: {"aceitou":true,"overflowX":51137,"nomeGravado":5074}`; screenshot `form_nome-5000-painel.png`.
- **Sugestão de correção:** `maxLength` coerente nos campos (nome 80, títulos ~120, textos longos ~2.000) + `truncate`/`break-words` onde nomes e títulos aparecem; validar o tamanho também no banco (CHECK) — essa parte é banco → decisão.

---

#### QA-014 — Modal não prende o foco do teclado e não o devolve ao fechar
- **Severidade:** Médio · **Categoria:** H · **Confiança:** Confirmado
- **Onde:** todos os modais (`src/components/ui/Modal.tsx:28-44`), ex.: `/aluno/perfil` → "Editar perfil".
- **Passos:** abra o modal com Enter e aperte Tab várias vezes; depois Esc.
- **Esperado × Obtido:** esperado: o Tab circula dentro do modal; ao fechar, o foco volta ao botão "Editar perfil". Obtido: depois de "Salvar perfil" o foco **sai do modal para a página escondida atrás** (`FORA a "Dashboard"`); ao fechar, o foco vai para "Explorar Cursos" (perde a posição).
- **Evidência:** `logs/52-teclado.json` → `modal.focoSaiuDoModal: true`, `focoDepoisDeFechar: "A \"Explorar Cursos\""`.
- **Sugestão de correção:** prender o foco (Tab/Shift+Tab ciclam entre o primeiro e o último focável) e guardar/restaurar `document.activeElement` ao abrir/fechar.

---

#### QA-015 — Empresa não enxerga as sessões dos seus mentores
- **Severidade:** Médio (se confirmado) · **Categoria:** F/D · **Confiança:** Suspeita
- **Onde:** `/empresa` ("Mentorias realizadas") e `/empresa/relatorios`; política `mentor_sessions_select` no banco.
- **Origem da suspeita:** notas de 16/10/2026 registram que essa política não deixa admins da empresa lerem as sessões dos seus mentores (SQL de correção não aplicado). Com o Supabase falso (sem RLS) o número aparece certo, então a tela não é o problema.
- **Verificar:** logado como admin de uma empresa cujo mentor tem sessão concluída, conferir se "Mentorias realizadas" > 0.
- **Sugestão de correção:** ajustar a política. **Banco → Precisa de decisão.**

---

#### QA-016 — Curso em rascunho abre pela URL e oferece "Matricular-se"
- **Severidade:** Baixo · **Categoria:** D/F · **Confiança:** Suspeita (depende da RLS)
- **Onde:** `/aluno/cursos/:id` de um curso `rascunho`; `src/lib/access.ts:94-97` (`canStudentAccessCourse` não confere `status`), `CourseDetail.tsx:41`.
- **Passos:** logado como aluno, abra a URL de um curso em rascunho.
- **Esperado × Obtido:** esperado: "Curso não encontrado". Obtido (sem RLS): página do curso com **"Matricular-se"** e "0 módulos". Se a RLS de produção esconde rascunhos, o problema não aparece.
- **Evidência:** `logs/20-fluxos-auth-rede.json` → `curso-rascunho`; screenshot `fluxo_curso-rascunho.png`.
- **Sugestão de correção:** `canStudentAccessCourse` exigir `status === 'publicado'` (ou matrícula já existente) — teste unitário em `tests/access-progress.test.ts`.

---

#### QA-017 — Sem variáveis de ambiente o app fica em branco; não há `.env.example`
- **Severidade:** Baixo · **Categoria:** E/J · **Confiança:** Confirmado
- **Onde:** `src/lib/supabaseClient.ts:6-10` (lança erro ao importar); raiz do projeto (sem `.env.example`).
- **Passos:** build sem `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (ex.: esquecer de cadastrar na Vercel) e abrir o site.
- **Esperado × Obtido:** esperado: mensagem visível de configuração. Obtido: **página em branco**; a explicação só aparece no console.
- **Evidência:** `logs/20-fluxos-auth-rede.json` → `sem-env: {"textoVisivel":"","htmlRoot":0,"pageErrors":["Supabase: defina VITE_SUPABASE_URL…"]}`; screenshot `fluxo_sem-env.png`.
- **Sugestão de correção:** criar `.env.example` com as duas variáveis (sem valores) e mostrar uma tela de erro de configuração em vez de lançar no import.

---

#### QA-018 — Rota inexistente volta em silêncio para a home (sem página 404)
- **Severidade:** Baixo · **Categoria:** D · **Confiança:** Confirmado
- **Onde:** `src/App.tsx:268` (`<Route path="*" element={<Navigate to="/" replace />} />`).
- **Passos:** abra `/pagina-que-nao-existe` (ou, logado, `/aluno/xyz`).
- **Esperado × Obtido:** esperado: "Página não encontrada" com link para o início/painel. Obtido: cai na home pública sem explicação — inclusive logado (sai do painel).
- **Evidência:** `logs/20-fluxos-auth-rede.json` → `rota-inexistente`, `rota-inexistente-logado` (`url: "/"`).
- **Sugestão de correção:** página 404 simples com links para o início e, se logado, para o painel.

---

#### QA-019 — Leitor de tela: erro do login não anunciado, abas sem estado, rótulos ARIA incorretos, sem "pular para o conteúdo"
- **Severidade:** Baixo · **Categoria:** H · **Confiança:** Confirmado
- **Onde e evidência:**
  - Erros de formulário em `<p>` sem `role="alert"`/`aria-live` (`Login.tsx:99`, cadastros, modais) e campo sem `aria-invalid` → `logs/52-teclado.json`: `erroAnunciado: null`, `campoMarcadoInvalido: null`.
  - Abas "Aluno/Mentor/Empresa" (`Login.tsx:80-91`, `RegisterStudentMentor.tsx:94-114`) sem `aria-pressed` → `abasTemEstado: false` (o modal de agendamento já usa `aria-pressed` corretamente).
  - Botão de notificações: `aria-label="Notificações (1 não lidas)"` (`Topbar.tsx:94`) — axe `label-content-name-mismatch` em 48 telas/tema; e erro de concordância ("1 não lidas").
  - `aria-label` em `<div>`/`<span>` sem papel nas estrelas de avaliação (`mentor/History.tsx:50`, `mentor/Profile.tsx:175`, `student/Mentorship.tsx:397`) — axe `aria-prohibited-attr`.
  - Sem link "Pular para o conteúdo": o teclado passa por 8 links do topo (público) ou 7 do menu lateral antes do conteúdo em toda página.
- **Sugestão de correção:** `role="alert"` nas mensagens de erro e `aria-invalid` nos campos; `aria-pressed` nas abas; rótulo `Notificações: 1 não lida`/`N não lidas`; `role="img"` nas estrelas; link "Pular para o conteúdo".

---

#### QA-020 — Celular: botões do topo de /empresa/mentores cortados; selo vaza em 320 px
- **Severidade:** Baixo · **Categoria:** B · **Confiança:** Confirmado
- **Onde:** `/empresa/mentores` em 320 e 375 px (+71 px e +16 px de rolagem horizontal; "Cadastrar mentor" cortado); `/empresa` em 320 px (+17 px, selo "Pendente").
- **Evidência:** `logs/40-responsivo.json`; screenshots `resp_empresa_-empresa-mentores_375px.png`, `resp_empresa_-empresa_320px.png`. **Todas as outras 29 telas × 8 larguras (incl. zoom 200%) não têm rolagem horizontal.**
- **Sugestão de correção:** `flex-wrap` no grupo de botões do cabeçalho; `shrink-0`/`flex-wrap` na linha da solicitação.

---

#### QA-021 — Botões só de ícone menores que 44 px no celular
- **Severidade:** Baixo · **Categoria:** B/H · **Confiança:** Confirmado
- **Onde:** "Ativar tema escuro" 40×40, "Abrir menu" 38×38, "Fechar menu" 32×32, ícones sociais do rodapé 36×36 (todas as telas a 375 px).
- **Evidência:** `logs/40-responsivo.json` (`tapTargets`). Passam no mínimo WCAG 2.2 AA (24 px), mas ficam abaixo dos 44 px recomendados.
- **Sugestão de correção:** `h-11 w-11` nesses botões.

---

#### QA-022 — "Valor por sessão": sem teto, campo não esvazia, formato "R$ 150,5"
- **Severidade:** Baixo · **Categoria:** C/J · **Confiança:** Confirmado
- **Onde:** `/mentor/perfil` (`mentor/Profile.tsx:63`: `onChange={(e) => setPrice(Number(e.target.value))}`); exibição em `student/Mentorship.tsx:25`.
- **Passos/Obtido:** apagar o campo o transforma em `0`, então digitar "150" vira **"0150"**; "1e12" vira "012"; o valor **99999999999 foi salvo** sem aviso; R$ 150,50 aparece como **"R$ 150,5/sessão"** (`minimumFractionDigits: 0`).
- **Evidência:** `logs/30-formularios.json` → `mentor-preco`; `node -e "(150.5).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:2})"` → `150,5`.
- **Sugestão de correção:** guardar o texto digitado e converter só ao salvar; `max` razoável (ex.: 10.000); formatar com `{ style: 'currency', currency: 'BRL' }`.

---

#### QA-023 — Curso sem avaliação aparece como "★ 0" na home
- **Severidade:** Baixo · **Categoria:** A · **Confiança:** Confirmado
- **Onde:** `Landing.tsx:178` (`{c.rating}`); o catálogo (`ExploreCourses.tsx:89`) mostra "—" e o detalhe (`CourseDetail.tsx:105`) mostra "Sem avaliações".
- **Evidência:** screenshot `desktop_visitante_home.png` (3º card).
- **Sugestão de correção:** usar o mesmo `course.rating || 'Novo'`/'—' da vitrine.

---

#### QA-024 — "Recusar" solicitação de aluno sem confirmação
- **Severidade:** Baixo · **Categoria:** D · **Confiança:** Confirmado
- **Onde:** `/empresa/alunos` (`StudentsManagement.tsx:173-178`), botão ao lado de "Aprovar".
- **Esperado × Obtido:** esperado: confirmação (ou desfazer). Obtido: um clique recusa na hora e a solicitação sai da lista de ações.
- **Sugestão de correção:** `ConfirmDialog` (o componente já existe e é usado em outras exclusões).

---

#### QA-025 — Capa de curso exibida sem validar o endereço
- **Severidade:** Baixo · **Categoria:** G · **Confiança:** Confirmado
- **Onde:** `src/components/ui/CourseCover.tsx:34` (`<img src={coverUrl}>`); a validação `safeHttpUrl` só existe no formulário (`CoursesManagement.tsx:126-131`). Logo e link de entrega são validados também na exibição.
- **Evidência:** curso de teste com capa `javascript:alert(1)` chegou ao `<img>` (console: `net::ERR_UNKNOWN_URL_SCHEME` em `/` e `/aluno/cursos`, `logs/10-smoke-telas.json`). Navegadores modernos não executam `javascript:` em `<img>`, por isso Baixo — é defesa em profundidade contra dados gravados por fora do formulário.
- **Sugestão de correção:** `src={safeHttpUrl(coverUrl)}` no `CourseCover` (cai no placeholder se inválido).

---

#### QA-026 — SEO/boas práticas
- **Severidade:** Baixo · **Categoria:** I · **Confiança:** Confirmado
- **Lighthouse (mobile):** Performance 86–97, Acessibilidade 94–95, Boas práticas 100 (58 em `/` só por artefatos locais: http e o curso de teste), **SEO 83** em todas.
- **Falhas:** `/robots.txt` devolve o HTML do app (não existe em `public/`, cai no fallback de SPA → "32 errors"); sem `<meta name="description">` em `index.html`; `heading-order` (títulos pulam níveis); `unsized-images` (logo sem `width/height`); fonte do Google bloqueando a renderização (~0,6–1 s estimados); TBT 160–560 ms.
- **Evidência:** `logs/60-lighthouse.json`; `curl /robots.txt` → `Content-Type: text/html`.
- **Sugestão de correção:** `public/robots.txt`, meta description, `width/height` no logo, `font-display`/preload da fonte; ordem dos títulos.

---

#### QA-027 — Vulnerabilidades em dependências de desenvolvimento
- **Severidade:** Baixo · **Categoria:** G · **Confiança:** Confirmado
- **Onde:** `vite` 8.2.0–8.2.2 (6 avisos, incluindo execução de comando via `launch-editor` **no Windows**, que é o ambiente desta equipe), `postcss` ≤ 8.5.22, `source-map-js`, `postcss-selector-parser`. Nada vai para o build de produção (`npm audit --omit=dev` → 0).
- **Evidência:** `logs/06-audit.log`.
- **Sugestão de correção:** `npm audit fix` (atualizações compatíveis, sem mudar versões maiores) + rodar build/testes.

---

#### QA-028 — Senha "123456" aceita; mensagem promete regra inexistente
- **Severidade:** Baixo · **Categoria:** G/C · **Confiança:** Confirmado (no cliente; a regra do servidor é configuração do Supabase, não verificada)
- **Onde:** cadastros (`minLength={6}`); `src/lib/errors.ts:16` diz "Use pelo menos 6 caracteres, misturando letras e números", mas nada exige isso. Não há campo de confirmação de senha nem botão "mostrar senha".
- **Evidência:** `logs/30-formularios.json` → `cadastro-senha-fraca-123456: {"aceitou":true}`.
- **Sugestão de correção:** exigir ao menos 8 caracteres com letras e números (no cliente e na configuração de senha do Supabase — esta parte é decisão) e alinhar a mensagem.

---

#### QA-029 — Arquivo vazio `SkillBridge` versionado na raiz
- **Severidade:** Baixo · **Categoria:** J · **Confiança:** Confirmado
- **Onde:** `/SkillBridge` (0 bytes, no git desde `9d22e20`, 16/09/2026). Não é usado por nada.
- **Sugestão de correção:** remover do repositório.

---

#### QA-030 — Aula não tem conteúdo; concluir = clicar, e isso emite certificado _(Sugestão)_
- **Onde:** `/aluno/cursos/:id/aulas` — a "aula" é só o título + "Estude o material desta aula com …"; o ícone de play não toca nada. Clicar "Concluir e avançar" em todas emite certificado.
- **Evidência:** screenshot `desktop_aluno_-aluno-cursos-…-aulas.png`.
- **Sugestão:** campo de conteúdo/vídeo por aula (decisão de produto). **Precisa de decisão.**

#### QA-031 — Números e depoimentos fictícios na home _(Sugestão)_
- "38 mil+ alunos ativos", "95+ empresas parceiras", "4.9/5" e três depoimentos com nomes são fixos no código; só o rodapé diz "dados fictícios para demonstração". **Precisa de decisão** (texto importante).

#### QA-032 — Link da entrega: aceitar "www..." e explicar o formato _(Sugestão)_
- `/aluno/atividades` → "Resolver": `www.github.com/fulano` é recusado com a mensagem nativa "Insira um URL." (`logs/30-formularios.json`). Completar `https://` automaticamente ou explicar.

#### QA-033 — Horários de mentoria sem fuso horário _(Sugestão)_
- `availability.start_time`/`mentor_sessions.date` são texto local sem fuso; `todayISO()` usa o relógio do aparelho. Mentor em Manaus e aluno em São Paulo veem o mesmo "14:00". Exibir "horário de Brasília" ou guardar com fuso.

#### QA-034 — Todos os dados carregados no login, sem paginação _(Sugestão)_
- `dataStore.fetchAll` (`src/store/dataStore.ts:273-294`) faz 15 consultas completas a cada login e recarrega fatias inteiras após cada ação. Hoje é rápido; não escala com volume (mensagens, alunos de empresas grandes).

#### QA-035 — Termos em inglês na interface _(Sugestão)_
- "Dashboard" no menu (`StudentSidebar.tsx:8`, `CompanySidebar.tsx:5`) e título "Dashboard da Empresa"; "Especialidades / skills". Sugerir "Início"/"Painel", "Especialidades".

#### QA-036 — Esquema do banco não versionado (sem migrations) _(Sugestão)_
- Não há pasta `supabase/` nem SQL no repositório: não dá para recriar o banco do zero, nem montar um ambiente de teste, nem revisar mudanças de RLS por PR. (É coerente com a prática atual de revisar SQL fora do repositório — **Precisa de decisão**.) Foi por isso que esta auditoria teve de usar um Supabase falso.

## 4. Não testado

| O quê | Por quê |
|---|---|
| **RLS/permissões reais** (trocar IDs na URL/requisição, token de outro usuário, aluno entrando na área de empresa via API) | Único banco é o de produção (regra 1). A interface protege as rotas (testado), mas a proteção real é a RLS. Ver QA-001, QA-015, QA-016. |
| Lógica real das RPCs, triggers, contadores (`enrolled_count`, `applications_count`), cascatas ao excluir | Idem. O Supabase falso só imita o formato das respostas. |
| Edge Function `company-users` | Idem (QA-004). |
| Migrations "do zero" | Não existem no repositório (QA-036). |
| Chat em tempo real (Realtime) | O Supabase falso não implementa WebSocket; os erros de WebSocket no console dos testes são desse mock. |
| Confirmação de e-mail real, limite de tentativas de login (rate limit), regras de senha do servidor | Dependem do Supabase Auth de produção. |
| Upload de arquivos | Não existe funcionalidade de upload (capa/logo são URLs). |
| Busca/filtro/ordenação com muitos registros, paginação | Não há paginação; testados só com os dados fictícios (poucos registros). |
| Lighthouse nas telas logadas | O Lighthouse limpa a sessão; telas logadas foram avaliadas por axe, responsividade e tempo de carga no Playwright. |
| Firefox e Safari/WebKit | Só Chromium foi usado (as versões locais do Firefox/WebKit não batem com o Playwright 1.65). |
| Autopreenchimento do navegador; impressão do certificado (`window.print`) | Não automatizável de forma confiável em modo headless. |
| Comportamento real no domínio da Vercel | Testado com `vite preview` local, que tem o mesmo fallback de SPA (QA-002 marcado como "Provável" para a Vercel). |

## 5. O que está funcionando bem (não mexer na correção)

- **Segurança básica:** nenhum segredo no repositório nem no histórico; só a chave publishable no front; **todo conteúdo de usuário é escapado** (XSS em nome, curso, mensagem, entrega e vaga apareceu como texto); `safeHttpUrl` em links de entrega e logo; nenhum `dangerouslySetInnerHTML`/`innerHTML`/`eval`; logout limpa o `localStorage` e o botão Voltar não reabre o painel; logout numa aba derruba a outra.
- **Proteção contra envio duplo:** login, cadastro, matrícula, concluir aula, agendar mentoria, chat (Enter duplo), horário e curso → **1 requisição cada** no duplo clique.
- **Rotas:** rota protegida sem login vai para o login e **volta para a página pedida** depois; perfil errado é levado ao próprio painel; IDs inexistentes mostram "não encontrado" com texto claro; curso de outra empresa mostra "Curso exclusivo de treinamento corporativo"; certificado de outro aluno não abre.
- **Validações bem feitas:** nome só com espaços, e-mail duplicado (mensagem clara), CNPJ (dígito verificador, máscara, duplicado com mensagem específica), datas do treinamento, horário de fim antes do início e sobreposição, carga horária, curso publicado sem aula, capa/logo não-http, vaga sem treinamento, chat sem texto.
- **Estados:** erro na carga do painel mostra "Não foi possível carregar o painel" + "Tentar novamente" (que funciona); vitrine pública mostra mensagem quando o catálogo não carrega (após as novas tentativas automáticas); estados vazios com textos úteis em todas as listas.
- **Visual:** paleta e tipografia consistentes no tema claro; 29 telas sem rolagem horizontal em 320–1920 px e no zoom de 200% (exceto QA-020); menu mobile funciona em todas as telas; foco visível em todos os elementos testados; Esc fecha modais e menus.
- **Qualidade técnica:** build/lint/tipos/testes verdes; divisão de código por tela; Lighthouse Performance 86–97; código sem `console.log`, `any`, TODO ou `catch` vazio; mensagens técnicas do banco nunca chegam à tela (`friendlyError`).

## 6. Resultados da correção

### Antes
_(preenchido no início da Fase 2)_

### Depois
_(preenchido no fim da Fase 2)_
