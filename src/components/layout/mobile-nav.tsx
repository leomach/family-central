"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Home, TrendingUp, ShoppingCart, ListChecks, MoreHorizontal, X, Target, Calendar, PieChart, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const mainNav = [
  { href: "/", label: "Início", icon: Home, exact: true },
  { href: "/financeiro", label: "Finanças", icon: TrendingUp },
  { href: "/compras", label: "Compras", icon: ShoppingCart },
  { href: "/tarefas", label: "Tarefas", icon: ListChecks },
]

const moreNav = [
  { href: "/enxoval", label: "Metas", icon: Target },
  { href: "/orcamento", label: "Orçamento", icon: PieChart },
  { href: "/calendario", label: "Calendário", icon: Calendar },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
]

export function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const activeInMore = moreNav.some(({ href }) => pathname.startsWith(href))

  return (
    <>
      {/* Drawer "Mais" */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div
            className="absolute bottom-16 inset-x-0 bg-background border-t border-border pb-2 px-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-4 gap-1 pt-3 pb-1">
              {moreNav.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-1 py-3 px-1 rounded-lg text-[11px] transition-colors",
                      active ? "bg-accent text-foreground font-medium" : "text-muted-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background pb-safe">
        <div className="flex">
          {mainNav.map(({ href, label, icon: Icon, exact }) => {
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

          {/* Botão "Mais" */}
          <button
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors",
              (open || activeInMore) ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {open ? (
              <X className="h-5 w-5 scale-110" />
            ) : (
              <MoreHorizontal className={cn("h-5 w-5", activeInMore && "scale-110")} />
            )}
            Mais
          </button>
        </div>
      </nav>
    </>
  )
}
