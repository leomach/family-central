import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { getMonthStart } from "@/lib/utils"

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createServiceClient()

  const prevMonth = new Date()
  prevMonth.setDate(1)
  prevMonth.setMonth(prevMonth.getMonth() - 1)
  const monthStr = getMonthStart(prevMonth)

  const { data: members } = await supabase
    .from("family_members")
    .select("user_id, family_id")

  if (!members) return NextResponse.json({ ok: true, processed: 0 })

  let processed = 0

  for (const m of members) {
    const { data: existing } = await supabase
      .from("balance_snapshots")
      .select("id, is_dirty")
      .eq("user_id", m.user_id)
      .eq("month", monthStr)
      .maybeSingle()

    if (existing && !existing.is_dirty) continue

    const { data: balance } = await supabase.rpc("get_user_balance", {
      p_user_id: m.user_id,
      p_until: new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0)
        .toISOString()
        .split("T")[0],
    })

    await supabase.from("balance_snapshots").upsert({
      user_id: m.user_id,
      family_id: m.family_id,
      month: monthStr,
      balance: balance ?? 0,
      is_dirty: false,
      computed_at: new Date().toISOString(),
    }, { onConflict: "user_id,month" })

    processed++
  }

  return NextResponse.json({ ok: true, processed, month: monthStr })
}
