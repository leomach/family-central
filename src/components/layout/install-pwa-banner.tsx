"use client"

import { useState } from "react"
import { usePwaInstall } from "@/hooks/use-pwa-install"
import { Button } from "@/components/ui/button"
import { Download, X, Share, ArrowUp } from "lucide-react"

export function InstallPwaBanner() {
  const { canInstall, isIos, install, dismiss } = usePwaInstall()
  const [showIosModal, setShowIosModal] = useState(false)

  if (!canInstall && !isIos) return null

  // Android / Chrome: botão nativo de instalação
  if (canInstall) {
    return (
      <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center gap-3">
        <Download className="h-4 w-4 text-primary shrink-0" />
        <p className="text-xs flex-1">Instale o app na tela inicial para acesso rápido</p>
        <Button size="sm" variant="default" onClick={install} className="h-7 text-xs">Instalar</Button>
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground p-1" aria-label="Fechar">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  // iOS Safari: instruções manuais
  return (
    <>
      <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center gap-3">
        <Share className="h-4 w-4 text-primary shrink-0" />
        <p className="text-xs flex-1">Adicione à tela inicial para usar como app</p>
        <Button size="sm" variant="default" onClick={() => setShowIosModal(true)} className="h-7 text-xs">
          Como instalar
        </Button>
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground p-1" aria-label="Fechar">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {showIosModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={() => setShowIosModal(false)}
        >
          <div
            className="bg-card border border-border rounded-t-2xl w-full max-w-sm p-6 pb-10 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base">Instalar o app</h2>
              <button onClick={() => setShowIosModal(false)} className="text-muted-foreground p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <ol className="space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                <span>
                  Toque no botão <strong>Compartilhar</strong> na barra do Safari
                  {" "}
                  <ArrowUp className="inline h-4 w-4 text-primary" />
                  {" "}
                  (ícone no centro da barra inferior)
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                <span>
                  Role para baixo e toque em <strong>&quot;Adicionar à Tela de Início&quot;</strong>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
                <span>
                  Toque em <strong>&quot;Adicionar&quot;</strong> no canto superior direito
                </span>
              </li>
            </ol>

            <p className="text-xs text-muted-foreground text-center">
              O app vai aparecer na sua tela inicial como qualquer outro aplicativo
            </p>

            <Button variant="outline" className="w-full" onClick={() => { setShowIosModal(false); dismiss() }}>
              Entendi
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
