export type TransactionType = "income" | "expense" | "transfer_out" | "transfer_in"
export type FamilyRole = "owner" | "admin" | "member"
export type GoalStatus = "active" | "completed" | "cancelled"
export type RecurringFrequency = "monthly" | "weekly" | "yearly"
export type TodoPriority = "low" | "normal" | "high"
export type EventType = "reminder" | "anniversary" | "bill" | "appointment" | "goal"

export type Family = { id: string; name: string; created_at: string }
export type FamilyMember = { id: string; family_id: string; user_id: string; role: FamilyRole; joined_at: string }
export type FamilyInvite = {
  id: string; family_id: string; code: string; created_by: string
  used_by: string | null; expires_at: string; created_at: string
}
export type Category = { id: string; family_id: string | null; name: string; type: "income" | "expense"; icon: string | null }
export type TransactionGroup = {
  id: string; family_id: string; description: string
  total_amount: number; date: string; created_at: string
}
export type Transaction = {
  id: string; family_id: string; user_id: string; group_id: string | null
  type: TransactionType; amount: number; description: string
  category_id: string | null; date: string; deleted_at: string | null; created_at: string
  category?: Pick<Category, "id" | "name" | "icon" | "type"> | null
  group?: TransactionGroup | null
}
export type IncomeProportions = {
  id: string; family_id: string; user_id: string; month: string; proportion: number
}
export type BalanceSnapshot = {
  id: string; family_id: string; user_id: string; month: string
  balance: number; is_dirty: boolean; computed_at: string
}
export type SavingsGoal = {
  id: string; family_id: string; name: string
  target_value: number; current_value: number; status: GoalStatus; created_at: string
}
export type SavingsContribution = {
  id: string; goal_id: string; user_id: string; family_id: string
  amount: number; transaction_id: string; created_at: string
}
export type PushSubscription = {
  id: string; user_id: string; endpoint: string
  p256dh: string; auth_key: string; created_at: string
}
export type Budget = {
  id: string; family_id: string; category_id: string
  month: string; limit_amount: number; created_at: string
  category?: Pick<Category, "id" | "name" | "icon" | "type"> | null
}
export type RecurringTransaction = {
  id: string; family_id: string; user_id: string
  type: "income" | "expense"; amount: number; description: string
  category_id: string | null; frequency: RecurringFrequency
  day_of_month: number | null; day_of_week: number | null
  shared_participants: string[] | null
  start_date: string; end_date: string | null; next_run_date: string
  is_active: boolean; created_at: string
  category?: Pick<Category, "id" | "name" | "icon" | "type"> | null
}
export type ShoppingList = {
  id: string; family_id: string; name: string
  icon: string | null; archived: boolean
  created_by: string; created_at: string
}
export type ShoppingItem = {
  id: string; list_id: string; family_id: string
  name: string; quantity: number; unit: string | null
  estimated_price: number | null; notes: string | null
  completed: boolean; completed_at: string | null; completed_by: string | null
  added_by: string; created_at: string
}
export type Todo = {
  id: string; family_id: string; title: string; description: string | null
  assigned_to: string | null; due_date: string | null; priority: TodoPriority
  completed: boolean; completed_at: string | null; completed_by: string | null
  created_by: string; created_at: string
}
export type CalendarEvent = {
  id: string; family_id: string; title: string; description: string | null
  event_date: string; type: EventType; icon: string | null
  recurring: "yearly" | "monthly" | "weekly" | null
  created_by: string; created_at: string
}
export type TransactionComment = {
  id: string; transaction_id: string; family_id: string
  user_id: string; content: string; created_at: string
}

export type Database = {
  __InternalSupabase: { PostgrestVersion: "12" }
  public: {
    Tables: {
      families: {
        Row: Family
        Insert: { id?: string; name: string; created_at?: string }
        Update: { id?: string; name?: string; created_at?: string }
        Relationships: []
      }
      family_members: {
        Row: FamilyMember
        Insert: { id?: string; family_id: string; user_id: string; role: FamilyRole; joined_at?: string }
        Update: { id?: string; family_id?: string; user_id?: string; role?: FamilyRole; joined_at?: string }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          }
        ]
      }
      family_invites: {
        Row: FamilyInvite
        Insert: { id?: string; family_id: string; code: string; created_by: string; expires_at: string; used_by?: string | null; created_at?: string }
        Update: { used_by?: string | null; expires_at?: string }
        Relationships: []
      }
      categories: {
        Row: Category
        Insert: { id?: string; family_id?: string | null; name: string; type: "income" | "expense"; icon?: string | null }
        Update: { id?: string; family_id?: string | null; name?: string; type?: "income" | "expense"; icon?: string | null }
        Relationships: []
      }
      transaction_groups: {
        Row: TransactionGroup
        Insert: { id?: string; family_id: string; description: string; total_amount: number; date: string; created_at?: string }
        Update: { id?: string; family_id?: string; description?: string; total_amount?: number; date?: string }
        Relationships: []
      }
      transactions: {
        Row: Transaction
        Insert: { id?: string; family_id: string; user_id: string; group_id?: string | null; type: TransactionType; amount: number; description: string; category_id?: string | null; date: string; deleted_at?: string | null; created_at?: string }
        Update: { id?: string; family_id?: string; user_id?: string; group_id?: string | null; type?: TransactionType; amount?: number; description?: string; category_id?: string | null; date?: string; deleted_at?: string | null }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "transaction_groups"
            referencedColumns: ["id"]
          }
        ]
      }
      income_proportions: {
        Row: IncomeProportions
        Insert: { id?: string; family_id: string; user_id: string; month: string; proportion: number }
        Update: { id?: string; family_id?: string; user_id?: string; month?: string; proportion?: number }
        Relationships: []
      }
      balance_snapshots: {
        Row: BalanceSnapshot
        Insert: { id?: string; family_id: string; user_id: string; month: string; balance: number; is_dirty?: boolean; computed_at?: string }
        Update: { balance?: number; is_dirty?: boolean; computed_at?: string }
        Relationships: []
      }
      savings_goals: {
        Row: SavingsGoal
        Insert: { id?: string; family_id: string; name: string; target_value: number; current_value?: number; status?: GoalStatus; created_at?: string }
        Update: { id?: string; family_id?: string; name?: string; target_value?: number; current_value?: number; status?: GoalStatus }
        Relationships: []
      }
      savings_contributions: {
        Row: SavingsContribution
        Insert: { id?: string; goal_id: string; user_id: string; family_id: string; amount: number; transaction_id: string; created_at?: string }
        Update: { amount?: number }
        Relationships: []
      }
      push_subscriptions: {
        Row: PushSubscription
        Insert: { id?: string; user_id: string; endpoint: string; p256dh: string; auth_key: string; created_at?: string }
        Update: { endpoint?: string; p256dh?: string; auth_key?: string }
        Relationships: []
      }
      budgets: {
        Row: Budget
        Insert: { id?: string; family_id: string; category_id: string; month: string; limit_amount: number; created_at?: string }
        Update: { limit_amount?: number }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      recurring_transactions: {
        Row: RecurringTransaction
        Insert: { id?: string; family_id: string; user_id: string; type: "income" | "expense"; amount: number; description: string; category_id?: string | null; frequency: RecurringFrequency; day_of_month?: number | null; day_of_week?: number | null; shared_participants?: string[] | null; start_date: string; end_date?: string | null; next_run_date: string; is_active?: boolean; created_at?: string }
        Update: { amount?: number; description?: string; category_id?: string | null; frequency?: RecurringFrequency; day_of_month?: number | null; day_of_week?: number | null; shared_participants?: string[] | null; end_date?: string | null; next_run_date?: string; is_active?: boolean }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      shopping_lists: {
        Row: ShoppingList
        Insert: { id?: string; family_id: string; name: string; icon?: string | null; archived?: boolean; created_by: string; created_at?: string }
        Update: { name?: string; icon?: string | null; archived?: boolean }
        Relationships: []
      }
      shopping_items: {
        Row: ShoppingItem
        Insert: { id?: string; list_id: string; family_id: string; name: string; quantity?: number; unit?: string | null; estimated_price?: number | null; notes?: string | null; completed?: boolean; completed_at?: string | null; completed_by?: string | null; added_by: string; created_at?: string }
        Update: { name?: string; quantity?: number; unit?: string | null; estimated_price?: number | null; notes?: string | null; completed?: boolean; completed_at?: string | null; completed_by?: string | null }
        Relationships: [
          {
            foreignKeyName: "shopping_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          }
        ]
      }
      todos: {
        Row: Todo
        Insert: { id?: string; family_id: string; title: string; description?: string | null; assigned_to?: string | null; due_date?: string | null; priority?: TodoPriority; completed?: boolean; completed_at?: string | null; completed_by?: string | null; created_by: string; created_at?: string }
        Update: { title?: string; description?: string | null; assigned_to?: string | null; due_date?: string | null; priority?: TodoPriority; completed?: boolean; completed_at?: string | null; completed_by?: string | null }
        Relationships: []
      }
      events: {
        Row: CalendarEvent
        Insert: { id?: string; family_id: string; title: string; description?: string | null; event_date: string; type: EventType; icon?: string | null; recurring?: "yearly" | "monthly" | "weekly" | null; created_by: string; created_at?: string }
        Update: { title?: string; description?: string | null; event_date?: string; type?: EventType; icon?: string | null; recurring?: "yearly" | "monthly" | "weekly" | null }
        Relationships: []
      }
      transaction_comments: {
        Row: TransactionComment
        Insert: { id?: string; transaction_id: string; family_id: string; user_id: string; content: string; created_at?: string }
        Update: { content?: string }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      get_user_balance: {
        Args: { p_user_id: string; p_until?: string }
        Returns: number
      }
      contribute_to_goal: {
        Args: { p_goal_id: string; p_user_id: string; p_family_id: string; p_amount: number; p_direction: "deposit" | "withdraw" }
        Returns: string
      }
      generate_recurring_transactions: {
        Args: Record<string, never>
        Returns: number
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
