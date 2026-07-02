# Convenções e melhores práticas

Regras de como escrever código neste projeto e checklists de verificação. Ao alterar
finanças, combine com `docs/finance.md`.

## Princípios gerais

- **Combine com o código existente**: siga o estilo, densidade de comentários,
  nomenclatura e idioma (comentários e textos de UI em pt-BR) dos arquivos ao redor.
- **Server-first**: leituras em Server Components; mutações em Server Actions. Não crie
  Route Handlers para mutações internas.
- **Precisão em dinheiro**: nunca "chute". Cálculos financeiros são validados com
  simulação numérica antes de concluir (ver `docs/finance.md §10`).
- **Sem dependências novas** sem necessidade clara — o projeto já traz Radix, Zod,
  lucide, recharts, idb-keyval, web-push.

## Server Actions

Estrutura obrigatória (arquivo com `"use server"` no topo):

```ts
export async function fazerAlgo(input: z.infer<typeof Schema>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()   // ou getFamilyContext()
  if (!user) return { error: "Não autenticado" }

  const parsed = Schema.safeParse(input)
  if (!parsed.success) return { error: "Dados inválidos" }

  // escopo/permissão: filtrar por family_id; validar dono quando aplicável
  // mutação (client normal; serviceClient só quando precisa cruzar usuários)
  const { error } = await supabase.from("tabela")...
  if (error) return { error: error.message }

  // efeitos colaterais do domínio (proporções, snapshots) — ver docs/finance.md
  revalidatePath("/rota-afetada")            // finanças: revalidateFinancePaths()
  return { ok: true }
}
```

Regras:
- **Sempre** valide com Zod (exceto validações triviais de string única, mas prefira Zod).
- Retorne `{ ok: true } | { error: string }`. **Nunca** deixe exceções vazarem para o
  cliente; capture e traduza para `{ error }` (mensagens em pt-BR).
- Valide **permissão** explicitamente antes de usar `serviceClient`. Para "dono", compare
  `tx.user_id === user.id`. Para "multi-família", filtre por `family_id` no `.eq()` e use
  `.maybeSingle()` (nunca `.single()` que quebra com múltiplas linhas).
- `revalidatePath` de **todas** as rotas afetadas. Mutação de transação → use
  `revalidateFinancePaths()` (home, financeiro, família, orçamento).

## Componentes

- `"use client"` só quando há estado/efeito/evento. Prefira Server Components.
- Diálogos são controlados (`open` / `onOpenChange`).
- Feedback ao usuário via `toast({ title, description, variant })`.
- Após uma mutação bem-sucedida em Client Component, `router.refresh()` para refletir os
  dados revalidados; updates otimistas (com rollback no erro) onde a latência incomoda
  (padrão em tarefas/compras).
- Estilo com `cn()` e classes utilitárias; use as cores semânticas (`text-income`,
  `text-expense`, `bg-primary`, `text-muted-foreground`, `border-border`).

## Dinheiro e datas (o que mais causa bug)

- **Rateio**: só via `splitAmount()`. Nunca reimplemente divisão de valores.
- **Exibição de moeda**: `formatCurrency()`.
- **"Hoje"/"mês atual"** no servidor: `todayLocalISO()`, `currentMonthStart()`,
  `getMonthStart()` (fuso `America/Sao_Paulo`). **Proibido** `new Date().toISOString()`
  para a data do dia em código de servidor.
- **Data em Client Component**: use componentes locais do `Date` (fuso do dispositivo),
  ex.: `` `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${...}` ``.
- **Mês selecionado**: páginas de finanças recebem `?month=YYYY-MM-01`. Ao adicionar
  totais/telas por mês, respeite esse parâmetro e propague em links.

## Migrations e tipos

Ver `docs/database.md`. Em resumo: numere sem colisão, migrations imutáveis (corrija com
nova), backfill de colunas derivadas, preserve RLS, e atualize `src/types/database.ts`.

## Checklist — antes de concluir qualquer alteração

- [ ] `npm run type-check` passa.
- [ ] `npm run lint` passa.
- [ ] Server Actions: auth + Zod + escopo/permissão + `revalidatePath` corretos.
- [ ] Datas/dinheiro usam os helpers (sem `toISOString()` para "hoje"; sem float em rateio).
- [ ] Textos de UI e comentários em pt-BR.

## Checklist adicional — alterações financeiras

- [ ] Reli `docs/finance.md`.
- [ ] Snapshots invalidados no **mês antigo e novo** e para **todos os participantes**
      (via `serviceClient`).
- [ ] Proporções recalculadas em toda mutação de **receita** (e limpas se o mês zerar).
- [ ] Caixinha (`transfer_*`) não editada como transação comum.
- [ ] Receita/despesa dos resumos incluem `transfer_in`/`transfer_out` (dízimo é a
      exceção: só `income`).
- [ ] `revalidateFinancePaths()` chamado.
- [ ] Cálculo validado por **simulação numérica** (soma exata, sem parcela ≤ 0, cache ==
      verdade-base).

## Migration aplicada?

Alterações de SQL só têm efeito após `supabase db push`. Ao entregar uma migration nova,
avise explicitamente que ela precisa ser aplicada.
