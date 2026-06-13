import type { Metadata } from "next"
import Link from "next/link"
import { SignupForm } from "./signup-form"

export const metadata: Metadata = { title: "Cadastrar" }

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="text-4xl">🏠</div>
          <h1 className="text-2xl font-bold tracking-tight">Criar conta</h1>
          <p className="text-muted-foreground text-sm">Comece a gerenciar as finanças do lar</p>
        </div>
        <SignupForm />
        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link href="/login" className="text-foreground underline underline-offset-4">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
