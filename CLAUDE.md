# CLAUDE.md

Guia para o Claude Code (claude.ai/code) ao trabalhar neste repositório. Estas
instruções têm precedência sobre comportamentos padrão. **Leia também os documentos
em `docs/` antes de alterar áreas correspondentes** — eles são a base de conhecimento
detalhada do projeto.

## Projeto

**Family Central** — SaaS de gestão familiar (finanças, tarefas, calendário, compras,
membros). Stack: **Next.js 15 (App Router) + React 19 + Supabase (Postgres/Auth/RLS)**,
Tailwind CSS, PWA (Serwist). Idioma do produto e da documentação: **Português (BR)**.

## Comandos e verificação

```bash
npm run dev          # servidor de desenvolvimento (localhost:3000, Turbopack)
npm run build        # build de produção
npm run lint         # ESLint (next lint)
npm run type-check   # tsc --noEmit
```

**Não há suíte de testes automatizados** (não existe `npm test`). A verificação padrão
antes de concluir qualquer alteração é:

1. `npm run type-check` — deve passar sem erros.
2. `npm run lint` — deve passar sem warnings.
3. Para **lógica financeira/cálculos**, valide o algoritmo com uma simulação numérica
   (ex.: um script Node pontual em `/tmp`) cobrindo casos-limite antes de dar por pronto.
   Cálculos financeiros exigem precisão comprovada, não "parece certo".

## Mapa da documentação

| Vai mexer em… | Leia primeiro |
|---|---|
| Transações, saldo, orçamento, caixinhas, recorrentes, proporções, dízimo | `docs/finance.md` |
| Schema, RLS, funções SQL, criar migration | `docs/database.md` |
| Auth, middleware, clientes Supabase, PWA/offline, navegação, módulos | `docs/architecture.md` |
| Qualquer código (padrões de Server Action, UI, dinheiro/datas) + checklists | `docs/conventions.md` |

## Arquitetura (resumo)

### Diretórios

```
src/
  app/
    (auth)/         # rotas públicas: login, signup, onboarding
    (dashboard)/    # rotas protegidas (layout carrega getFamilyContext)
    api/            # Route Handlers e crons (api/cron/*)
    auth/callback/  # troca de code por sessão (confirmação de e-mail)
  actions/          # Server Actions (mutações) — uma por domínio
  components/
    ui/             # primitivos (Radix + Tailwind + CVA)
    finance/ transactions/ goals/ todos/ shopping/ calendar/ layout/ ...
  lib/
    supabase/       # server.ts, client.ts, middleware.ts, env.ts
    family.ts       # getFamilyContext / getFamilyMembers (server-only)
    utils.ts        # formatCurrency, datas, splitAmount, APP_TIMEZONE
    offline-queue.ts# fila offline (IndexedDB)
  hooks/            # useOnline, usePwaInstall, useRevalidateOnFocus
  types/database.ts # tipos do banco (Row/Insert/Update + Functions)
supabase/migrations/# SQL versionado (0001, 0002, ...)
```

### Clientes Supabase — nunca troque um pelo outro

- `lib/supabase/server.ts` → `createClient()`: Server Components, Server Actions,
  Route Handlers. Usa cookies e **respeita RLS** (identidade do usuário logado).
- `lib/supabase/server.ts` → `createServiceClient()`: **bypassa RLS** (service role).
  Use apenas para operações privilegiadas legítimas (ex.: escrever linhas de outros
  membros numa transação compartilhada, invalidar snapshots de terceiros, seed de
  família). **Sempre valide permissão com o client normal antes.**
- `lib/supabase/client.ts` → `createClient()` (browser, singleton): apenas Client
  Components (`"use client"`).

### Fluxo de dados

- **Leituras**: Server Components chamam o client server diretamente (sem API route).
- **Mutações**: Server Actions em `src/actions/`. Não crie Route Handlers para mutações
  internas.
- **Cron**: `api/cron/*` protegido por `Authorization: Bearer ${CRON_SECRET}`.
- **Real-time**: não é usado hoje. A atualização é por `revalidatePath` + o hook
  `useRevalidateOnFocus` (refaz fetch ao focar a aba).

### Auth & RLS

- Middleware raiz (`middleware.ts`) valida a sessão e redireciona: sem sessão →
  `/login`; logado sem família → `/onboarding`; logado com família em rota de auth →
  `/financeiro`. Rotas `api/cron/*` ficam fora da checagem de sessão.
- **RLS habilitada em todas as tabelas** (políticas em `supabase/migrations/`, escopo
  por `family_id` via `family_members`, ou por `user_id` em dados pessoais como
  `balance_snapshots`). Nunca desabilite RLS. Detalhes e a função
  `current_user_family_id()` em `docs/database.md`.

## Convenções de código (essencial)

### Server Actions — padrão obrigatório

```ts
"use server"
// 1. auth: getFamilyContext() OU supabase.auth.getUser()
// 2. validação: Zod safeParse -> { error: "Dados inválidos" }
// 3. escopo: filtrar por family_id / validar dono
// 4. mutação (client normal; serviceClient só quando justificado)
// 5. efeitos colaterais (proporções, snapshots) — ver docs/finance.md
// 6. revalidatePath(...) das rotas afetadas
// 7. retorno: { ok: true } | { error: string }   (nunca lance para o cliente)
```

### Dinheiro e datas — CRÍTICO (fonte de bugs)

- **Nunca** some dinheiro com floats acumulados quando houver rateio. Use
  `splitAmount()` (`lib/utils.ts`): trabalha em centavos, distribui pelo maior resto e
  garante ≥ 1 centavo por participante.
- **Datas de "hoje/mês atual"**: use `todayLocalISO()`, `currentMonthStart()`,
  `getMonthStart()` de `lib/utils.ts` (fuso `America/Sao_Paulo`). **Nunca** use
  `new Date().toISOString()` para derivar a data do dia — o servidor roda em UTC e a
  data "pula" à noite no Brasil. Em Client Components, use os componentes locais do
  `Date` (o dispositivo já está no fuso do usuário).
- `formatCurrency`, `formatDate*`, `formatMonth` para exibição (locale pt-BR).

### Revalidação

Mutações de transação afetam **home (`/`), `/financeiro`, `/financeiro/familia` e
`/orcamento`**. Use o helper `revalidateFinancePaths()` (em `actions/transactions.ts`),
não revalide só uma rota.

## Regras críticas do domínio financeiro

Estas invariantes já foram fonte de bugs. **Ao mexer em finanças, releia `docs/finance.md`.**

1. **Snapshots de saldo** (`balance_snapshots`) são cache. Qualquer mutação que afete o
   saldo deve marcar `is_dirty = true` (via `invalidateSnapshots`) para o **mês antigo e
   o novo** (a data pode ter mudado, inclusive para trás). Se a mutação toca outros
   usuários (compartilhada), invalide o snapshot **de todos os participantes** — e
   `invalidateSnapshots` usa `serviceClient` porque a RLS de `balance_snapshots` é por
   `user_id`.
2. **Proporções de renda** (`income_proportions`) devem ser recalculadas em qualquer
   mutação de **receita** (criar/editar/excluir), no(s) mês(es) afetado(s). Se o mês
   ficar sem receitas, as proporções são **removidas** (não deixe valores obsoletos).
3. **Movimentações de caixinha** (`transfer_in`/`transfer_out`) são sincronizadas com o
   saldo da meta por trigger. **Não** as edite como transação comum — ajuste pela
   caixinha (`contribute_to_goal` / `update_contribution`).
4. **Receita vs. despesa nos resumos**: receita = `income + transfer_in`; despesa =
   `expense + transfer_out` (para bater com o saldo). Exceção: a **base do dízimo** usa
   apenas `income` genuíno (exclui `transfer_in`).
5. **Totais das telas** vêm de `get_month_summary` / `get_family_month_summary` (leem do
   snapshot quando limpo, senão recomputam). Respeitam o mês selecionado.

## Módulos (mapa rápido)

| Módulo | Action | Página(s) | Tabelas |
|---|---|---|---|
| Transações/finanças | `actions/transactions.ts` | `(dashboard)/financeiro` | `transactions`, `transaction_groups`, `income_proportions`, `balance_snapshots` |
| Orçamento | `actions/budgets.ts` | `(dashboard)/orcamento` | `budgets` |
| Caixinhas (metas) | `actions/goals.ts` | `(dashboard)/enxoval` | `savings_goals`, `savings_contributions` |
| Recorrentes | `actions/recurring.ts` | `financeiro/recorrentes` | `recurring_transactions` |
| Categorias | `actions/categories.ts` | `configuracoes/categorias` | `categories` |
| Tarefas | `actions/todos.ts` | `(dashboard)/tarefas` | `todos` |
| Compras | `actions/shopping.ts` | `(dashboard)/compras` | `shopping_lists`, `shopping_items` |
| Calendário | `actions/events.ts` | `(dashboard)/calendario` | `events` |
| Família/convites | `actions/family.ts` | `configuracoes` | `families`, `family_members`, `family_invites` |
| Comentários | `actions/comments.ts` | (sem UI ainda) | `transaction_comments` |

## Migrations

```bash
supabase db diff --use-migra -f <nome>   # gerar migration a partir do schema local
supabase db push                          # aplicar
supabase db reset                         # resetar banco local
```

- Migrations são **imutáveis após aplicadas**. Para corrigir algo já aplicado, crie uma
  nova migration (`CREATE OR REPLACE FUNCTION`, `ALTER TABLE ... IF NOT EXISTS`, etc.).
- Numere sequencialmente e **sem colisão** (`0007_...` após `0006_...`). Duas migrations
  com o mesmo número quebram a ordem — confira `ls supabase/migrations/` antes de criar.
- Ao adicionar coluna com valor derivado, faça **backfill** na própria migration (senão
  os registros existentes ficam com o default e corrompem cálculos/caches).
- Após criar/alterar funções ou tabelas, atualize `src/types/database.ts` (Row/Insert/
  Update e o bloco `Functions`).

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY   # (fallback: NEXT_PUBLIC_SUPABASE_ANON_KEY)
SUPABASE_SECRET_KEY                    # server-only (fallback: SUPABASE_SERVICE_ROLE_KEY)
CRON_SECRET                            # Bearer dos crons
NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT  # push (parcial)
```

Resolução centralizada em `lib/supabase/env.ts` (com fallbacks para nomes legados).
Chaves `SUPABASE_SECRET_KEY`/service role **nunca** vão para o cliente.
