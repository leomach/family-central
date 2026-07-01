// Categorias padrão semeadas para cada nova família.
// São copiadas como categorias editáveis (family_id preenchido), não fixas.
// Mantidas em sincronia com o backfill em supabase/migrations/0004_editable_categories.sql.

export type DefaultCategory = {
  name: string
  type: "income" | "expense"
  icon: string
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: "Salário", type: "income", icon: "💼" },
  { name: "Freelance", type: "income", icon: "💻" },
  { name: "Investimentos", type: "income", icon: "📈" },
  { name: "Outros (receita)", type: "income", icon: "💰" },
  { name: "Moradia", type: "expense", icon: "🏠" },
  { name: "Alimentação", type: "expense", icon: "🛒" },
  { name: "Transporte", type: "expense", icon: "🚗" },
  { name: "Saúde", type: "expense", icon: "🏥" },
  { name: "Educação", type: "expense", icon: "📚" },
  { name: "Lazer", type: "expense", icon: "🎬" },
  { name: "Vestuário", type: "expense", icon: "👕" },
  { name: "Assinaturas", type: "expense", icon: "📱" },
  { name: "Outros (despesa)", type: "expense", icon: "💸" },
]
