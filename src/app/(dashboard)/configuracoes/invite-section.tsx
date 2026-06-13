"use client"

import { useState } from "react"
import { generateInvite } from "@/actions/family"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function InviteSection({ familyId }: { familyId: string }) {
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    const result = await generateInvite(familyId)
    if (result.code) setCode(result.code)
    setLoading(false)
  }

  async function handleCopy() {
    const link = `${window.location.origin}/invite/${code}`
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Convidar membro</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!code ? (
          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? "Gerando..." : "Gerar código de convite"}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="bg-muted rounded-lg p-4 text-center">
              <p className="text-2xl font-mono font-bold tracking-widest">{code}</p>
              <p className="text-xs text-muted-foreground mt-1">Válido por 7 dias</p>
            </div>
            <Button onClick={handleCopy} variant="outline" className="w-full">
              {copied ? "✅ Copiado!" : "Copiar link de convite"}
            </Button>
            <Button onClick={() => setCode("")} variant="ghost" className="w-full text-sm">
              Gerar novo código
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
