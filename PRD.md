# PRD — Central da Família

## Visão Geral

Web app para gestão financeira e de objetivos de um lar. Prioridades: mínimo esforço de manutenção, alta escalabilidade no banco de dados e UX simples e impecável.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router + Server Actions) |
| BaaS / DB | Supabase (PostgreSQL + Auth nativo) |
| Estilização | TailwindCSS + Shadcn/UI |
| Deploy | Vercel |

Zero APIs REST isoladas — todas as mutações via Server Actions.

---

## Arquitetura Multitenant

### Modelo de dados base

```sql
families
  id          uuid PK  DEFAULT gen_random_uuid()
  name        text     NOT NULL
  created_at  timestamptz DEFAULT now()

family_members
  id          uuid PK  DEFAULT gen_random_uuid()
  family_id   uuid     NOT NULL REFERENCES families(id) ON DELETE CASCADE
  user_id     uuid     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  role        text     NOT NULL CHECK (role IN ('owner', 'admin', 'member'))
  joined_at   timestamptz DEFAULT now()
  UNIQUE (family_id, user_id)

family_invites
  id          uuid PK  DEFAULT gen_random_uuid()
  family_id   uuid     NOT NULL REFERENCES families(id) ON DELETE CASCADE
  code        text     NOT NULL UNIQUE  -- gerado com nanoid (8 chars)
  created_by  uuid     NOT NULL REFERENCES auth.users(id)
  used_by     uuid     NULL REFERENCES auth.users(id)  -- NULL = ainda válido
  expires_at  timestamptz NOT NULL  -- DEFAULT now() + interval '7 days'
  created_at  timestamptz DEFAULT now()
```

- Cada `auth.user` pertence a exatamente uma `family` via `family_members`.
- **Toda query filtra por `family_id` primeiro.** RLS garante isso em nível de banco.
- O banco prevê N membros por família; MVP inicia com 2.

### Autenticação e onboarding

1. Cadastro via Supabase Auth (e-mail/senha).
2. Primeiro acesso: **Criar Família** → gera `families` + `family_members` com `role = 'owner'`; ou **Entrar com código** → valida `family_invites.code` (não expirado, `used_by IS NULL`), cria `family_members` e marca `used_by`.
3. Middleware Next.js protege `(dashboard)` e redireciona para `/login` se sem sessão, para `/onboarding` se sem `family_id`.

---

## Módulo Financeiro

### Visões

| Visão | Escopo |
|---|---|
| Individual | Saldo, receitas e despesas do usuário autenticado |
| Família | Consolidação de todos os membros; proporções de renda |

### Modelo de dados

```sql
-- Agrupa lançamentos de um split compartilhado
transaction_groups
  id          uuid PK  DEFAULT gen_random_uuid()
  family_id   uuid     NOT NULL REFERENCES families(id)
  description text     NOT NULL
  total_amount numeric(12,2) NOT NULL
  date        date     NOT NULL
  created_at  timestamptz DEFAULT now()

transactions
  id                   uuid PK  DEFAULT gen_random_uuid()
  family_id            uuid     NOT NULL REFERENCES families(id)
  user_id              uuid     NOT NULL REFERENCES auth.users(id)
  group_id             uuid     NULL REFERENCES transaction_groups(id) ON DELETE CASCADE
  type                 text     NOT NULL CHECK (type IN ('income','expense','transfer_out','transfer_in'))
  amount               numeric(12,2) NOT NULL CHECK (amount > 0)
  description          text     NOT NULL
  category_id          uuid     NULL REFERENCES categories(id)
  date                 date     NOT NULL
  deleted_at           timestamptz NULL  -- soft delete
  created_at           timestamptz DEFAULT now()

categories
  id         uuid PK  DEFAULT gen_random_uuid()
  family_id  uuid     NULL REFERENCES families(id)  -- NULL = categoria padrão do sistema
  name       text     NOT NULL
  type       text     NOT NULL CHECK (type IN ('income','expense'))
  icon       text     NULL
  UNIQUE (family_id, name, type)

income_proportions    -- cache; recalculado toda vez que receitas do mês mudam
  id          uuid PK  DEFAULT gen_random_uuid()
  family_id   uuid     NOT NULL REFERENCES families(id)
  user_id     uuid     NOT NULL REFERENCES auth.users(id)
  month       date     NOT NULL  -- primeiro dia do mês (YYYY-MM-01)
  proportion  numeric(6,5) NOT NULL  -- ex: 0.60000 = 60%
  UNIQUE (family_id, user_id, month)
```

> **`group_id` sem FK circular**: o UUID de `transaction_groups` é gerado antes dos inserts de `transactions`, eliminando a referência circular que existia com `group_transaction_id → transactions(self)`.

### Soft delete em transactions

- Exclusão nunca remove a linha: seta `deleted_at = now()`.
- Todas as queries de saldo filtram `AND deleted_at IS NULL`.
- Exclusão de um lançamento pertencente a um grupo (`group_id IS NOT NULL`) deleta **o grupo inteiro** via `ON DELETE CASCADE` — nunca deleta uma fração sem as demais.
- Ao deletar qualquer transação, a Server Action marca como dirty os snapshots do mesmo mês em diante (ver seção Snapshots).

### Lógica de lançamento compartilhado (Server Action)

Quando um usuário cria uma despesa compartilhada e seleciona participantes:

1. Valida que todos os `user_id` participantes pertencem à mesma `family_id` do solicitante — feito **antes** de usar a service role key.
2. Lê `income_proportions` do mês correspondente à **data da transação** (não à data atual) para os participantes selecionados.
3. **Se algum participante não tem `income_proportion` no mês**: usa divisão igualitária entre os participantes (proporção = 1 / n). Isso evita bloquear o cadastro por ausência de renda.
4. Calcula `amount_i = total × proportion_i / Σ proportions_selecionados`. Ajusta arredondamentos no último participante para que `Σ amount_i == total` exato.
5. Insere `transaction_groups` (uma linha).
6. Insere `transactions` para cada participante com `group_id` apontando para o grupo. Usa `SUPABASE_SERVICE_ROLE_KEY` apenas neste insert para bypassar RLS de `user_id` de terceiros.
7. Invalida snapshots de todos os participantes para o mês da transação.

**Preview client-side:** calculado com as proporções já carregadas no estado do formulário (sem round-trip). A Server Action re-valida os valores — o preview é apenas indicativo.

### Cálculo e invalidação de `income_proportions`

- Recalculado em toda Server Action que cria, edita ou deleta uma transação `type = 'income'`.
- Fórmula: `proportion_i = receita_i_no_mês / Σ receitas_todos_no_mês`.
- Splits **já realizados no passado não são retroativamente alterados** — cada split usa a proporção vigente no momento de sua criação. Isso é intencional e deve ser comunicado na UI ("valores calculados com a proporção de renda do mês").

---

## Sistema de Snapshots de Saldo

Evita somar todas as transações históricas para calcular o saldo.

### Modelo de dados

```sql
balance_snapshots
  id           uuid PK  DEFAULT gen_random_uuid()
  family_id    uuid     NOT NULL REFERENCES families(id)
  user_id      uuid     NOT NULL REFERENCES auth.users(id)
  month        date     NOT NULL  -- YYYY-MM-01; representa o saldo ao FIM deste mês
  balance      numeric(12,2) NOT NULL
  is_dirty     boolean  NOT NULL DEFAULT false  -- true = precisa recalcular
  computed_at  timestamptz DEFAULT now()
  UNIQUE (user_id, month)
```

### Como o saldo é calculado

```
saldo_atual = snapshot_balance + SUM(transações após snapshot)
```

Passo a passo na Server Action / RPC:

1. Buscar o snapshot mais recente não-dirty onde `month < date_trunc('month', CURRENT_DATE)`.
2. Somar todas as `transactions` onde `date > último dia do mês do snapshot` E `date <= CURRENT_DATE` E `deleted_at IS NULL`.
3. Contribuição de cada tipo ao saldo:
   - `income`        → `+amount`
   - `expense`       → `−amount`
   - `transfer_out`  → `−amount` (depósito em caixinha)
   - `transfer_in`   → `+amount` (retirada de caixinha)
4. `saldo_atual = snapshot.balance + soma_recente`

Se não existe nenhum snapshot válido, soma todas as transações desde o início (bootstrap).

### Criação e invalidação de snapshots

**Criação (lazy):** a primeira vez que uma query de saldo é executada para um mês já encerrado sem snapshot, a Server Action calcula e persiste o snapshot daquele mês antes de responder.

**Invalidação:** toda Server Action que cria, edita (data ou amount) ou deleta uma transação executa:

```sql
UPDATE balance_snapshots
SET is_dirty = true
WHERE user_id = $user_id
  AND month >= date_trunc('month', $transaction_date::date);
```

Isso invalida o snapshot do mês da transação **e todos os meses seguintes**, pois o saldo acumulado é uma série temporal — alterar o passado afeta o presente.

**Recálculo dirty (lazy):** quando uma query de saldo encontra o snapshot necessário com `is_dirty = true`, a Server Action recalcula do zero para aquele mês antes de prosseguir.

### Fechamento mensal automático

Vercel Cron Job configurado para o dia 2 de cada mês às 03:00 UTC:

```
// vercel.json
{
  "crons": [{ "path": "/api/cron/close-month", "schedule": "0 3 2 * *" }]
}
```

A route handler `/api/cron/close-month`:
1. Para cada `(family_id, user_id)` que não tem snapshot do mês anterior: calcula e persiste.
2. Para snapshots `is_dirty = true` do mês anterior: recalcula e persiste.

Resultado: ao longo do mês, o saldo corrente soma apenas as transações do mês atual sobre um snapshot já pronto.

---

## Módulo Enxoval / Caixinhas

### Modelo de dados

```sql
savings_goals
  id            uuid PK  DEFAULT gen_random_uuid()
  family_id     uuid     NOT NULL REFERENCES families(id)
  name          text     NOT NULL
  target_value  numeric(12,2) NOT NULL CHECK (target_value > 0)
  current_value numeric(12,2) NOT NULL DEFAULT 0 CHECK (current_value >= 0)
  status        text     NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled'))
  created_at    timestamptz DEFAULT now()

savings_contributions
  id             uuid PK  DEFAULT gen_random_uuid()
  goal_id        uuid     NOT NULL REFERENCES savings_goals(id) ON DELETE RESTRICT
  user_id        uuid     NOT NULL REFERENCES auth.users(id)
  family_id      uuid     NOT NULL REFERENCES families(id)
  amount         numeric(12,2) NOT NULL  -- positivo = depósito, negativo = retirada
  transaction_id uuid     NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT
  created_at     timestamptz DEFAULT now()
```

> `ON DELETE RESTRICT` em `savings_contributions → transactions` impede deletar uma transação de caixinha diretamente. A exclusão deve passar pela Server Action de retirada, que orquestra ambos os registros.

### `current_value` e consistência

`savings_goals.current_value` é denormalizado para performance. Um trigger PostgreSQL mantém o valor em sincronia:

```sql
CREATE OR REPLACE FUNCTION sync_goal_current_value()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE savings_goals
  SET current_value = (
    SELECT COALESCE(SUM(amount), 0)
    FROM savings_contributions
    WHERE goal_id = COALESCE(NEW.goal_id, OLD.goal_id)
  )
  WHERE id = COALESCE(NEW.goal_id, OLD.goal_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_goal_value
AFTER INSERT OR UPDATE OR DELETE ON savings_contributions
FOR EACH ROW EXECUTE FUNCTION sync_goal_current_value();
```

Isso elimina qualquer possibilidade de deriva — `current_value` é sempre a soma real.

### Lógica de contribuição (Server Action atômica via RPC)

Toda operação de caixinha é executada em uma única função PL/pgSQL (`supabase.rpc('contribute_to_goal', {...})`) para garantir atomicidade sem expor a service role key:

**Depósito (R$ X):**
1. Insere `transactions` com `type = 'transfer_out'`, `amount = X`, `user_id` do solicitante.
2. Insere `savings_contributions` com `amount = +X`, vinculando ao transaction acima.
3. Trigger atualiza `savings_goals.current_value`.
4. Invalida snapshot do mês.
5. Se `current_value >= target_value`: atualiza `status = 'completed'` automaticamente.

**Retirada (R$ X):**
1. Valida `current_value >= X` — rejeita se insuficiente.
2. Insere `transactions` com `type = 'transfer_in'`, `amount = X`.
3. Insere `savings_contributions` com `amount = −X`.
4. Trigger atualiza `current_value`.
5. Se estava `completed` e `current_value < target_value`: reverte para `active`.

---

## Estrutura de Rotas (App Router)

```
app/
  (auth)/
    login/
    signup/
    onboarding/          -- criar ou entrar em família (pós-signup sem family_id)
    invite/[code]/       -- aceitar convite; valida e redireciona para onboarding
  (dashboard)/
    layout.tsx           -- sidebar + auth guard + family_id context
    page.tsx             -- dashboard home (resumo financeiro do mês)
    financeiro/
      page.tsx           -- visão individual (default tab)
      familia/
        page.tsx         -- visão consolidada da família
    enxoval/
      page.tsx           -- lista de objetivos
      [id]/
        page.tsx         -- detalhe do objetivo + histórico de contribuições
    configuracoes/
      page.tsx           -- perfil, membros da família, gerar convite
  api/
    cron/
      close-month/       -- fechamento mensal de snapshots (Vercel Cron)
```

---

## Row Level Security

Todas as tabelas habilitam RLS. Política padrão:

```sql
-- Leitura e escrita limitadas à família do usuário autenticado
CREATE POLICY "family_scope" ON transactions
  USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );
```

Políticas equivalentes em `savings_goals`, `savings_contributions`, `balance_snapshots`, `income_proportions`, `transaction_groups`, `categories`.

`SUPABASE_SERVICE_ROLE_KEY` é usado **exclusivamente** na Server Action de split compartilhado, após validação explícita de que todos os `user_id` alvo pertencem à mesma `family_id` do solicitante. Nunca expor ao cliente.

---

## Fluxos de UX Críticos

### Cadastrar despesa compartilhada

1. Formulário de nova transação → marcar "Compartilhar".
2. Seletor de membros (checkbox). Preview em tempo real mostra a fração de cada um calculada com as proporções em cache no cliente.
3. Submit → Server Action valida, executa split, invalida snapshots, `revalidatePath`.
4. UI exibe a transação na timeline individual com badge "Compartilhada" e link para ver o grupo completo.

### Contribuir para um objetivo

1. Botões "Depositar" / "Retirar" na página do objetivo.
2. Modal mostra: valor, novo saldo do objetivo e impacto no saldo pessoal.
3. Submit → `supabase.rpc('contribute_to_goal')`, página revalida.

### Cálculo de saldo (UX)

- O saldo exibido no dashboard usa sempre a função de snapshot: rápido e consistente.
- Indicador visual se o snapshot do mês corrente ainda está sendo calculado (estado `is_dirty` em recálculo).

---

## Índices Recomendados

```sql
CREATE INDEX idx_transactions_user_date   ON transactions (user_id, date) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_family_date ON transactions (family_id, date) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_group       ON transactions (group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_snapshots_user_month     ON balance_snapshots (user_id, month DESC);
CREATE INDEX idx_proportions_family_month ON income_proportions (family_id, month);
CREATE INDEX idx_invites_code             ON family_invites (code) WHERE used_by IS NULL;
```

---

## PWA (Progressive Web App)

O app deve ser instalável e funcional como app nativo em iOS, Android e desktop. Biblioteca: **Serwist** (`@serwist/next`) — fork mantido do `next-pwa`.

### Web App Manifest (`/app/manifest.ts`)

```ts
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Central da Família",
    short_name: "Família",
    description: "Gestão financeira e objetivos do lar",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    theme_color: "#0f172a",
    background_color: "#0f172a",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png",    sizes: "192x192",   type: "image/png" },
      { src: "/icons/icon-512.png",    sizes: "512x512",   type: "image/png" },
      { src: "/icons/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Nova despesa",
        short_name: "Despesa",
        url: "/financeiro?action=new-expense",
        icons: [{ src: "/icons/shortcut-expense.png", sizes: "96x96" }],
      },
      {
        name: "Nova receita",
        short_name: "Receita",
        url: "/financeiro?action=new-income",
        icons: [{ src: "/icons/shortcut-income.png", sizes: "96x96" }],
      },
      {
        name: "Ver saldo",
        short_name: "Saldo",
        url: "/financeiro",
        icons: [{ src: "/icons/shortcut-balance.png", sizes: "96x96" }],
      },
    ],
    screenshots: [
      { src: "/screenshots/mobile-dashboard.png", sizes: "390x844", form_factor: "narrow" },
      { src: "/screenshots/desktop-dashboard.png", sizes: "1280x800", form_factor: "wide" },
    ],
    share_target: {
      action: "/financeiro/share-target",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  }
}
```

### Service Worker e estratégias de cache (Serwist)

```ts
// sw.ts
import { defaultCache } from "@serwist/next/worker"
import type { PrecacheEntry } from "serwist"
import { Serwist } from "serwist"

const sw = new Serwist({
  precacheEntries: self.__SW_MANIFEST as PrecacheEntry[],
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    // Fontes e assets estáticos → Cache First (imutáveis)
    {
      matcher: /\.(woff2?|ttf|otf|eot)$/,
      handler: "CacheFirst",
      options: { cacheName: "fonts", expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 } },
    },
    // Imagens → Cache First
    {
      matcher: /\.(png|jpg|jpeg|svg|webp|ico)$/,
      handler: "CacheFirst",
      options: { cacheName: "images", expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 } },
    },
    // Supabase REST (dados financeiros) → Network First; fallback para cache
    {
      matcher: /^https:\/\/.*\.supabase\.co\/rest\//,
      handler: "NetworkFirst",
      options: { cacheName: "supabase-data", networkTimeoutSeconds: 5,
                 expiration: { maxAgeSeconds: 60 * 60 * 24 } },
    },
    // Next.js RSC e pages → Stale While Revalidate
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: "StaleWhileRevalidate",
      options: { cacheName: "pages" },
    },
    ...defaultCache,
  ],
})

sw.addEventListeners()
```

### Página offline (`/app/offline/page.tsx`)

Exibida pelo service worker quando a navegação falha e não há cache disponível. Mostra o último saldo em cache e botão "Tentar novamente".

### Background Sync — transações offline

Quando o usuário cadastra uma transação sem conexão:

1. A Server Action detecta falha de rede e salva o payload em `IndexedDB` (via `idb-keyval`).
2. O service worker registra uma sync tag: `navigator.serviceWorker.ready.then(sw => sw.sync.register('sync-transactions'))`.
3. Quando a conexão retorna, o service worker dispara o evento `sync`, e o app reprocessa a fila do `IndexedDB` chamando a Server Action pendente.
4. UI mostra badge "Pendente" nas transações não sincronizadas.

> Background Sync não é suportado no iOS Safari — no iOS, o app exibe um aviso e aguarda o usuário abrir o app novamente com conexão para sincronizar a fila manualmente.

### Push Notifications (Web Push)

Usado para alertas de: meta de caixinha atingida, lançamento compartilhado criado pelo outro membro, e resumo mensal.

```sql
push_subscriptions
  id          uuid PK DEFAULT gen_random_uuid()
  user_id     uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  endpoint    text    NOT NULL UNIQUE
  p256dh      text    NOT NULL
  auth_key    text    NOT NULL
  created_at  timestamptz DEFAULT now()
```

- Servidor envia via `web-push` (VAPID keys em variáveis de ambiente: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`).
- Usuário concede permissão em `/configuracoes` — nunca exibir prompt automático.
- Notificações enviadas por Server Actions que chamam `/api/push/send` internamente (não exposta ao cliente).

### App Badges

Usa a **Badging API** para exibir no ícone do app o número de transações compartilhadas pendentes de revisão:

```ts
if ('setAppBadge' in navigator) {
  navigator.setAppBadge(pendingCount)  // ou clearAppBadge() quando = 0
}
```

### Web Share API

Qualquer transação ou meta pode ser compartilhada via `navigator.share()`:

```ts
await navigator.share({
  title: `Despesa: ${transaction.description}`,
  text: `R$ ${transaction.amount} — ${transaction.category}`,
  url: `${origin}/financeiro/transacao/${transaction.id}`,
})
```

Botão de compartilhar aparece apenas se `navigator.canShare()` retornar `true`.

### Share Target

A entrada `share_target` no manifest permite receber conteúdo compartilhado de outros apps (ex: screenshot de comprovante). A route `/financeiro/share-target` lê os query params e abre o formulário de nova transação pré-preenchido com o texto recebido.

### Screen Wake Lock

Na tela de cadastro de transação, ativa o Wake Lock para evitar que a tela apague enquanto o usuário está digitando:

```ts
const wakeLock = await navigator.wakeLock.request('screen')
// libera ao fechar o modal
```

### Variáveis de ambiente adicionais (PWA)

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY           -- somente server-side
VAPID_SUBJECT               -- mailto:contato@dominio.com
```

### Checklist de qualidade PWA (Lighthouse)

Antes de cada deploy de produção verificar:
- Performance ≥ 90
- PWA score = 100
- `start_url` responde offline
- Todos os ícones presentes (incluindo maskable)
- HTTPS em produção (obrigatório para service worker)

---

## Módulos Adicionais para Vida em Comum

Inspirados em apps como Honeydue, Zeta e YNAB, mas adaptados para casais brasileiros que estão construindo a vida em conjunto.

### Orçamento mensal por categoria

```sql
budgets
  id           uuid PK
  family_id    uuid FK
  category_id  uuid FK
  month        date         -- YYYY-MM-01
  limit_amount numeric(12,2)
  UNIQUE (family_id, category_id, month)
```

Limite por categoria por mês. UI mostra barra de progresso (verde/amarelo/vermelho) com `spent / limit`.

### Lançamentos recorrentes

```sql
recurring_transactions
  id                  uuid PK
  family_id           uuid FK
  user_id             uuid FK
  type                text (income | expense)
  amount              numeric(12,2)
  description         text
  category_id         uuid FK
  frequency           text (monthly | weekly | yearly)
  shared_participants uuid[]      -- NULL = não compartilhado
  start_date          date
  end_date            date NULL
  next_run_date       date
  is_active           boolean
```

Função `generate_recurring_transactions()` é executada diariamente via Vercel Cron (`/api/cron/generate-recurring`). Para cada recorrente ativo onde `next_run_date <= CURRENT_DATE`:
1. Cria transação (ou grupo + transações se compartilhado).
2. Invalida snapshots dos meses afetados.
3. Atualiza `next_run_date` para a próxima ocorrência.

### Listas de compras compartilhadas

```sql
shopping_lists (id, family_id, name, icon, archived, created_by, created_at)
shopping_items (id, list_id, family_id, name, quantity, unit, estimated_price, notes,
                completed, completed_at, completed_by, added_by, created_at)
```

**Realtime:** itens sincronizam entre os parceiros via Supabase Realtime channel — habilitar replicação para `shopping_items` no painel Supabase.

### Tarefas compartilhadas (To-Do)

```sql
todos (id, family_id, title, description, assigned_to, due_date,
       priority [low|normal|high], completed, completed_at, completed_by,
       created_by, created_at)
```

Tarefas atribuíveis ao parceiro com prioridade e data de vencimento. Indicador visual de atraso. Realtime.

### Calendário / Eventos

```sql
events (id, family_id, title, description, event_date,
        type [reminder|anniversary|bill|appointment|goal], icon,
        recurring [yearly|monthly|weekly] NULL, created_by, created_at)
```

Datas importantes: aniversários, vencimentos de contas, compromissos. Dashboard mostra os próximos 7 dias.

### Comentários em transações (estilo Honeydue)

```sql
transaction_comments (id, transaction_id, family_id, user_id, content, created_at)
```

Chat por transação para perguntar "esse gasto foi você?". Backend pronto; UI pode ser adicionada incrementalmente.

---

## Dashboard Home

A página `/` (root do dashboard) é a tela inicial após login:

- **Saldo do mês** com receita/despesa rápida
- **Atalhos rápidos** (Compras, Tarefas, Caixinhas, Calendário)
- **Tarefas pendentes** (top 5 ordenadas por data)
- **Lista de compras** (itens não comprados nas listas ativas)
- **Próximos 7 dias** do calendário
- **Caixinhas em andamento** (3 mais recentes com progress bar)

Hub central — ao abrir o app, o casal vê o que importa hoje.

---

## Cron Jobs (Vercel)

```json
{
  "crons": [
    { "path": "/api/cron/close-month",       "schedule": "0 3 2 * *" },
    { "path": "/api/cron/generate-recurring","schedule": "0 6 * * *" }
  ]
}
```

Protegidos por `Bearer ${CRON_SECRET}` no header `Authorization`.

---

## Fora do Escopo do MVP

- Relatórios e exportação (PDF/CSV)
- Integração com Open Finance / bancos
- Múltiplas famílias por usuário
- Edição retroativa de lançamentos de split (cancela o grupo e recria)
- Periodic Background Sync (suporte limitado nos navegadores)
- Importação de extratos bancários (planejado para v2)
