-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── FAMILIES ────────────────────────────────────────────────────────────────

CREATE TABLE families (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ─── FAMILY MEMBERS ──────────────────────────────────────────────────────────

CREATE TABLE family_members (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE (family_id, user_id)
);

-- ─── FAMILY INVITES ───────────────────────────────────────────────────────────

CREATE TABLE family_invites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  code       text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  used_by    uuid REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now()
);

-- ─── CATEGORIES ───────────────────────────────────────────────────────────────

CREATE TABLE categories (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid REFERENCES families(id) ON DELETE CASCADE,
  name      text NOT NULL,
  type      text NOT NULL CHECK (type IN ('income', 'expense')),
  icon      text,
  UNIQUE (family_id, name, type)
);

-- Default system categories (family_id = NULL)
INSERT INTO categories (name, type, icon) VALUES
  ('Salário',          'income',  '💼'),
  ('Freelance',        'income',  '💻'),
  ('Investimentos',    'income',  '📈'),
  ('Outros (receita)', 'income',  '💰'),
  ('Moradia',          'expense', '🏠'),
  ('Alimentação',      'expense', '🛒'),
  ('Transporte',       'expense', '🚗'),
  ('Saúde',            'expense', '🏥'),
  ('Educação',         'expense', '📚'),
  ('Lazer',            'expense', '🎬'),
  ('Vestuário',        'expense', '👕'),
  ('Assinaturas',      'expense', '📱'),
  ('Outros (despesa)', 'expense', '💸');

-- ─── TRANSACTION GROUPS ───────────────────────────────────────────────────────

CREATE TABLE transaction_groups (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  description  text NOT NULL,
  total_amount numeric(12,2) NOT NULL CHECK (total_amount > 0),
  date         date NOT NULL,
  created_at   timestamptz DEFAULT now()
);

-- ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

CREATE TABLE transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id    uuid REFERENCES transaction_groups(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('income', 'expense', 'transfer_out', 'transfer_in')),
  amount      numeric(12,2) NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  date        date NOT NULL,
  deleted_at  timestamptz,
  created_at  timestamptz DEFAULT now()
);

-- ─── INCOME PROPORTIONS ───────────────────────────────────────────────────────

CREATE TABLE income_proportions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month      date NOT NULL,
  proportion numeric(6,5) NOT NULL CHECK (proportion >= 0 AND proportion <= 1),
  UNIQUE (family_id, user_id, month)
);

-- ─── BALANCE SNAPSHOTS ────────────────────────────────────────────────────────

CREATE TABLE balance_snapshots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month       date NOT NULL,
  balance     numeric(12,2) NOT NULL,
  is_dirty    boolean NOT NULL DEFAULT false,
  computed_at timestamptz DEFAULT now(),
  UNIQUE (user_id, month)
);

-- ─── SAVINGS GOALS ────────────────────────────────────────────────────────────

CREATE TABLE savings_goals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id     uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name          text NOT NULL,
  target_value  numeric(12,2) NOT NULL CHECK (target_value > 0),
  current_value numeric(12,2) NOT NULL DEFAULT 0 CHECK (current_value >= 0),
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at    timestamptz DEFAULT now()
);

-- ─── SAVINGS CONTRIBUTIONS ────────────────────────────────────────────────────

CREATE TABLE savings_contributions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id        uuid NOT NULL REFERENCES savings_goals(id) ON DELETE RESTRICT,
  user_id        uuid NOT NULL REFERENCES auth.users(id),
  family_id      uuid NOT NULL REFERENCES families(id),
  amount         numeric(12,2) NOT NULL,
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  created_at     timestamptz DEFAULT now()
);

-- ─── PUSH SUBSCRIPTIONS ───────────────────────────────────────────────────────

CREATE TABLE push_subscriptions (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint  text NOT NULL UNIQUE,
  p256dh    text NOT NULL,
  auth_key  text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ─── TRIGGERS ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_goal_current_value()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE savings_goals
  SET current_value = (
    SELECT COALESCE(SUM(amount), 0)
    FROM savings_contributions
    WHERE goal_id = COALESCE(NEW.goal_id, OLD.goal_id)
  ),
  status = CASE
    WHEN (SELECT COALESCE(SUM(amount), 0) FROM savings_contributions WHERE goal_id = COALESCE(NEW.goal_id, OLD.goal_id)) >= target_value THEN 'completed'
    ELSE 'active'
  END
  WHERE id = COALESCE(NEW.goal_id, OLD.goal_id)
    AND status != 'cancelled';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_goal_value
AFTER INSERT OR UPDATE OR DELETE ON savings_contributions
FOR EACH ROW EXECUTE FUNCTION sync_goal_current_value();

-- ─── FUNCTIONS ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_user_balance(p_user_id uuid, p_until date DEFAULT CURRENT_DATE)
RETURNS numeric AS $$
DECLARE
  v_snapshot_month date;
  v_snapshot_balance numeric := 0;
  v_recent_sum numeric := 0;
  v_from_date date := '1900-01-01';
BEGIN
  SELECT month, balance INTO v_snapshot_month, v_snapshot_balance
  FROM balance_snapshots
  WHERE user_id = p_user_id
    AND month < date_trunc('month', p_until)::date
    AND is_dirty = false
  ORDER BY month DESC
  LIMIT 1;

  IF v_snapshot_month IS NOT NULL THEN
    v_from_date := (v_snapshot_month + interval '1 month')::date;
  END IF;

  SELECT COALESCE(SUM(
    CASE type
      WHEN 'income'       THEN  amount
      WHEN 'expense'      THEN -amount
      WHEN 'transfer_out' THEN -amount
      WHEN 'transfer_in'  THEN  amount
    END
  ), 0) INTO v_recent_sum
  FROM transactions
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
    AND date >= v_from_date
    AND date <= p_until;

  RETURN COALESCE(v_snapshot_balance, 0) + v_recent_sum;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- ─── ÍNDICES ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_transactions_user_date   ON transactions (user_id, date) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_family_date ON transactions (family_id, date) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_group       ON transactions (group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_snapshots_user_month     ON balance_snapshots (user_id, month DESC);
CREATE INDEX idx_proportions_family_month ON income_proportions (family_id, month);
CREATE INDEX idx_invites_code             ON family_invites (code) WHERE used_by IS NULL;
CREATE INDEX idx_family_members_user      ON family_members (user_id);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────

ALTER TABLE families            ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invites      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_groups  ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_proportions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_snapshots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions  ENABLE ROW LEVEL SECURITY;

-- families: acesso ao próprio membro
CREATE POLICY "families_member_access" ON families
  USING (id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

-- family_members: ver membros da própria família
CREATE POLICY "family_members_same_family" ON family_members
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

-- family_invites: ver/criar convites da própria família
CREATE POLICY "invites_family_scope" ON family_invites
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

-- categories: ver categorias do sistema (family_id NULL) e da própria família
CREATE POLICY "categories_scope" ON categories
  USING (family_id IS NULL OR family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

-- transaction_groups: escopo da família
CREATE POLICY "tgroups_family_scope" ON transaction_groups
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

-- transactions: escopo da família (para leitura); Service Role para inserts de split
CREATE POLICY "transactions_family_scope" ON transactions
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

-- income_proportions: escopo da família
CREATE POLICY "proportions_family_scope" ON income_proportions
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

-- balance_snapshots: apenas o próprio usuário
CREATE POLICY "snapshots_own_user" ON balance_snapshots
  USING (user_id = auth.uid());

-- savings_goals: escopo da família
CREATE POLICY "goals_family_scope" ON savings_goals
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

-- savings_contributions: escopo da família
CREATE POLICY "contributions_family_scope" ON savings_contributions
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

-- push_subscriptions: apenas o próprio usuário
CREATE POLICY "push_own_user" ON push_subscriptions
  USING (user_id = auth.uid());
