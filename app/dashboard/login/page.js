"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";
import { LayoutDashboard, Mail, Lock, Globe, MailCheck } from "lucide-react";
import { useLanguage } from "../../../lib/LanguageContext";
import { PASSWORD_MIN_LENGTH, passwordRuleMessage } from "../../../lib/passwordRules";

export default function DashboardLoginPage() {
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);

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

    const passwordIssue = passwordRuleMessage(password, t);
    if (passwordIssue) {
      setError(passwordIssue);
      return;
    }

    setLoading(true);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (!signUpData.session) {
      // Email confirmation is required on this project — there's no active
      // session yet, so the restaurant row can't be created until they
      // confirm and log in (see handleSave in settings/page.js for the
      // first-time-insert path that runs at that point).
      setConfirmationPending(true);
      return;
    }

    router.push("/dashboard/settings?onboarding=true");
  }

  if (confirmationPending) {
    return (
      <div className="mx-auto max-w-sm min-h-screen bg-ivory px-6 pt-16 text-center">
        <MailCheck size={32} className="text-teal mx-auto mb-4" />
        <h1 className="font-serif text-xl text-ink mb-2">{t("confirmEmailTitle")}</h1>
        <p className="text-sm text-neutral-500">{t("confirmEmailBody", { email })}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm min-h-screen bg-ivory px-6 pt-16">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <LayoutDashboard size={20} className="text-teal" />
          <h1 className="font-serif text-2xl text-ink">{t("partnerLogin")}</h1>
        </div>
        <button
          onClick={() => setLang(lang === "en" ? "ar" : "en")}
          className="flex items-center gap-1 text-xs rounded-full px-2.5 py-1.5 bg-white border border-neutral-200 flex-shrink-0"
        >
          <Globe size={12} /> {lang === "en" ? "عربي" : "EN"}
        </button>
      </div>
      <p className="text-sm text-neutral-500 mb-6">
        {mode === "login" ? t("signInSubtitle") : t("signUpSubtitle")}
      </p>

      <form onSubmit={mode === "login" ? handleLogin : handleSignup} className="flex flex-col gap-4">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-neutral-400">{t("email")}</label>
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
          <label className="text-[10px] uppercase tracking-widest text-neutral-400">{t("password")}</label>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 mt-2 bg-white border border-neutral-200">
            <Lock size={15} className="text-neutral-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="flex-1 bg-transparent outline-none text-sm"
              required
              minLength={PASSWORD_MIN_LENGTH}
            />
          </div>
          {mode === "signup" && (
            <p className="text-[11px] text-neutral-400 mt-1.5">{t("passwordRuleHint", { min: PASSWORD_MIN_LENGTH })}</p>
          )}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full py-3 text-sm font-medium bg-teal text-ivory disabled:opacity-60"
        >
          {loading ? t("pleaseWait") : mode === "login" ? t("signIn") : t("createAccount")}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setError("");
        }}
        className="w-full text-center text-xs mt-5 text-neutral-500 underline"
      >
        {mode === "login" ? t("newRestaurantSignUp") : t("haveAccountSignIn")}
      </button>
    </div>
  );
}
