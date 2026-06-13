"use client"

import { useTransition } from "react"
import { deleteEvent } from "@/actions/events"
import { Trash2 } from "lucide-react"
import { toast } from "@/components/ui/toaster"

export function DeleteEventButton({ eventId }: { eventId: string }) {
  const [pending, start] = useTransition()
  function handle() {
    start(async () => {
      const r = await deleteEvent(eventId)
      if (r.error) toast({ title: "Erro", description: r.error, variant: "destructive" })
    })
  }
  return (
    <button
      onClick={handle}
      disabled={pending}
      className="text-muted-foreground hover:text-destructive p-1 transition-colors shrink-0"
      aria-label="Remover evento"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}
