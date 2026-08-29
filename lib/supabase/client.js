import { createBrowserClient } from "@supabase/ssr";

// Sessions are stored in cookies (not localStorage) via @supabase/ssr, and
// refreshed server-side on every request by middleware.js — see
// PROJECT_STATUS.md's security section for what this does and doesn't protect
// against in an otherwise fully client-rendered app.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
