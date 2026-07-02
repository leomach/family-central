# Arquitetura técnica

Complementa o resumo do `CLAUDE.md`. Foco em auth, clientes Supabase, PWA/offline,
navegação e o mapa dos módulos não-financeiros.

## Autenticação e sessão

- **Middleware raiz** (`middleware.ts`): cria um `createServerClient` por requisição,
  renova cookies (request ↔ response) e redireciona:
  - sem sessão + rota não pública → `/login`;
  - logado em `/login|/signup` sem família → `/onboarding`; com família → `/financeiro`;
  - logado em rota privada sem família → `/onboarding`.
  - Rotas públicas: `/login`, `/signup`, `/onboarding`, `/invite/[code]`, `/offline`,
    `/auth/callback`. `api/cron/*` e `api/icon/*` ficam fora da checagem de sessão.
  - Matcher exclui assets e `sw.js`/`workbox-*`.
- **Signup** (`(auth)/signup`): `supabase.auth.signUp({ data: { full_name } })`. Com
  confirmação de e-mail habilitada, `data.session` vem `null` → UI de "verifique seu
  e-mail". O link chega em `/auth/callback?code=...&next=/onboarding`.
- **Callback** (`app/auth/callback/route.ts`): `exchangeCodeForSession(code)` → redireciona
  para `next` (ou `/onboarding`).
- **Login** (`(auth)/login`): `signInWithPassword`; no sucesso, `router.push("/financeiro")`
  + `router.refresh()`.

## Clientes Supabase

| Client | Arquivo | Contexto | RLS |
|---|---|---|---|
| `createClient()` server | `lib/supabase/server.ts` | Server Components/Actions/Handlers (cookies) | respeita |
| `createServiceClient()` | `lib/supabase/server.ts` | operações privilegiadas (service role, `persistSession:false`) | **bypassa** |
| `createClient()` browser | `lib/supabase/client.ts` | Client Components (singleton) | respeita |

- Chaves resolvidas em `lib/supabase/env.ts` com fallbacks legados
  (`_PUBLISHABLE_KEY`→`_ANON_KEY`, `SUPABASE_SECRET_KEY`→`SUPABASE_SERVICE_ROLE_KEY`).
- `setAll()` no server é envolto em try/catch (Server Components têm cookies read-only).
- **Regra**: valide permissão com o client normal (RLS) **antes** de usar
  `serviceClient`. Nunca exponha a service key ao cliente.

## Contexto de família (`lib/family.ts`, server-only)

- `getFamilyContext()` → `{ userId, familyId, familyName, role, userName, userEmail }`.
  Sem sessão → redireciona `/login`; sem `family_members` → `/onboarding`. Chamado nos
  layouts/páginas protegidas.
- `getFamilyMembers(familyId)` → lista com nome/e-mail. Usa `serviceClient` +
  `auth.admin.getUserById` por membro (N+1 — evite chamar em caminhos quentes; considere
  cache se crescer).

## Onboarding e convites (`actions/family.ts`)

- `createFamily(name)`: valida sessão → cria `families` + `family_members` (owner) via
  `serviceClient` (com rollback se o member falhar) → semeia categorias padrão →
  `revalidatePath("/")`.
- `joinFamily(code)`: valida convite (8 chars, não usado, não expirado) e que o usuário
  não está em outra família → adiciona como `member` → marca convite como usado.
- `generateInvite(familyId)`: só owner/admin; gera código (alfabeto sem caracteres
  ambíguos), validade 7 dias.

## Layouts e navegação

- **Root** (`app/layout.tsx`): `lang="pt-BR"`, tema escuro, fonte Geist, registra o
  service worker, monta `<OfflineQueueSync />` e `<Toaster />`, define metadata/manifest.
- **Dashboard** (`(dashboard)/layout.tsx`): carrega `getFamilyContext()`, renderiza
  `Sidebar` (desktop) + `MobileNav` (mobile, fixa embaixo) + banners (offline, instalar
  PWA). Usa `h-dvh`.
- Navegação em `components/layout/` (`sidebar.tsx`, `mobile-nav.tsx`): Início,
  Finanças, Compras, Tarefas + "Mais" (Metas/`enxoval`, Orçamento, Calendário,
  Configurações). Ativo via `usePathname()`.

## PWA / offline

- **Service worker**: `src/sw.ts` (Serwist) → compilado para `public/sw.js`
  (`next.config.ts`, desativado em dev). Estratégias: CacheFirst (fontes, ícones,
  imagens), NetworkFirst (Supabase REST/Auth e navegação, com timeout), StaleWhileRevalidate
  (manifest, RSC), fallback `/offline`. Listeners `sync` (`flush-queue`), `push`,
  `notificationclick`.
- **Fila offline** (`lib/offline-queue.ts`, client-only): IndexedDB via `idb-keyval`.
  `enqueue({ kind, payload })` para `transaction | todo | shopping_item`; `flushQueue()`
  reexecuta as actions (dynamic import). Disparo: evento `online`, `visibilitychange`,
  background sync (com fallback para iOS Safari, que não suporta) e um poll de ~2 min.
  `components/offline/offline-queue-sync.tsx` orquestra; `pending-queue-badge.tsx` mostra a
  contagem.
- **Padrão nos formulários**: se `!navigator.onLine`, `enqueue` e feedback "salvo
  offline"; se online e a rede cair no meio, cai para a fila (ver `transaction-form.tsx`).

## Push notifications (parcial)

Tabela `push_subscriptions` e listeners no SW existem; `web-push` e chaves VAPID
previstas em env. A UI de subscribe/envio ainda não está acoplada — trate como
**infraestrutura parcial**.

## API routes / cron

- `api/cron/close-month` (`0 3 2 * *`): materializa snapshots do mês anterior.
- `api/cron/generate-recurring` (`0 6 * * *`): chama `generate_recurring_transactions`.
- `api/icon/[size]` (edge): gera ícone PWA dinâmico (`ImageResponse`).
- Crons agendados em `vercel.json`; autenticados por `Authorization: Bearer ${CRON_SECRET}`.

## Módulos não-financeiros (padrão comum)

Todos seguem: Server Component busca dados (escopo por `family_id`) → Client Component
com `useTransition` + `router.refresh()` (updates otimistas em tarefas/compras) → Server
Action (Zod + `getFamilyContext` + mutação + `revalidatePath`). **Sem real-time**;
atualização por `useRevalidateOnFocus` (refaz fetch ao focar).

- **Tarefas** (`todos`): `actions/todos.ts`, `tarefas/page.tsx`, `components/todos/`.
- **Compras** (`shopping_lists`/`items`): `actions/shopping.ts`, `compras/` e
  `compras/[id]/`, `components/shopping/`. `archiveList` é soft delete.
- **Calendário** (`events`): `actions/events.ts`, `calendario/page.tsx`,
  `components/calendar/`. `recurring` é apenas um rótulo (não gera instâncias).
- **Comentários** (`transaction_comments`): `actions/comments.ts` pronta, **sem UI** ainda.

## Hooks e UI

- Hooks (`src/hooks/`): `useOnline`, `usePwaInstall` (com dismiss TTL e detecção iOS),
  `useRevalidateOnFocus` (throttle 5s; opcional poll).
- UI (`src/components/ui/`): primitivos Radix + Tailwind + CVA (`Button`, `Input`,
  `Card`, `Dialog`, `Select`, `Checkbox`, `Label`, `Tabs`, `Progress`, `Badge`,
  `Separator`, `ConfirmDialog`, `Toaster`). Estilo via `cn()` (clsx + tailwind-merge);
  cores semânticas: `income`, `expense`, `primary`, `destructive`, etc. Toast é função
  global `toast({ title, description, variant })`, não hook.
