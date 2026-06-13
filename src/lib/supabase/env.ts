/**
 * Resolve as variáveis de ambiente do Supabase aceitando tanto os nomes
 * novos (publishable/secret) quanto os legados (anon/service_role).
 */

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL não está definida no .env.local")
  return url
}

export function getSupabasePublishableKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!key) {
    throw new Error(
      "Defina NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ou NEXT_PUBLIC_SUPABASE_ANON_KEY) no .env.local"
    )
  }
  return key
}

export function getSupabaseSecretKey(): string {
  const key =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error(
      "Defina SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) no .env.local"
    )
  }
  return key
}
