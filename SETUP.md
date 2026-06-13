# SETUP — O que você precisa fazer antes de rodar

O código está pronto. Siga estes passos na ordem.

---

## 1. Instalar dependências

```bash
npm install
```

---

## 2. Criar projeto no Supabase
Ihno1gk0lkZZUJ8Z

1. Acesse [supabase.com](https://supabase.com) → **New project**
2. Vá em **Settings → API Keys** e anote:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **Publishable key** (`sb_publishable_...`) — usada no browser e em SSR autenticado
   - **Secret key** (`sb_secret_...`) — server-only, usada para split e cron jobs

> Se você ainda vê "anon key" e "service_role key" em vez das novas, clique em **Switch to new API keys** no painel.

> Em **Settings → Auth → Email**, desabilite "Confirm email" se quiser pular a confirmação por e-mail no MVP. Para produção, deixe habilitado.

---

## 3. Criar o arquivo `.env.local`

```bash
cp .env.local.example .env.local
```

Preencha com as chaves do passo 2:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
CRON_SECRET=<será gerado no passo 6>
```

> **Nunca comite o `.env.local`** — já está no `.gitignore`.

---

## 4. Rodar as migrations no banco

No painel do Supabase → **SQL Editor** → execute **na ordem**:

1. `supabase/migrations/0001_initial.sql` — tabelas principais (família, transações, snapshots, caixinhas)
2. `supabase/migrations/0002_modules.sql` — módulos extras (orçamento, recorrentes, listas, tarefas, calendário, comentários)
3. `supabase/migrations/0003_fix_rls_recursion.sql` — corrige recursão em RLS (obrigatório)

Cada arquivo cria suas tabelas, índices, triggers, funções RPC e políticas RLS.

> Se você já rodou 0001 e 0002 antes e está vendo o erro `infinite recursion detected in policy for relation "family_members"`, rode APENAS a migration 0003 — ela apaga as políticas antigas e cria as novas sem recursão.

---

## 5. (Opcional) Configurar Push Notifications

Gere as chaves VAPID:

```bash
npx web-push generate-vapid-keys
```

Adicione ao `.env.local`:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<chave publica gerada>
VAPID_PRIVATE_KEY=<chave privada gerada>
VAPID_SUBJECT=mailto:voce@seudominio.com
```

Sem isso o app funciona normalmente — apenas push notifications ficam desabilitadas.

---

## 6. Gerar secret do Cron

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Cole o resultado no `.env.local` como `CRON_SECRET=...`. Configure o **mesmo valor** na Vercel em **Settings → Environment Variables**.

---

## 7. Gerar ícones PWA

Coloque na pasta `public/icons/`:

| Arquivo | Tamanho | Descrição |
|---|---|---|
| `icon-192.png` | 192×192 | Ícone padrão |
| `icon-512.png` | 512×512 | Ícone grande |
| `icon-maskable.png` | 512×512 | Maskable (use [maskable.app](https://maskable.app)) |
| `shortcut-expense.png` | 96×96 | Atalho "Nova despesa" |
| `shortcut-income.png` | 96×96 | Atalho "Nova receita" |

Dica: use o emoji 🏠 em [favicon.io](https://favicon.io/emoji-favicons) para gerar todos os PNGs.

---

## 8. Sincronização entre parceiros (sem custo extra)

O app **não usa Supabase Realtime** (que tem cota e pode gerar custos). Em vez disso:

- **Refresh automático ao focar a aba** — quando o parceiro abrir o app, os dados são recarregados
- **Refresh a cada 60s** enquanto a aba está visível
- **Refresh imediato ao voltar online**
- **Botão manual de atualizar** (ícone 🔄) em listas e tarefas
- **Optimistic UI** — mudanças locais aparecem instantâneas, sincronizam ao server em background

Você não precisa habilitar Replication no Supabase.

---

## 9. Rodar em desenvolvimento

```bash
npm run dev
```

Acesse `http://localhost:3000`. O Service Worker é desabilitado em dev. Para testar PWA: `npm run build && npm run start`.

---

## 10. Deploy na Vercel

```bash
npx vercel --prod
```

Configure todas as variáveis de `.env.local` em **Settings → Environment Variables**. Os Cron Jobs configurados (`vercel.json`) rodam automaticamente:

- **`/api/cron/close-month`** — dia 2 de cada mês às 03:00 UTC (fecha snapshots de saldo)
- **`/api/cron/generate-recurring`** — todo dia às 06:00 UTC (gera lançamentos recorrentes)

---

## 11. Verificar RLS

Painel Supabase → **Authentication → Policies** — toda tabela deve mostrar cadeado (RLS enabled). Se alguma tabela aparecer sem cadeado, verifique se as migrations rodaram por completo.

---

## ✅ O que o código já entrega

**Financeiro**
- Login/Signup com Supabase Auth
- Criação de família e convite por código (gera link `/invite/{code}`)
- Lançamentos individuais (receita/despesa) com categorias
- Split de despesas com proporção de renda (cada membro recebe sua fração como lançamento próprio)
- Snapshots de saldo mensais (saldo nunca varre histórico completo)
- Visão individual e visão da família (com proporção visual)
- Soft delete em transações (preserva histórico)
- Seletor de mês para navegar histórico

**Recorrentes**
- Cadastro de receitas/despesas que se repetem (mensal/semanal/anual)
- Suporte a divisão automática entre membros
- Geração diária via Cron Job
- Pausar/ativar/excluir recorrente

**Orçamento mensal**
- Limite por categoria (mensal)
- Indicador visual verde/amarelo/vermelho
- Resumo agregado no dashboard financeiro

**Caixinhas (Enxoval)**
- Criar metas com valor-alvo
- Depósito e retirada atômicos via RPC (afeta saldo pessoal)
- Trigger PostgreSQL mantém `current_value` consistente
- Status automático: `active` → `completed` ao atingir meta

**Listas de compras**
- Múltiplas listas (mercado, farmácia, casa…)
- Itens com quantidade, preço estimado, notas
- Realtime entre os parceiros via Supabase Realtime
- Estimativa total da lista

**Tarefas (To-Do)**
- Tarefas atribuíveis ao parceiro
- Prioridade (baixa/normal/alta) e data de vencimento
- Indicador de atraso
- Realtime

**Calendário**
- Aniversários, datas especiais, contas a pagar, compromissos
- Recorrência (anual/mensal/semanal)
- Próximos eventos no dashboard

**Dashboard home**
- Cards de saldo, tarefas pendentes, lista de compras, eventos próximos, caixinhas em andamento
- Atalhos rápidos para todas as áreas

**Comentários em transações** (estilo Honeydue)
- Tabela `transaction_comments` para chat em transações específicas
- (UI pode ser adicionada depois — o backend já está pronto)

**PWA**
- Manifest com atalhos (Nova despesa/Nova receita)
- Service Worker com cache estratégico (Network First para Supabase, Cache First para assets, Stale While Revalidate para pages)
- Banner de instalação (com dismissal de 14 dias)
- Banner offline no topo das páginas
- Página offline fallback
- Background Sync registrado para transações offline

**Robustez**
- Try/catch em todas as Server Actions
- Validação Zod em todos os inputs
- Confirmação em ações destrutivas (`<ConfirmDialog>`)
- Error boundary, not-found, loading states
- Middleware redireciona automaticamente: sem sessão → `/login`, sem família → `/onboarding`
- RLS em todas as tabelas
- Soft delete onde aplicável

---

## 🔧 Próximos passos sugeridos (não bloqueiam uso)

- Implementar UI de comentários em transações (backend já pronto)
- Importar extratos bancários (CSV)
- Gráficos de evolução mensal (Recharts já está nas dependências)
- Push notifications para: split criado pelo parceiro, meta atingida, conta vencendo
- Modo claro/escuro toggle (hoje é dark fixo)
- Login com Google/Apple via Supabase Auth providers
