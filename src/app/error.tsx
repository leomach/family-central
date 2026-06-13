"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-6xl">⚠️</div>
        <h1 className="text-2xl font-bold">Algo deu errado</h1>
        <p className="text-muted-foreground text-sm">
          {error.message || "Tente recarregar a página. Se o erro persistir, fale com o suporte."}
        </p>
        <div className="flex gap-2 justify-center pt-2">
          <Button onClick={reset}>Tentar de novo</Button>
          <Button variant="outline" onClick={() => window.location.href = "/"}>Voltar ao início</Button>
        </div>
      </div>
    </div>
  )
}
