export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="space-y-3 text-center">
        <div className="h-8 w-8 mx-auto border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  )
}
