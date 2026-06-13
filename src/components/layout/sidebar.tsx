"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, TrendingUp, Target, Settings, ListChecks, ShoppingCart, Calendar as CalendarIcon, PieChart } from "lucide-react"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/", label: "Início", icon: Home, exact: true },
  { href: "/financeiro", label: "Financeiro", icon: TrendingUp },
  { href: "/orcamento", label: "Orçamento", icon: PieChart },
  { href: "/enxoval", label: "Caixinhas", icon: Target },
  { href: "/compras", label: "Compras", icon: ShoppingCart },
  { href: "/tarefas", label: "Tarefas", icon: ListChecks },
  { href: "/calendario", label: "Calendário", icon: CalendarIcon },
  { href: "/configuracoes", label: "Ajustes", icon: Settings },
]

export function Sidebar({ familyName, userName }: { familyName: string; userName: string }) {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex flex-col w-56 border-r border-border bg-background shrink-0">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏠</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{familyName}</p>
            <p className="text-xs text-muted-foreground truncate">{userName}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
