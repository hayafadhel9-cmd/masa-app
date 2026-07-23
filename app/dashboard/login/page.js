"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { LayoutDashboard, Mail, Lock } from "lucide-react";

export default function DashboardLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
  }

  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    const userId = signUpData.user?.id;
    if (userId) {
      const { error: insertError } = await supabase.from("restaurants").insert({
        name: restaurantName || "My Restaurant",
        owner_id: userId,
        subscription_status: "trial",
      });
      if (insertError) {
        setLoading(false);
        setError("Account created, but restaurant setup failed: " + insertError.message);
        return;
      }
    }

    setLoading(false);
    router.push("/dashboard");
  }

  return (
    <div className="mx-auto max-w-sm min-h-screen bg-ivory px-6 pt-16">
      <div className="flex items-center gap-2 mb-1">
        <LayoutDashboard size={20} className="text-teal" />
        <h1 className="font-serif text-2xl text-ink">Partner login</h1>
      </div>
      <p className="text-sm text-neutral-500 mb-6">
        {mode === "login" ? "Sign in to manage your restaurant." : "Create your restaurant account."}
      </p>

      <form onSubmit={mode === "login" ? handleLogin : handleSignup} className="flex flex-col gap-4">
        {mode === "signup" && (
          <div>
            <label className="text-[10px] uppercase tracking-widest text-neutral-400">Restaurant name</label>
            <input
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              placeholder="e.g. Ember & Vine"
              className="w-full rounded-lg px-3 py-2.5 text-sm mt-2 outline-none bg-white border border-neutral-200"
              required
            />
          </div>
        )}

        <div>
          <label className="text-[10px] uppercase tracking-widest text-neutral-400">Email</label>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 mt-2 bg-white border border-neutral-200">
            <Mail size={15} className="text-neutral-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@restaurant.com"
              className="flex-1 bg-transparent outline-none text-sm"
              required
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-neutral-400">Password</label>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 mt-2 bg-white border border-neutral-200">
            <Lock size={15} className="text-neutral-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="flex-1 bg-transparent outline-none text-sm"
              required
              minLength={6}
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full py-3 text-sm font-medium bg-teal text-ivory disabled:opacity-60"
        >
          {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setError("");
        }}
        className="w-full text-center text-xs mt-5 text-neutral-500 underline"
      >
        {mode === "login" ? "New restaurant? Create an account" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
