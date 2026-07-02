-- ============================================================================
-- Caixinhas: data customizável no depósito/retirada + edição de contribuições
-- ============================================================================

-- Atualiza contribute_to_goal para aceitar data explícita (padrão: hoje).
CREATE OR REPLACE FUNCTION contribute_to_goal(
  p_goal_id    uuid,
  p_user_id    uuid,
  p_family_id  uuid,
  p_amount     numeric,
  p_direction  text,            -- 'deposit' | 'withdraw'
  p_date       date DEFAULT CURRENT_DATE
)
RETURNS uuid AS $$
DECLARE
  v_transaction_id uuid;
  v_tx_type text;
  v_current numeric;
BEGIN
  IF p_direction = 'deposit' THEN
    v_tx_type := 'transfer_out';
  ELSE
    v_tx_type := 'transfer_in';
    SELECT current_value INTO v_current FROM savings_goals WHERE id = p_goal_id;
    IF v_current < p_amount THEN
      RAISE EXCEPTION 'Saldo insuficiente na caixinha';
    END IF;
  END IF;

  INSERT INTO transactions (family_id, user_id, type, amount, description, date)
  VALUES (
    p_family_id, p_user_id, v_tx_type, p_amount,
    CASE p_direction WHEN 'deposit' THEN 'Depósito em caixinha' ELSE 'Retirada de caixinha' END,
    p_date
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

-- Atualiza valor e data de uma contribuição existente.
-- O sinal do amount em savings_contributions é preservado (depósito +, retirada -).
CREATE OR REPLACE FUNCTION update_contribution(
  p_contribution_id uuid,
  p_amount          numeric,   -- sempre positivo
  p_date            date
)
RETURNS void AS $$
DECLARE
  v_tx_id      uuid;
  v_is_deposit boolean;
BEGIN
  SELECT transaction_id, amount > 0
  INTO v_tx_id, v_is_deposit
  FROM savings_contributions
  WHERE id = p_contribution_id;

  IF v_tx_id IS NULL THEN
    RAISE EXCEPTION 'Contribuição não encontrada';
  END IF;

  UPDATE transactions
  SET amount = p_amount, date = p_date
  WHERE id = v_tx_id;

  UPDATE savings_contributions
  SET amount = CASE WHEN v_is_deposit THEN p_amount ELSE -p_amount END
  WHERE id = p_contribution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
