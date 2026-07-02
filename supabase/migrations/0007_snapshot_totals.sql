-- ─────────────────────────────────────────────────────────────────────────────
-- Snapshots como cache de TOTAIS mensais (saldo, receitas e despesas)
--
-- Antes, o snapshot guardava só o saldo acumulado. Agora materializa também as
-- receitas e despesas do mês, para que as telas de financeiro (individual e
-- família) sirvam os totais já prontos, sem varrer transações a cada acesso.
--
-- A validade é controlada pela mesma flag is_dirty já existente: qualquer mutação
-- de transação marca o snapshot como sujo (is_dirty = true), e nesse caso os
-- totais são recomputados — nunca ficam obsoletos.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE balance_snapshots
  ADD COLUMN IF NOT EXISTS income   numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expenses numeric(12,2) NOT NULL DEFAULT 0;

-- Backfill dos snapshots já existentes: sem isto, ficariam com income/expenses = 0
-- e is_dirty = false, e as telas mostrariam totais zerados em meses fechados.
UPDATE balance_snapshots s SET
  income = COALESCE((
    SELECT SUM(CASE WHEN t.type IN ('income', 'transfer_in') THEN t.amount ELSE 0 END)
    FROM transactions t
    WHERE t.user_id = s.user_id AND t.deleted_at IS NULL
      AND t.date >= s.month
      AND t.date <= (date_trunc('month', s.month) + interval '1 month - 1 day')::date
  ), 0),
  expenses = COALESCE((
    SELECT SUM(CASE WHEN t.type IN ('expense', 'transfer_out') THEN t.amount ELSE 0 END)
    FROM transactions t
    WHERE t.user_id = s.user_id AND t.deleted_at IS NULL
      AND t.date >= s.month
      AND t.date <= (date_trunc('month', s.month) + interval '1 month - 1 day')::date
  ), 0);

-- Resumo mensal de um usuário: (balance, income, expenses).
--  balance  = saldo acumulado até o fim do mês
--  income   = receitas do mês (income + transfer_in, p.ex. retirada de caixinha)
--  expenses = despesas do mês (expense + transfer_out, p.ex. depósito em caixinha)
-- Usa o snapshot limpo do mês quando disponível (sem varrer histórico); caso
-- contrário (mês corrente ou snapshot sujo), computa a partir das transações.
CREATE OR REPLACE FUNCTION get_month_summary(p_user_id uuid, p_month date)
RETURNS TABLE(balance numeric, income numeric, expenses numeric) AS $$
DECLARE
  v_month     date := date_trunc('month', p_month)::date;
  v_month_end date := (v_month + interval '1 month - 1 day')::date;
  v_snap      record;
BEGIN
  SELECT s.balance, s.income, s.expenses INTO v_snap
  FROM balance_snapshots s
  WHERE s.user_id = p_user_id AND s.month = v_month AND s.is_dirty = false;

  IF FOUND THEN
    balance := v_snap.balance;
    income := v_snap.income;
    expenses := v_snap.expenses;
    RETURN NEXT;
    RETURN;
  END IF;

  balance := get_user_balance(p_user_id, v_month_end);
  SELECT
    COALESCE(SUM(CASE WHEN type IN ('income', 'transfer_in')  THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type IN ('expense', 'transfer_out') THEN amount ELSE 0 END), 0)
  INTO income, expenses
  FROM transactions
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
    AND date >= v_month
    AND date <= v_month_end;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Resumo mensal por membro da família (para a visão da família).
-- Valida que o chamador autenticado pertence à família (o cron roda via service
-- role, sem auth.uid(), e é liberado).
CREATE OR REPLACE FUNCTION get_family_month_summary(p_family_id uuid, p_month date)
RETURNS TABLE(user_id uuid, income numeric, expenses numeric, balance numeric) AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM family_members WHERE family_id = p_family_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sem permissão para esta família';
  END IF;

  RETURN QUERY
  SELECT fm.user_id, s.income, s.expenses, s.balance
  FROM family_members fm
  CROSS JOIN LATERAL get_month_summary(fm.user_id, p_month) s
  WHERE fm.family_id = p_family_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
