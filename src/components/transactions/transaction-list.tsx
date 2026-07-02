import type { Category, Transaction } from "@/types/database"
import type { MemberInfo } from "@/lib/family"
import { TransactionCard } from "./transaction-card"

interface TransactionListProps {
  transactions: Transaction[]
  members?: MemberInfo[]
  showOwner?: boolean
  emptyMessage?: string
  categories?: Category[]
  currentUserId?: string
}

export function TransactionList({ transactions, members = [], showOwner, emptyMessage, categories = [], currentUserId }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-3xl mb-2">📭</p>
        <p className="text-sm">{emptyMessage ?? "Nenhum lançamento"}</p>
      </div>
    )
  }

  const grouped = transactions.reduce<Record<string, Transaction[]>>((acc, tx) => {
    const key = tx.date
    if (!acc[key]) acc[key] = []
    acc[key].push(tx)
    return acc
  }, {})

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-4">
      {sortedDates.map((date) => (
        <div key={date}>
          <p className="text-xs text-muted-foreground mb-2 px-1 capitalize">
            {new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "short" }).format(new Date(date + "T00:00:00"))}
          </p>
          <div className="space-y-1">
            {grouped[date].map((tx) => (
              <TransactionCard key={tx.id} transaction={tx} members={members} showOwner={showOwner} categories={categories} currentUserId={currentUserId} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
