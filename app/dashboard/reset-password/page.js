"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";
import { LayoutDashboard, Lock, Globe, Eye, EyeOff, AlertTriangle, Check } from "lucide-react";
import { useLanguage } from "../../../lib/LanguageContext";
import { PASSWORD_MIN_LENGTH, passwordRuleMessage } from "../../../lib/passwordRules";
import { useCapsLockWarning } from "../../../lib/useCapsLockWarning";
import { authErrorMessage } from "../../../lib/authErrorMessage";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ivory flex items-center justify-center text-sm text-neutral-400">Loading…</div>}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang, setLang, t } = useLanguage();
  const { capsLockOn, checkCapsLock } = useCapsLockWarning();

  const [status, setStatus] = useState("checking"); // "checking" | "ready" | "invalid"
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function establishSession() {
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled && error) {
          setStatus("invalid");
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!cancelled && data.session) {
        setStatus("ready");
      }
    }

    // The recovery session can also arrive via the client's own hash-fragment
    // detection (older email link format) slightly after this effect runs,
    // so listen for it in addition to the explicit code-exchange path above.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setStatus("ready");
      }
    });

    establishSession();

    const timeout = setTimeout(() => {
      if (!cancelled) {
        setStatus((current) => (current === "checking" ? "invalid" : current));
      }
    }, 4000);

    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe();
      clearTimeout(timeout);
    };
  }, [searchParams]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const passwordIssue = passwordRuleMessage(password, t);
    if (passwordIssue) {
      setError(passwordIssue);
      return;
    }
    if (password !== confirmPassword) {
      setError(t("passwordsDontMatch"));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(authErrorMessage(error, t));
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push("/dashboard"), 1500);
  }

  const langToggle = (
    <button
      onClick={() => setLang(lang === "en" ? "ar" : "en")}
      className="flex items-center gap-1 text-xs rounded-full px-2.5 py-1.5 bg-white border border-neutral-200 flex-shrink-0"
    >
      <Globe size={12} /> {lang === "en" ? "عربي" : "EN"}
    </button>
  );

  if (status === "checking") {
    return (
      <div className="mx-auto max-w-sm min-h-screen bg-ivory px-6 pt-16 text-center">
        <p className="text-sm text-neutral-500">{t("loading")}</p>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="mx-auto max-w-sm min-h-screen bg-ivory px-6 pt-16 text-center">
        <AlertTriangle size={32} className="text-red-600 mx-auto mb-4" />
        <p className="text-sm text-neutral-500 mb-6">{t("invalidResetLink")}</p>
        <button
          onClick={() => router.push("/dashboard/login")}
          className="text-xs text-neutral-500 underline"
        >
          {t("backToSignIn")}
        </button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto max-w-sm min-h-screen bg-ivory px-6 pt-16 text-center">
        <Check size={32} className="text-teal mx-auto mb-4" />
        <p className="text-sm text-neutral-500">{t("passwordResetSuccess")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm min-h-screen bg-ivory px-6 pt-16">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <LayoutDashboard size={20} className="text-teal" />
          <h1 className="font-serif text-2xl text-ink">{t("resetPasswordTitle")}</h1>
        </div>
        {langToggle}
      </div>
      <p className="text-sm text-neutral-500 mb-6">{t("resetPasswordSubtitle")}</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-neutral-400">{t("newPassword")}</label>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 mt-2 bg-white border border-neutral-200">
            <Lock size={15} className="text-neutral-400" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={checkCapsLock}
              onKeyUp={checkCapsLock}
              placeholder="••••••••"
              className="flex-1 bg-transparent outline-none text-sm"
              required
              minLength={PASSWORD_MIN_LENGTH}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              className="text-neutral-400 flex-shrink-0"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {capsLockOn && (
            <p className="text-[11px] text-red-600 mt-1.5 flex items-center gap-1">
              <AlertTriangle size={11} /> {t("capsLockWarning")}
            </p>
          )}
          <p className="text-[11px] text-neutral-400 mt-1.5">{t("passwordRuleHint", { min: PASSWORD_MIN_LENGTH })}</p>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-neutral-400">{t("confirmPassword")}</label>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 mt-2 bg-white border border-neutral-200">
            <Lock size={15} className="text-neutral-400" />
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="flex-1 bg-transparent outline-none text-sm"
              required
              minLength={PASSWORD_MIN_LENGTH}
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full py-3 text-sm font-medium bg-teal text-ivory disabled:opacity-60"
        >
          {loading ? t("pleaseWait") : t("resetPasswordButton")}
        </button>
      </form>
    </div>
  );
}
