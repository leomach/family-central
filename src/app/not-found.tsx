import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="text-6xl">🔍</div>
        <h1 className="text-2xl font-bold">Página não encontrada</h1>
        <p className="text-muted-foreground text-sm">A página que você procura não existe.</p>
        <Button asChild>
          <Link href="/">Voltar ao início</Link>
        </Button>
      </div>
    </div>
  )
}
