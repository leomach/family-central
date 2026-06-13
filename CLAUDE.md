# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Family Central** — SaaS de gestão familiar (tarefas, calendário, finanças, membros). Stack: Next.js 15 (App Router) + Supabase.

## Commands

```bash
npm run dev          # servidor de desenvolvimento (localhost:3000)
npm run build        # build de produção
npm run lint         # ESLint
npm run type-check   # tsc --noEmit
npm test             # Jest / Vitest
npm test -- --testPathPattern=<file>   # rodar um único teste
```

## Architecture

### Directory layout

```
src/
  app/              # Next.js App Router — rotas e layouts
    (auth)/         # grupo de rotas públicas (login, signup)
    (dashboard)/    # grupo de rotas protegidas
    api/            # Route Handlers
  components/       # componentes React reutilizáveis
    ui/             # primitivos (Button, Input, Modal…)
  lib/
    supabase/       # clientes Supabase (server.ts / client.ts / middleware.ts)
    utils/          # helpers genéricos
  hooks/            # React hooks customizados
  types/            # tipos TypeScript globais
  actions/          # Server Actions (mutações de dados)
```

### Supabase

Dois clientes distintos — nunca trocar um pelo outro:
- `lib/supabase/server.ts` — Server Components, Server Actions, Route Handlers (usa `cookies()` do Next.js)
- `lib/supabase/client.ts` — Client Components (singleton via `createBrowserClient`)

Autenticação é gerenciada pelo middleware (`middleware.ts` na raiz) que chama `supabase.auth.getSession()` e redireciona rotas protegidas.

### Data flow

- **Leituras** em Server Components: chamam o client server diretamente, sem API route.
- **Mutações**: Server Actions em `src/actions/` — evitar Route Handlers para mutations internas.
- **Real-time**: subscriptions Supabase apenas em Client Components, com `useEffect` + `supabase.channel()`.

### Autenticação

Row Level Security (RLS) habilitada em todas as tabelas. Políticas definidas em `supabase/migrations/`. Nunca desabilitar RLS em produção.

Cada família tem um `family_id`; membros têm `role` (owner | admin | member). Políticas filtram por `auth.uid()` + join com `family_members`.

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   # somente server-side, nunca expor ao cliente
```

### Migrations

```bash
supabase db diff --use-migra -f <nome>   # gerar migration
supabase db push                          # aplicar em dev
supabase db reset                         # resetar banco local
```
