"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, TrendingUp, ShoppingCart, ListChecks, Target } from "lucide-react"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/", label: "Início", icon: Home, exact: true },
  { href: "/financeiro", label: "Finanças", icon: TrendingUp },
  { href: "/compras", label: "Compras", icon: ShoppingCart },
  { href: "/tarefas", label: "Tarefas", icon: ListChecks },
  { href: "/enxoval", label: "Metas", icon: Target },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background pb-safe">
      <div className="flex">
        {nav.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "scale-110")} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
