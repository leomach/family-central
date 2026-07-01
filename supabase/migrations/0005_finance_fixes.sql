-- ─────────────────────────────────────────────────────────────────────────────
-- Correções da lógica financeira
--
--  #2  Rateio nunca gera parcela R$ 0,00 (respeita CHECK amount > 0) e uma falha
--      em um lançamento recorrente não aborta o batch inteiro do cron.
--  #3  Lançamento recorrente compartilhado invalida o snapshot de TODOS os
--      participantes (não só do dono) — o saldo dos demais estava desatualizado.
--  #4  A próxima data respeita day_of_month e não "escorrega" (31 → 28 → 28 ...).
--  #5  Recorrente compartilhada divide por proporção de renda (igual à manual),
--      com fallback para divisão igual.
--  #6  Depósito em caixinha valida saldo pessoal (evita saldo negativo silencioso).
--  #12 Retirada de caixinha trava a linha da meta (FOR UPDATE) contra corridas.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── AUXILIAR: divide um total (em centavos) por pesos ───────────────────────
-- Retorna um array de centavos que soma exatamente p_total, distribuindo o resto
-- pelo método do maior resto e garantindo no mínimo 1 centavo por participante.
-- Requer p_total >= n (validado pelo chamador). Se todos os pesos forem <= 0,
-- divide igualmente.
CREATE OR REPLACE FUNCTION split_cents(p_total int, p_weights numeric[])
RETURNS int[] AS $$
DECLARE
  n       int := array_length(p_weights, 1);
  wsum    numeric := 0;
  weights numeric[] := p_weights;
  cents   int[];
  fracs   numeric[];
  exact   numeric;
  rem     int;
  i       int;
  j       int;
  maxidx  int;
BEGIN
  IF n IS NULL OR n = 0 THEN RETURN ARRAY[]::int[]; END IF;

  FOR i IN 1..n LOOP wsum := wsum + GREATEST(weights[i], 0); END LOOP;
  IF wsum <= 0 THEN
    weights := array_fill(1::numeric, ARRAY[n]);
    wsum := n;
  END IF;

  cents := array_fill(0, ARRAY[n]);
  fracs := array_fill(0::numeric, ARRAY[n]);
  FOR i IN 1..n LOOP
    exact := (GREATEST(weights[i], 0) / wsum) * p_total;
    cents[i] := floor(exact);
    fracs[i] := exact - floor(exact);
  END LOOP;

  rem := p_total;
  FOR i IN 1..n LOOP rem := rem - cents[i]; END LOOP;

  -- Distribui os centavos restantes para os maiores restos fracionários.
  WHILE rem > 0 LOOP
    maxidx := 1;
    FOR j IN 2..n LOOP IF fracs[j] > fracs[maxidx] THEN maxidx := j; END IF; END LOOP;
    cents[maxidx] := cents[maxidx] + 1;
    fracs[maxidx] := -1;
    rem := rem - 1;
  END LOOP;

  -- Garante mínimo de 1 centavo por participante (p_total >= n garante viabilidade).
  FOR i IN 1..n LOOP
    IF cents[i] = 0 THEN
      maxidx := 1;
      FOR j IN 2..n LOOP IF cents[j] > cents[maxidx] THEN maxidx := j; END IF; END LOOP;
      cents[maxidx] := cents[maxidx] - 1;
      cents[i] := cents[i] + 1;
    END IF;
  END LOOP;

  RETURN cents;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ─── GERAÇÃO DE RECORRENTES (reescrita) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_recurring_transactions()
RETURNS int AS $$
DECLARE
  v_count int := 0;
  v_record record;
  v_next_date date;
BEGIN
  FOR v_record IN
    SELECT * FROM recurring_transactions
    WHERE is_active = true
      AND next_run_date <= CURRENT_DATE
      AND (end_date IS NULL OR next_run_date <= end_date)
  LOOP
    BEGIN
      -- Insere transação(ões)
      IF v_record.shared_participants IS NOT NULL AND array_length(v_record.shared_participants, 1) > 1 THEN
        DECLARE
          v_group_id     uuid := gen_random_uuid();
          v_participants uuid[] := v_record.shared_participants;
          v_np           int := array_length(v_record.shared_participants, 1);
          v_month        date := date_trunc('month', v_record.next_run_date)::date;
          v_weights      numeric[] := ARRAY[]::numeric[];
          v_cents        int[];
          v_total_cents  int := round(v_record.amount * 100);
          v_w            numeric;
          v_idx          int;
        BEGIN
          -- Valor pequeno demais para ratear: pula (será retentado se corrigido).
          IF v_total_cents < v_np THEN
            RAISE EXCEPTION 'Valor insuficiente para ratear entre % participantes', v_np;
          END IF;

          -- Pesos = proporção de renda do mês (fallback para divisão igual no split_cents).
          FOR v_idx IN 1..v_np LOOP
            SELECT proportion INTO v_w
            FROM income_proportions
            WHERE family_id = v_record.family_id
              AND user_id = v_participants[v_idx]
              AND month = v_month;
            v_weights := array_append(v_weights, COALESCE(v_w, 0));
          END LOOP;

          v_cents := split_cents(v_total_cents, v_weights);

          INSERT INTO transaction_groups (id, family_id, description, total_amount, date)
          VALUES (v_group_id, v_record.family_id, v_record.description, v_record.amount, v_record.next_run_date);

          FOR v_idx IN 1..v_np LOOP
            INSERT INTO transactions (family_id, user_id, group_id, type, amount, description, category_id, date)
            VALUES (v_record.family_id, v_participants[v_idx], v_group_id, v_record.type,
                    v_cents[v_idx]::numeric / 100, v_record.description, v_record.category_id, v_record.next_run_date);

            -- #3: invalida snapshot de CADA participante.
            UPDATE balance_snapshots SET is_dirty = true
            WHERE user_id = v_participants[v_idx]
              AND month >= v_month;
          END LOOP;
        END;
      ELSE
        INSERT INTO transactions (family_id, user_id, type, amount, description, category_id, date)
        VALUES (v_record.family_id, v_record.user_id, v_record.type, v_record.amount,
                v_record.description, v_record.category_id, v_record.next_run_date);

        UPDATE balance_snapshots SET is_dirty = true
        WHERE user_id = v_record.user_id
          AND month >= date_trunc('month', v_record.next_run_date)::date;
      END IF;

      -- #4: próxima data respeitando day_of_month (sem escorregar).
      v_next_date := CASE v_record.frequency
        WHEN 'weekly' THEN (v_record.next_run_date + interval '7 days')::date
        WHEN 'yearly' THEN (v_record.next_run_date + interval '1 year')::date
        WHEN 'monthly' THEN
          CASE
            WHEN v_record.day_of_month IS NOT NULL THEN
              (date_trunc('month', v_record.next_run_date + interval '1 month')::date
               + (LEAST(
                    v_record.day_of_month,
                    extract(day FROM (date_trunc('month', v_record.next_run_date + interval '2 month')::date - 1))::int
                  ) - 1))
            ELSE (v_record.next_run_date + interval '1 month')::date
          END
      END;

      UPDATE recurring_transactions
      SET next_run_date = v_next_date
      WHERE id = v_record.id;

      v_count := v_count + 1;

    EXCEPTION WHEN OTHERS THEN
      -- #2: um lançamento problemático não aborta os demais do batch.
      RAISE WARNING 'Falha ao gerar recorrente %: %', v_record.id, SQLERRM;
      CONTINUE;
    END;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── CONTRIBUIÇÃO EM CAIXINHA (reescrita) ────────────────────────────────────
CREATE OR REPLACE FUNCTION contribute_to_goal(
  p_goal_id    uuid,
  p_user_id    uuid,
  p_family_id  uuid,
  p_amount     numeric,
  p_direction  text  -- 'deposit' or 'withdraw'
)
RETURNS uuid AS $$
DECLARE
  v_transaction_id uuid;
  v_tx_type text;
  v_current numeric;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser positivo';
  END IF;

  IF p_direction = 'deposit' THEN
    v_tx_type := 'transfer_out';
    -- #6: não permite depositar mais do que o saldo pessoal disponível.
    IF get_user_balance(p_user_id) < p_amount THEN
      RAISE EXCEPTION 'Saldo pessoal insuficiente para o depósito';
    END IF;
  ELSE
    v_tx_type := 'transfer_in';
    -- #12: trava a linha da meta durante a transação para evitar corrida.
    SELECT current_value INTO v_current FROM savings_goals WHERE id = p_goal_id FOR UPDATE;
    IF v_current IS NULL THEN
      RAISE EXCEPTION 'Caixinha não encontrada';
    END IF;
    IF v_current < p_amount THEN
      RAISE EXCEPTION 'Saldo insuficiente na caixinha';
    END IF;
  END IF;

  INSERT INTO transactions (family_id, user_id, type, amount, description, date)
  VALUES (
    p_family_id, p_user_id, v_tx_type, p_amount,
    CASE p_direction WHEN 'deposit' THEN 'Depósito em caixinha' ELSE 'Retirada de caixinha' END,
    CURRENT_DATE
  )
  RETURNING id INTO v_transaction_id;

  INSERT INTO savings_contributions (goal_id, user_id, family_id, amount, transaction_id)
  VALUES (
    p_goal_id, p_user_id, p_family_id,
    CASE p_direction WHEN 'deposit' THEN p_amount ELSE -p_amount END,
    v_transaction_id
  );

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
