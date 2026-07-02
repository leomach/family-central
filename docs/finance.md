# Domínio financeiro

Esta é a área mais complexa e sensível do projeto. Cálculos errados aqui corrompem
saldo, orçamento e proporções silenciosamente. **Leia antes de alterar qualquer coisa
de finanças** e, ao terminar, valide os cálculos com uma simulação numérica.

Arquivos-chave:
- `src/actions/transactions.ts` — criar/editar/excluir transações, rateio, proporções, snapshots.
- `src/actions/goals.ts` — caixinhas (depósito/retirada/edição de contribuição).
- `src/actions/budgets.ts`, `src/actions/recurring.ts`, `src/actions/categories.ts`.
- `src/lib/utils.ts` — `splitAmount`, helpers de data/moeda.
- `supabase/migrations/0001,0002,0005,0006,0007` — funções e triggers SQL.
- Páginas: `(dashboard)/financeiro`, `financeiro/familia`, `orcamento`, `enxoval`.

---

## 1. Modelo de dados

- **`transactions`**: uma linha por lançamento. `type ∈ {income, expense, transfer_out,
  transfer_in}`, `amount > 0` (CHECK), `date`, `category_id`, `group_id` (se
  compartilhada), `deleted_at` (soft delete).
- **`transaction_groups`**: cabeçalho de uma despesa compartilhada; `total_amount`. As
  parcelas (uma por participante) referenciam via `group_id`.
- **`income_proportions`**: proporção de renda por `(family_id, user_id, month)`,
  `0 ≤ proportion ≤ 1`. Base do rateio de despesas compartilhadas.
- **`balance_snapshots`**: cache por `(user_id, month)` com `balance` (saldo acumulado
  até o fim do mês), `income` e `expenses` (totais do mês) e `is_dirty`.
- **`savings_goals`** / **`savings_contributions`**: caixinhas e seus aportes.
- **`budgets`**: limite mensal por `(family_id, category_id, month)`.
- **`recurring_transactions`**: modelos que o cron materializa em `transactions`.

## 2. Sinais e convenção de receita/despesa

`get_user_balance` soma com sinais: `income (+)`, `transfer_in (+)`, `expense (−)`,
`transfer_out (−)`.

Nos **resumos das telas**, para bater com o saldo:
- **Receita** = `income + transfer_in`
- **Despesa** = `expense + transfer_out`

`transfer_out` = depósito em caixinha (sai do saldo pessoal). `transfer_in` = retirada
de caixinha (volta ao saldo). São movimentações internas, mas entram no saldo.

**Exceção — dízimo**: a base é apenas `income` genuíno (exclui `transfer_in`, pois
retirar da própria poupança não é renda nova). Ver §9.

## 3. Rateio de despesas compartilhadas (`splitAmount`)

Regra de produto: despesa compartilhada é dividida **proporcionalmente à renda** de cada
participante no mês (via `income_proportions`); se não houver proporções (mês sem
receita registrada), cai em **divisão igual**.

`splitAmount(amount, participants, proportionMap)` (`lib/utils.ts`) é a **única** fonte
de verdade do rateio — usada no backend (criação e edição) e no preview do formulário:
- Trabalha em **centavos inteiros** (evita erro de float).
- Valida `totalCents ≥ nº de participantes`; senão retorna `{ error }` (valor pequeno
  demais para dividir — ex.: R$ 0,02 entre 3).
- Distribui os centavos restantes pelo **método do maior resto** (soma sempre exata).
- Garante **≥ 1 centavo por participante** (nenhuma parcela viola o CHECK `amount > 0`).

Invariantes que qualquer alteração deve preservar: (a) soma das parcelas == total; (b)
nenhuma parcela ≤ 0; (c) preview do form == valor gravado no backend (mesma função).

**Recorrentes compartilhadas** replicam essa lógica em SQL (`split_cents` na migration
0005) — proporcional com fallback igual, maior resto e mínimo de 1 centavo.

## 4. Saldo e snapshots (cache)

`get_user_balance(user, p_until = hoje)` = saldo acumulado até uma data. Otimização:
pega o **snapshot limpo mais recente** com `month < mês(p_until)` e soma apenas as
transações do intervalo `(snapshot, p_until]`. Sem snapshot, soma desde o início.

`get_month_summary(user, month)` → `(balance, income, expenses)` do mês:
- Se existe snapshot **limpo** do mês → devolve os valores materializados (0 varredura).
- Senão (mês corrente ou snapshot sujo) → recomputa: `balance = get_user_balance(fim do
  mês)`, `income`/`expenses` = somas do mês.

`get_family_month_summary(family, month)` → uma linha por membro (via
`get_month_summary`), com checagem de permissão (`auth.uid()` membro da família; libera
o cron, que roda sem `auth.uid()`).

O cron `api/cron/close-month` materializa o snapshot do **mês anterior** (saldo + income
+ expenses) via `get_month_summary`.

### Invalidação (a regra que mais causa bug)

`invalidateSnapshots(userId, date)` marca `is_dirty = true` para todos os snapshots com
`month ≥ mês(date)`. Como `is_dirty` também controla `income`/`expenses`, os totais
materializados **nunca ficam obsoletos**: sujo ⇒ recomputa.

Ao mutar uma transação, invalide:
- O **mês antigo** e o **mês novo** (a data pode mudar de mês — inclusive para trás; por
  isso invalidamos ambos, e mover para trás exige invalidar o mês mais antigo).
- Para **compartilhadas**, o snapshot de **todos os participantes**.
- `invalidateSnapshots` usa **`serviceClient`** — a RLS de `balance_snapshots` é por
  `user_id`, então com o client normal não daria para sujar o snapshot de terceiros
  (falharia em silêncio).

> Limitação conhecida: o cron só fecha o mês anterior. Um mês histórico editado fica com
> snapshot sujo e passa a ser sempre recomputado (correto, porém sem o ganho de cache)
> até algum processo rematerializar.

## 5. Proporções de renda (`income_proportions`)

`recalculateProportions(familyId, month)`: soma as receitas (`type = income`) de cada
membro no mês, calcula `proporção = renda_do_membro / renda_total`. A **última
proporção recebe o resto** (`1 − soma das anteriores`) para o conjunto somar exatamente
1 (evita 0,33+0,33+0,33 = 0,99). Se a renda total do mês for 0, **remove** as linhas de
proporção do mês (não deixa valores obsoletos).

Recalcule em **toda** mutação de receita:
- Criar receita → recalcula o mês.
- Editar → recalcula o mês antigo (se era receita) e o novo (se é receita).
- Excluir receita → recalcula o mês.

Compartilhadas são sempre `expense` e **não** afetam proporções.

## 6. Ciclo de vida de uma transação

### Criar (`createTransaction`)
- Individual: insere; se `income`, `recalculateProportions`; invalida snapshot.
- Compartilhada (`participants.length > 1`): valida participantes na família; busca
  proporções do mês; `splitAmount`; cria `transaction_group` + uma `transaction` por
  participante (via `serviceClient`); invalida snapshot de todos.

### Editar (`updateTransaction`)
- Valida dono (`user_id`). **Bloqueia** `transfer_in/out` (caixinha — ver §7).
- Individual: atualiza; recalcula proporções nos meses afetados (antigo/novo conforme o
  tipo mude para/de `income`); invalida snapshot do mês antigo e do novo.
- Compartilhada (`updateSharedTransaction`): re-rateia o novo total entre os
  participantes existentes (proporções do mês da nova data); atualiza todas as parcelas +
  o cabeçalho do grupo (`serviceClient`); invalida snapshot de todos, mês antigo e novo.

### Excluir (`deleteTransaction`)
- Soft delete (`deleted_at`). Grupo: soft-delete de todas as parcelas. Invalida snapshots
  (todos os participantes). Se era `income`, recalcula proporções.

Todas terminam com `revalidateFinancePaths()` (`/`, `/financeiro`, `/financeiro/familia`,
`/orcamento`).

## 7. Caixinhas (metas de poupança)

- **Depósito**: cria `transfer_out` (sai do saldo) + `savings_contribution (+amount)`.
  `contribute_to_goal` valida saldo pessoal suficiente (não deixa saldo negativo).
- **Retirada**: cria `transfer_in` + `savings_contribution (−amount)`. Valida saldo da
  caixinha com `SELECT ... FOR UPDATE` (evita corrida).
- Trigger `sync_goal_current_value` mantém `savings_goals.current_value = SUM(
  contributions)` e marca `completed` quando atinge `target_value`.
- `update_contribution` (migration 0006) permite editar valor/data de um aporte pela
  própria caixinha. **Nunca** edite as transações `transfer_*` diretamente — elas e o
  `current_value` da meta ficariam dessincronizados.

## 8. Orçamento e recorrentes

- **Orçamento**: `budgets` guarda o limite por categoria/mês. O gasto (`spentByCategory`)
  é somado a partir das `transactions` `expense` do mês. Percentuais e "resta/excedeu"
  são calculados na UI.
- **Recorrentes**: `generate_recurring_transactions` (SQL, migration 0005) roda no cron
  `generate-recurring`. Para cada modelo com `next_run_date ≤ hoje`: materializa a(s)
  transação(ões) (compartilhada usa `split_cents`), invalida snapshot de cada
  participante, e avança `next_run_date` respeitando `day_of_month` (sem "escorregar" de
  31→28→28). Uma falha em um item **não aborta** o batch (tratada por item).

## 9. Dízimo (somente visualização)

`components/finance/tithe-card.tsx` mostra 10% da **receita genuína do mês** (apenas
`type = income`, calculada na página a partir das transações — não usa o `income` do
snapshot, que inclui `transfer_in`). É uma faixa compacta, **não gera lançamento** nem
persiste nada, e respeita o mês selecionado. Percentual fixo em 10%.

## 10. Como validar alterações financeiras

Antes de concluir, rode uma simulação numérica (script Node pontual) que prove:
- Rateio: soma == total e nenhuma parcela ≤ 0, incluindo casos-limite (valores baixos,
  proporções muito desiguais, fallback igual).
- Saldo: `get_user_balance`/`get_month_summary` (cache) == soma bruta independente, após
  editar valor, mudar tipo, mover de mês (inclusive para trás) e excluir.
- Proporções: somam 1 e são limpas quando o mês fica sem receita.

Há exemplos desse tipo de verificação no histórico do projeto; replique o padrão
(modele snapshot + transações + invalidação e compare com a "verdade-base").
