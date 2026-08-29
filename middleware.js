import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Refreshes the Supabase session cookie on every request (server-side,
// independent of any client-side code) and gates /dashboard routes so a
// customer account can never reach the restaurant dashboard — this is the
// server-side enforcement layer; RLS remains the data-level enforcement
// underneath it. See PROJECT_STATUS.md's security section for details.
export async function middleware(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isDashboardRoute = pathname.startsWith("/dashboard") && pathname !== "/dashboard/login";
  // Settings is also where a brand-new owner completes onboarding (creates
  // their first restaurant row), so it can't require pre-existing ownership
  // the way the rest of the dashboard can.
  const requiresExistingRestaurant = isDashboardRoute && pathname !== "/dashboard/settings";

  if (isDashboardRoute) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/login";
      return NextResponse.redirect(url);
    }

    if (requiresExistingRestaurant) {
      const { data: owned } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .limit(1);

      if (!owned || owned.length === 0) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
