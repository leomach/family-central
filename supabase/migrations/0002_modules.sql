-- ─── ORÇAMENTO MENSAL POR CATEGORIA ─────────────────────────────────────────

CREATE TABLE budgets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  category_id  uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  month        date NOT NULL,
  limit_amount numeric(12,2) NOT NULL CHECK (limit_amount > 0),
  created_at   timestamptz DEFAULT now(),
  UNIQUE (family_id, category_id, month)
);

CREATE INDEX idx_budgets_family_month ON budgets (family_id, month);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budgets_family_scope" ON budgets
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

-- ─── LANÇAMENTOS RECORRENTES ─────────────────────────────────────────────────

CREATE TABLE recurring_transactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id           uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type                text NOT NULL CHECK (type IN ('income', 'expense')),
  amount              numeric(12,2) NOT NULL CHECK (amount > 0),
  description         text NOT NULL,
  category_id         uuid REFERENCES categories(id) ON DELETE SET NULL,
  frequency           text NOT NULL CHECK (frequency IN ('monthly', 'weekly', 'yearly')),
  day_of_month        int CHECK (day_of_month BETWEEN 1 AND 31),
  day_of_week         int CHECK (day_of_week BETWEEN 0 AND 6),
  shared_participants uuid[] DEFAULT NULL,
  start_date          date NOT NULL,
  end_date            date,
  next_run_date       date NOT NULL,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_recurring_next_run ON recurring_transactions (next_run_date) WHERE is_active = true;
CREATE INDEX idx_recurring_family ON recurring_transactions (family_id);

ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recurring_family_scope" ON recurring_transactions
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

-- ─── LISTAS DE COMPRAS ───────────────────────────────────────────────────────

CREATE TABLE shopping_lists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name        text NOT NULL,
  icon        text DEFAULT '🛒',
  archived    boolean NOT NULL DEFAULT false,
  created_by  uuid NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lists_family_scope" ON shopping_lists
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

CREATE TABLE shopping_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id         uuid NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  family_id       uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name            text NOT NULL,
  quantity        numeric(10,2) NOT NULL DEFAULT 1,
  unit            text,
  estimated_price numeric(12,2),
  notes           text,
  completed       boolean NOT NULL DEFAULT false,
  completed_at    timestamptz,
  completed_by    uuid REFERENCES auth.users(id),
  added_by        uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_shopping_items_list ON shopping_items (list_id, completed, created_at DESC);

ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items_family_scope" ON shopping_items
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

-- ─── TAREFAS COMPARTILHADAS ──────────────────────────────────────────────────

CREATE TABLE todos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  assigned_to  uuid REFERENCES auth.users(id),
  due_date     date,
  priority     text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  completed    boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  created_by   uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_todos_family ON todos (family_id, completed, due_date NULLS LAST);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "todos_family_scope" ON todos
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

-- ─── EVENTOS / CALENDÁRIO ────────────────────────────────────────────────────

CREATE TABLE events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  event_date   date NOT NULL,
  type         text NOT NULL DEFAULT 'reminder' CHECK (type IN ('reminder', 'anniversary', 'bill', 'appointment', 'goal')),
  icon         text,
  recurring    text CHECK (recurring IN ('yearly', 'monthly', 'weekly')),
  created_by   uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_events_family_date ON events (family_id, event_date);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_family_scope" ON events
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

-- ─── COMENTÁRIOS EM TRANSAÇÕES (chat estilo Honeydue) ────────────────────────

CREATE TABLE transaction_comments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  family_id      uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id),
  content        text NOT NULL,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX idx_comments_tx ON transaction_comments (transaction_id, created_at);

ALTER TABLE transaction_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_family_scope" ON transaction_comments
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

-- ─── FUNÇÃO: gerar lançamentos recorrentes pendentes ─────────────────────────

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
    -- Insere transação(ões)
    IF v_record.shared_participants IS NOT NULL AND array_length(v_record.shared_participants, 1) > 1 THEN
      -- Compartilhada: cria um grupo
      DECLARE
        v_group_id uuid := gen_random_uuid();
        v_share numeric;
        v_allocated numeric := 0;
        v_participant uuid;
        v_idx int := 0;
      BEGIN
        INSERT INTO transaction_groups (id, family_id, description, total_amount, date)
        VALUES (v_group_id, v_record.family_id, v_record.description, v_record.amount, v_record.next_run_date);

        FOREACH v_participant IN ARRAY v_record.shared_participants LOOP
          v_idx := v_idx + 1;
          IF v_idx = array_length(v_record.shared_participants, 1) THEN
            v_share := v_record.amount - v_allocated;
          ELSE
            v_share := round(v_record.amount / array_length(v_record.shared_participants, 1), 2);
            v_allocated := v_allocated + v_share;
          END IF;

          INSERT INTO transactions (family_id, user_id, group_id, type, amount, description, category_id, date)
          VALUES (v_record.family_id, v_participant, v_group_id, v_record.type, v_share,
                  v_record.description, v_record.category_id, v_record.next_run_date);
        END LOOP;
      END;
    ELSE
      INSERT INTO transactions (family_id, user_id, type, amount, description, category_id, date)
      VALUES (v_record.family_id, v_record.user_id, v_record.type, v_record.amount,
              v_record.description, v_record.category_id, v_record.next_run_date);
    END IF;

    -- Invalida snapshots
    UPDATE balance_snapshots SET is_dirty = true
    WHERE user_id = v_record.user_id
      AND month >= date_trunc('month', v_record.next_run_date)::date;

    -- Calcula próxima data
    v_next_date := CASE v_record.frequency
      WHEN 'monthly' THEN (v_record.next_run_date + interval '1 month')::date
      WHEN 'weekly'  THEN (v_record.next_run_date + interval '7 days')::date
      WHEN 'yearly'  THEN (v_record.next_run_date + interval '1 year')::date
    END;

    UPDATE recurring_transactions
    SET next_run_date = v_next_date
    WHERE id = v_record.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
