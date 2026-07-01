import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date + "T00:00:00"))
}

export function formatDateShort(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(date + "T00:00:00"))
}

export function formatMonth(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(date + "T00:00:00"))
}

// Fuso horário de referência da aplicação. "Hoje" e "mês atual" precisam ser
// resolvidos neste fuso — o servidor (Vercel) roda em UTC, e usar UTC faria um
// lançamento feito à noite no Brasil cair no dia/mês seguinte.
export const APP_TIMEZONE = "America/Sao_Paulo"

// Data de hoje (YYYY-MM-DD) no fuso da aplicação, independente do fuso do runtime.
export function todayLocalISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(new Date())
}

export function currentMonthStart(): string {
  return todayLocalISO().slice(0, 7) + "-01"
}

// Aceita uma string "YYYY-MM-DD" (usa o mês literal, sem conversão de fuso) ou um
// Date (resolvido no fuso da aplicação). Retorna o primeiro dia do mês.
export function getMonthStart(date: string | Date = new Date()): string {
  if (typeof date === "string") return date.slice(0, 7) + "-01"
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(date).slice(0, 7) + "-01"
}

// Divide um valor monetário entre participantes.
// - Trabalha em centavos inteiros para evitar erros de ponto flutuante.
// - Usa proportionMap (proporção de renda) quando disponível; se ninguém tiver
//   proporção > 0, divide igualmente.
// - Distribui os centavos restantes pelo método do maior resto (soma sempre exata).
// - Garante no mínimo 1 centavo por participante.
// Retorna { error } quando o valor é pequeno demais para todos receberem 1 centavo.
export function splitAmount(
  amount: number,
  participants: string[],
  proportionMap?: Map<string, number>
): Map<string, number> | { error: string } {
  const n = participants.length
  const totalCents = Math.round(amount * 100)
  if (n === 0) return { error: "Nenhum participante" }
  if (totalCents < n) {
    return { error: `Valor muito baixo para dividir entre ${n} participante(s)` }
  }

  const rawWeights = participants.map((uid) => {
    const p = proportionMap?.get(uid)
    return p && p > 0 ? p : 0
  })
  const rawSum = rawWeights.reduce((a, b) => a + b, 0)
  const weights = rawSum > 0 ? rawWeights : participants.map(() => 1)
  const weightSum = weights.reduce((a, b) => a + b, 0)

  const exact = weights.map((w) => (w / weightSum) * totalCents)
  const cents = exact.map((x) => Math.floor(x))
  let remainder = totalCents - cents.reduce((a, b) => a + b, 0)

  // Distribui o resto (centavos) para os maiores restos fracionários.
  const byFrac = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac)
  for (let k = 0; k < remainder; k++) cents[byFrac[k % n].i]++

  // Garante mínimo de 1 centavo por participante, tirando de quem tem mais.
  for (let i = 0; i < n; i++) {
    if (cents[i] === 0) {
      let maxIdx = 0
      for (let j = 1; j < n; j++) if (cents[j] > cents[maxIdx]) maxIdx = j
      cents[maxIdx]--
      cents[i]++
    }
  }

  const result = new Map<string, number>()
  participants.forEach((uid, i) => result.set(uid, cents[i] / 100))
  return result
}
