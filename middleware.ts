import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup") || pathname.startsWith("/onboarding")
  const isPublicRoute = isAuthRoute || pathname.startsWith("/invite") || pathname === "/offline" || pathname.startsWith("/auth/")
  const isCronRoute = pathname.startsWith("/api/cron")
  const isIconRoute = pathname.startsWith("/api/icon")

  if (isCronRoute || isIconRoute) return supabaseResponse

  // Não autenticado → login
  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Autenticado em rota de auth → checar se tem família
  if (user && isAuthRoute && pathname !== "/onboarding") {
    const { data: member } = await supabase
      .from("family_members")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (!member) {
      return NextResponse.redirect(new URL("/onboarding", request.url))
    }

    return NextResponse.redirect(new URL("/financeiro", request.url))
  }

  // Autenticado sem família → onboarding
  if (user && !isPublicRoute) {
    const { data: member } = await supabase
      .from("family_members")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (!member && pathname !== "/onboarding") {
      return NextResponse.redirect(new URL("/onboarding", request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|screenshots|sw.js|workbox-.*).*)"],
}
