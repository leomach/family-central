-- ============================================================================
-- FIX: Recursão infinita em family_members
-- ============================================================================
-- A política antiga fazia: family_id IN (SELECT family_id FROM family_members ...)
-- Quando RLS verificava family_members, rodava subquery em family_members,
-- que rodava RLS de novo → recursão infinita.
--
-- Solução: função SECURITY DEFINER que retorna family_id do usuário SEM RLS.
-- Todas as políticas viram USING (family_id = current_user_family_id()) — simples.
-- ============================================================================

-- ─── 1. Função helper (bypassa RLS porque é SECURITY DEFINER) ───────────────

CREATE OR REPLACE FUNCTION current_user_family_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_id FROM family_members WHERE user_id = auth.uid() LIMIT 1
$$;

-- ─── 2. Apagar políticas antigas (que causam recursão) ──────────────────────

DROP POLICY IF EXISTS "families_member_access"          ON families;
DROP POLICY IF EXISTS "family_members_same_family"      ON family_members;
DROP POLICY IF EXISTS "invites_family_scope"            ON family_invites;
DROP POLICY IF EXISTS "categories_scope"                ON categories;
DROP POLICY IF EXISTS "tgroups_family_scope"            ON transaction_groups;
DROP POLICY IF EXISTS "transactions_family_scope"       ON transactions;
DROP POLICY IF EXISTS "proportions_family_scope"        ON income_proportions;
DROP POLICY IF EXISTS "snapshots_own_user"              ON balance_snapshots;
DROP POLICY IF EXISTS "goals_family_scope"              ON savings_goals;
DROP POLICY IF EXISTS "contributions_family_scope"      ON savings_contributions;
DROP POLICY IF EXISTS "push_own_user"                   ON push_subscriptions;
DROP POLICY IF EXISTS "budgets_family_scope"            ON budgets;
DROP POLICY IF EXISTS "recurring_family_scope"          ON recurring_transactions;
DROP POLICY IF EXISTS "lists_family_scope"              ON shopping_lists;
DROP POLICY IF EXISTS "items_family_scope"              ON shopping_items;
DROP POLICY IF EXISTS "todos_family_scope"              ON todos;
DROP POLICY IF EXISTS "events_family_scope"             ON events;
DROP POLICY IF EXISTS "comments_family_scope"           ON transaction_comments;

-- ─── 3. families: usuário acessa apenas a família dele ──────────────────────

CREATE POLICY "families_select" ON families
  FOR SELECT USING (id = current_user_family_id());

CREATE POLICY "families_insert" ON families
  FOR INSERT WITH CHECK (true); -- qualquer authed user pode criar família nova

CREATE POLICY "families_update" ON families
  FOR UPDATE USING (id = current_user_family_id());

-- ─── 4. family_members: SEM recursão. Política simples por user_id ─────────

-- SELECT: ver membros da MINHA família (compara family_id com o resultado da função)
CREATE POLICY "family_members_select" ON family_members
  FOR SELECT USING (family_id = current_user_family_id() OR user_id = auth.uid());

-- INSERT: o usuário pode se adicionar a uma família (onboarding/invite)
CREATE POLICY "family_members_insert" ON family_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- UPDATE/DELETE: só o próprio usuário
CREATE POLICY "family_members_update" ON family_members
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "family_members_delete" ON family_members
  FOR DELETE USING (user_id = auth.uid());

-- ─── 5. family_invites: escopo da família ───────────────────────────────────

CREATE POLICY "invites_all" ON family_invites
  FOR ALL USING (family_id = current_user_family_id() OR used_by IS NULL)
  WITH CHECK (family_id = current_user_family_id());

-- ─── 6. categories: sistema (NULL) + família ────────────────────────────────

CREATE POLICY "categories_select" ON categories
  FOR SELECT USING (family_id IS NULL OR family_id = current_user_family_id());

CREATE POLICY "categories_modify" ON categories
  FOR ALL USING (family_id = current_user_family_id())
  WITH CHECK (family_id = current_user_family_id());

-- ─── 7. Demais tabelas: escopo direto da família ────────────────────────────

CREATE POLICY "tgroups_all" ON transaction_groups
  FOR ALL USING (family_id = current_user_family_id())
  WITH CHECK (family_id = current_user_family_id());

CREATE POLICY "transactions_all" ON transactions
  FOR ALL USING (family_id = current_user_family_id())
  WITH CHECK (family_id = current_user_family_id());

CREATE POLICY "proportions_all" ON income_proportions
  FOR ALL USING (family_id = current_user_family_id())
  WITH CHECK (family_id = current_user_family_id());

CREATE POLICY "snapshots_all" ON balance_snapshots
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "goals_all" ON savings_goals
  FOR ALL USING (family_id = current_user_family_id())
  WITH CHECK (family_id = current_user_family_id());

CREATE POLICY "contributions_all" ON savings_contributions
  FOR ALL USING (family_id = current_user_family_id())
  WITH CHECK (family_id = current_user_family_id());

CREATE POLICY "push_all" ON push_subscriptions
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "budgets_all" ON budgets
  FOR ALL USING (family_id = current_user_family_id())
  WITH CHECK (family_id = current_user_family_id());

CREATE POLICY "recurring_all" ON recurring_transactions
  FOR ALL USING (family_id = current_user_family_id())
  WITH CHECK (family_id = current_user_family_id());

CREATE POLICY "lists_all" ON shopping_lists
  FOR ALL USING (family_id = current_user_family_id())
  WITH CHECK (family_id = current_user_family_id());

CREATE POLICY "items_all" ON shopping_items
  FOR ALL USING (family_id = current_user_family_id())
  WITH CHECK (family_id = current_user_family_id());

CREATE POLICY "todos_all" ON todos
  FOR ALL USING (family_id = current_user_family_id())
  WITH CHECK (family_id = current_user_family_id());

CREATE POLICY "events_all" ON events
  FOR ALL USING (family_id = current_user_family_id())
  WITH CHECK (family_id = current_user_family_id());

CREATE POLICY "comments_all" ON transaction_comments
  FOR ALL USING (family_id = current_user_family_id())
  WITH CHECK (family_id = current_user_family_id());

-- ─── 8. Garantir permissão para usar a função ───────────────────────────────

GRANT EXECUTE ON FUNCTION current_user_family_id() TO authenticated, anon;
