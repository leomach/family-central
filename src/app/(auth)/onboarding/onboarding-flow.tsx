"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createFamily, joinFamily } from "@/actions/family"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Step = "choose" | "create" | "join"

export function OnboardingFlow() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("choose")
  const [familyName, setFamilyName] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const result = await createFamily(familyName)
    if (result.error) { setError(result.error); setLoading(false); return }
    router.push("/financeiro")
    router.refresh()
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const result = await joinFamily(inviteCode.trim().toUpperCase())
    if (result.error) { setError(result.error); setLoading(false); return }
    router.push("/financeiro")
    router.refresh()
  }

  if (step === "choose") {
    return (
      <div className="space-y-3">
        <Button className="w-full h-16 flex-col gap-1" onClick={() => setStep("create")}>
          <span className="font-semibold">Criar nova família</span>
          <span className="text-xs opacity-70">Você será o administrador</span>
        </Button>
        <Button variant="outline" className="w-full h-16 flex-col gap-1" onClick={() => setStep("join")}>
          <span className="font-semibold">Entrar com código de convite</span>
          <span className="text-xs opacity-70">Alguém já criou a família</span>
        </Button>
      </div>
    )
  }

  if (step === "create") {
    return (
      <form onSubmit={handleCreate} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="family-name">Nome da família</Label>
          <Input
            id="family-name"
            placeholder="Família Silva"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Criando..." : "Criar família"}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("choose")}>
          Voltar
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={handleJoin} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="invite-code">Código de convite</Label>
        <Input
          id="invite-code"
          placeholder="XXXXXXXX"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          maxLength={8}
          className="tracking-widest uppercase text-center text-lg"
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Entrando..." : "Entrar na família"}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("choose")}>
        Voltar
      </Button>
    </form>
  )
}
