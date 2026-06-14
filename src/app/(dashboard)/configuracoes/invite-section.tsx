"use client"

import { useState } from "react"
import { generateInvite } from "@/actions/family"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Share2, Copy, Check, RefreshCw } from "lucide-react"

export function InviteSection({ familyId, familyName }: { familyId: string; familyName: string }) {
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    const result = await generateInvite(familyId)
    if (result.code) setCode(result.code)
    setLoading(false)
  }

  function getInviteLink() {
    return `${window.location.origin}/invite/${code}`
  }

  async function handleShare() {
    const link = getInviteLink()
    if (navigator.share) {
      await navigator.share({
        title: `Entrar na família ${familyName}`,
        text: `Use o código ${code} ou o link abaixo para entrar na nossa família no Central da Família:`,
        url: link,
      })
    } else {
      await handleCopy()
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(getInviteLink())
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const canShare = typeof navigator !== "undefined" && !!navigator.share

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

            {/* Botão principal: Share nativo no celular, Copiar no desktop */}
            <Button onClick={handleShare} className="w-full gap-2">
              {canShare ? (
                <>
                  <Share2 className="h-4 w-4" />
                  Compartilhar convite
                </>
              ) : copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Link copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar link de convite
                </>
              )}
            </Button>

            {/* No celular, exibe também o botão de copiar separado */}
            {canShare && (
              <Button onClick={handleCopy} variant="outline" className="w-full gap-2">
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Link copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copiar link
                  </>
                )}
              </Button>
            )}

            <Button onClick={() => setCode("")} variant="ghost" className="w-full text-sm gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Gerar novo código
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
