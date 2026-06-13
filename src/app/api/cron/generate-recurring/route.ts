import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const { data, error } = await supabase.rpc("generate_recurring_transactions")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, generated: data ?? 0 })
}
