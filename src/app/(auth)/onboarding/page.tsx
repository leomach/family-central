import type { Metadata } from "next"
import { OnboardingFlow } from "./onboarding-flow"

export const metadata: Metadata = { title: "Configurar família" }

export default function OnboardingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="text-4xl">🏠</div>
          <h1 className="text-2xl font-bold tracking-tight">Configure sua família</h1>
          <p className="text-muted-foreground text-sm">
            Crie uma nova família ou entre em uma existente
          </p>
        </div>
        <OnboardingFlow />
      </div>
    </div>
  )
}
