import { getFamilyContext } from "@/lib/family"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { OfflineBanner } from "@/components/layout/offline-banner"
import { InstallPwaBanner } from "@/components/layout/install-pwa-banner"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getFamilyContext()

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar familyName={ctx.familyName} userName={ctx.userName} />
      <main className="flex-1 overflow-y-auto relative">
        <OfflineBanner />
        <InstallPwaBanner />
        <div className="pb-24 md:pb-6">{children}</div>
      </main>
      <MobileNav />
    </div>
  )
}
