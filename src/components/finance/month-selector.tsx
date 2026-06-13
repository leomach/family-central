"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatMonth } from "@/lib/utils"

export function MonthSelector({ month }: { month: string }) {
  const router = useRouter()
  const params = useSearchParams()

  function navigate(delta: number) {
    const date = new Date(month + "T00:00:00")
    date.setMonth(date.getMonth() + delta)
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`
    const newParams = new URLSearchParams(params)
    newParams.set("month", newMonth)
    router.push(`?${newParams}`)
  }

  return (
    <div className="hidden sm:flex items-center gap-1 text-xs">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="capitalize text-muted-foreground w-24 text-center">{formatMonth(month)}</span>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
