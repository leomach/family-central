"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatMonth } from "@/lib/utils"

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

export function MonthSelector({ month }: { month: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const [pickerOpen, setPickerOpen] = useState(false)

  const selected = new Date(month + "T00:00:00")
  const [pickerYear, setPickerYear] = useState(selected.getFullYear())

  function push(date: Date) {
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`
    const newParams = new URLSearchParams(params)
    newParams.set("month", newMonth)
    router.push(`?${newParams}`)
  }

  function navigate(delta: number) {
    const date = new Date(month + "T00:00:00")
    date.setMonth(date.getMonth() + delta)
    push(date)
  }

  function selectMonth(year: number, monthIndex: number) {
    push(new Date(year, monthIndex, 1))
    setPickerOpen(false)
  }

  function openPicker() {
    setPickerYear(selected.getFullYear())
    setPickerOpen(true)
  }

  return (
    <div className="relative flex items-center gap-1 text-xs">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        className="h-7 px-2 capitalize text-muted-foreground w-28 text-xs font-normal"
        onClick={openPicker}
      >
        {formatMonth(month)}
      </Button>

      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>

      {pickerOpen && (
        <>
          {/* overlay para fechar ao clicar fora */}
          <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />

          <div className="absolute top-full right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg p-3 w-52">
            {/* navegação de ano */}
            <div className="flex items-center justify-between mb-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => { e.stopPropagation(); setPickerYear((y) => y - 1) }}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="text-sm font-medium">{pickerYear}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => { e.stopPropagation(); setPickerYear((y) => y + 1) }}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>

            {/* grid de meses */}
            <div className="grid grid-cols-3 gap-1">
              {MONTHS.map((label, idx) => {
                const isSelected =
                  pickerYear === selected.getFullYear() && idx === selected.getMonth()
                return (
                  <button
                    key={idx}
                    onClick={() => selectMonth(pickerYear, idx)}
                    className={`text-xs py-1.5 rounded-md transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
