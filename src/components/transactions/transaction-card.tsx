"use client"

import { useState } from "react"
import type { Transaction } from "@/types/database"
import type { MemberInfo } from "@/lib/family"
import { formatCurrency, cn } from "@/lib/utils"
import { deleteTransaction } from "@/actions/transactions"
import { Badge } from "@/components/ui/badge"
import { Trash2, Users } from "lucide-react"
import { toast } from "@/components/ui/toaster"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

interface TransactionCardProps {
  transaction: Transaction
  members?: MemberInfo[]
  showOwner?: boolean
}

export function TransactionCard({ transaction: tx, members = [], showOwner }: TransactionCardProps) {
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const isPositive = tx.type === "income" || tx.type === "transfer_in"
  const isShared = !!tx.group_id
  const owner = members.find((m) => m.user_id === tx.user_id)

  async function handleDelete() {
    setDeleting(true)
    try {
      const result = await deleteTransaction(tx.id)
      if (result.error) {
        toast({ title: "Erro ao excluir", description: result.error, variant: "destructive" })
        setDeleting(false)
      }
    } catch {
      toast({ title: "Erro ao excluir", description: "Tente novamente", variant: "destructive" })
      setDeleting(false)
    }
  }

  return (
    <>
      <div className={cn("flex items-center justify-between p-3 rounded-lg bg-card hover:bg-muted/50 transition-colors", deleting && "opacity-50 pointer-events-none")}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl shrink-0" aria-hidden>
            {tx.category?.icon ?? (tx.type === "income" ? "💰" : tx.type.startsWith("transfer") ? "🏦" : "💸")}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{tx.description}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {tx.category && (
                <span className="text-xs text-muted-foreground">{tx.category.name}</span>
              )}
              {isShared && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
                  <Users className="h-2.5 w-2.5" />
                  Dividido
                </Badge>
              )}
              {showOwner && owner && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {owner.name.split(" ")[0]}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={cn("text-sm font-semibold whitespace-nowrap", isPositive ? "text-income" : "text-expense")}>
            {isPositive ? "+" : "−"}{formatCurrency(Number(tx.amount))}
          </span>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={deleting}
            className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded -mr-1"
            aria-label="Excluir lançamento"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={isShared ? "Excluir lançamento compartilhado?" : "Excluir lançamento?"}
        description={isShared
          ? "Este lançamento faz parte de um grupo compartilhado. Excluí-lo removerá a fração de todos os participantes."
          : `Esta ação não pode ser desfeita. ${formatCurrency(Number(tx.amount))} será removido.`}
        confirmLabel="Excluir"
        destructive
        onConfirm={handleDelete}
      />
    </>
  )
}
