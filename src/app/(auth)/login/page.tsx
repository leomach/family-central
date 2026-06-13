import type { Metadata } from "next"
import Link from "next/link"
import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Entrar" }

interface Props {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="text-4xl">🏠</div>
          <h1 className="text-2xl font-bold tracking-tight">Central da Família</h1>
          <p className="text-muted-foreground text-sm">Entre na sua conta</p>
        </div>
        {error && (
          <p className="text-sm text-destructive text-center rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3">
            {decodeURIComponent(error)}
          </p>
        )}
        <LoginForm />
        <p className="text-center text-sm text-muted-foreground">
          Não tem conta?{" "}
          <Link href="/signup" className="text-foreground underline underline-offset-4">
            Cadastrar
          </Link>
        </p>
      </div>
    </div>
  )
}
