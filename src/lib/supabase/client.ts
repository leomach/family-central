"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/database"

let client: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key) {
      throw new Error(
        "Variáveis do Supabase ausentes: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ou _ANON_KEY) no .env.local"
      )
    }

    client = createBrowserClient<Database>(url, key)
  }
  return client
}
