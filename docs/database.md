# Banco de dados (Supabase / Postgres)

Schema versionado em `supabase/migrations/`. RLS habilitada em **todas** as tabelas.
Tipos espelhados em `src/types/database.ts` (mantenha sincronizado).

## Migrations existentes

| Arquivo | Conteúdo |
|---|---|
| `0001_initial.sql` | Tabelas base (famílias, membros, convites, categorias, transações, grupos, proporções, snapshots, caixinhas, push). Triggers e funções: `sync_goal_current_value`, `get_user_balance`, `contribute_to_goal`. RLS inicial. |
| `0002_modules.sql` | `budgets`, `recurring_transactions`, `shopping_lists/items`, `todos`, `events`, `transaction_comments`. Função `generate_recurring_transactions`. |
| `0003_fix_rls_recursion.sql` | Refatora RLS com `current_user_family_id()` (evita recursão); políticas por comando (`FOR SELECT/INSERT/UPDATE/ALL`) com `USING`/`WITH CHECK`. |
| `0004_editable_categories.sql` | Categorias editáveis por família. |
| `0005_finance_fixes.sql` | `split_cents`; reescrita de `generate_recurring_transactions` (rateio proporcional, `day_of_month`, robustez por item, invalida snapshot de todos) e `contribute_to_goal` (valida saldo no depósito, `FOR UPDATE`, `p_date`). |
| `0006_contribution_date.sql` | Data nas contribuições de caixinha; `update_contribution`. |
| `0007_snapshot_totals.sql` | Colunas `income`/`expenses` em `balance_snapshots` (+ backfill); funções `get_month_summary` e `get_family_month_summary`. |

## Tabelas (resumo)

Núcleo de identidade/família:
- **`families`** (`id`, `name`).
- **`family_members`** (`family_id`, `user_id`, `role ∈ owner|admin|member`), UNIQUE
  `(family_id, user_id)`.
- **`family_invites`** (`code` UNIQUE, `created_by`, `used_by`, `expires_at` — 7 dias).

Finanças (detalhes em `docs/finance.md`):
- **`categories`** (`family_id` NULL = sistema; ou por família; `type ∈ income|expense`).
- **`transactions`** (`type`, `amount > 0`, `date`, `category_id`, `group_id`,
  `deleted_at`).
- **`transaction_groups`** (`total_amount > 0`).
- **`income_proportions`** (`month`, `proportion` 0–1), UNIQUE `(family_id,user_id,month)`.
- **`balance_snapshots`** (`month`, `balance`, `income`, `expenses`, `is_dirty`), UNIQUE
  `(user_id, month)`.
- **`savings_goals`** (`target_value`, `current_value ≥ 0`, `status`),
  **`savings_contributions`** (`amount` — negativo em retirada, `transaction_id`).
- **`budgets`** (`month`, `limit_amount > 0`), UNIQUE `(family_id,category_id,month)`.
- **`recurring_transactions`** (`frequency ∈ monthly|weekly|yearly`, `day_of_month`,
  `shared_participants uuid[]`, `next_run_date`, `is_active`).

Outros módulos:
- **`todos`**, **`shopping_lists`**/**`shopping_items`**, **`events`**,
  **`transaction_comments`**, **`push_subscriptions`**.

## RLS

Modelo (a partir da 0003): função `current_user_family_id()` retorna a família do
`auth.uid()` sem recursão. Padrão das políticas:

- Dados de família: `FOR ALL USING (family_id = current_user_family_id()) WITH CHECK
  (family_id = current_user_family_id())`.
- Dados pessoais (`balance_snapshots`, `push_subscriptions`): `USING (user_id =
  auth.uid())`.
- `categories`: leitura inclui as de sistema (`family_id IS NULL`).

Consequências práticas:
- Escrever linhas de **outros usuários** (parcelas de compartilhada) ou sujar snapshot de
  terceiros exige `serviceClient` (bypassa RLS). Sempre valide permissão antes com o
  client normal.
- Funções `SECURITY DEFINER` (abaixo) rodam como owner e ignoram RLS; quando expõem dados
  de família inteira (`get_family_month_summary`), fazem checagem explícita de
  `auth.uid()` (e liberam o cron, que roda sem `auth.uid()`).

## Funções SQL (RPC)

Todas `SECURITY DEFINER`. Assinaturas espelhadas em `types/database.ts → Functions`.

- **`get_user_balance(p_user_id, p_until = CURRENT_DATE) → numeric`**: saldo acumulado
  até a data, usando o snapshot limpo mais recente + delta.
- **`get_month_summary(p_user_id, p_month) → TABLE(balance, income, expenses)`**: totais
  do mês; usa snapshot limpo quando disponível, senão recomputa.
- **`get_family_month_summary(p_family_id, p_month) → TABLE(user_id, income, expenses,
  balance)`**: um registro por membro (via `get_month_summary`); valida membership.
- **`contribute_to_goal(p_goal_id, p_user_id, p_family_id, p_amount, p_direction,
  p_date) → uuid`**: cria a transação `transfer_*` e a contribuição; valida saldo.
- **`update_contribution(p_contribution_id, p_amount, p_date)`**: edita um aporte.
- **`generate_recurring_transactions() → int`**: materializa recorrentes vencidas.
- **`split_cents(p_total int, p_weights numeric[]) → int[]`**: rateio em centavos (maior
  resto, mínimo 1) — versão SQL de `splitAmount`.

Triggers:
- **`sync_goal_current_value`** (em `savings_contributions`): mantém
  `savings_goals.current_value` e o `status` (`completed` ao atingir a meta).

## Boas práticas ao criar migration

1. `supabase db diff --use-migra -f <nome>` ou escreva o SQL à mão para lógica complexa.
2. **Numere sem colisão**: rode `ls supabase/migrations/` e use o próximo número livre.
   Duas migrations com o mesmo prefixo quebram a ordem de aplicação.
3. Migrations aplicadas são **imutáveis**. Correções vêm em nova migration
   (`CREATE OR REPLACE FUNCTION`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, etc.).
4. **Backfill** ao adicionar coluna derivada, na mesma migration — senão registros
   existentes ficam com o default e corrompem caches/cálculos (ex.: 0007 preenche
   `income`/`expenses` dos snapshots antigos).
5. Preserve RLS: toda tabela nova precisa de `ENABLE ROW LEVEL SECURITY` + políticas de
   escopo por família ou usuário.
6. Funções que leem dados de outros usuários: decida conscientemente entre `SECURITY
   DEFINER` (com checagem de permissão embutida) e depender da RLS do chamador.
7. Atualize `src/types/database.ts` (Row/Insert/Update e `Functions`) e rode
   `npm run type-check`.
8. Aplique com `supabase db push` (ou informe o usuário para aplicar).
