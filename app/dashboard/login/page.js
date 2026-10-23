"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";
import { Mail, Lock, User, Store, MailCheck, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useLanguage } from "../../../lib/LanguageContext";
import { PASSWORD_MIN_LENGTH, passwordRuleMessage } from "../../../lib/passwordRules";
import { useCapsLockWarning } from "../../../lib/useCapsLockWarning";
import { authErrorMessage } from "../../../lib/authErrorMessage";

function Wordmark() {
  return (
    <div className="mb-6">
      <div className="font-serif text-[32px] font-extrabold text-burgundy leading-none">Held</div>
      <div className="w-8 h-0.5 bg-brass mt-2.5" />
    </div>
  );
}

function FieldLabel({ children }) {
  return <label className="text-[10px] font-bold uppercase tracking-widest text-taupe">{children}</label>;
}

function FieldShell({ icon, children }) {
  return (
    <div className="flex items-center gap-2 rounded-full px-4 py-3 mt-2 bg-tan">
      {icon}
      {children}
    </div>
  );
}

function LangToggle({ lang, setLang }) {
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "en" ? "ar" : "en")}
      className="w-full text-center text-xs text-taupe underline mt-10"
    >
      {lang === "en" ? "العربية" : "English"}
    </button>
  );
}

export default function DashboardLoginPage() {
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();
  const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { capsLockOn, checkCapsLock } = useCapsLockWarning();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [resetLinkSent, setResetLinkSent] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(authErrorMessage(error, t));
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
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, pending_restaurant_name: restaurantName } },
    });
    setLoading(false);
    if (signUpError) {
      setError(authErrorMessage(signUpError, t));
      return;
    }

    if (!signUpData.session) {
      // Email confirmation is required on this project — there's no active
      // session yet, so the restaurant row can't be created until they
      // confirm and log in (see handleSave in settings/page.js for the
      // first-time-insert path that runs at that point, which prefills the
      // name from pending_restaurant_name above).
      setConfirmationPending(true);
      return;
    }

    router.push("/dashboard/settings?onboarding=true");
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/dashboard/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(authErrorMessage(error, t));
      return;
    }
    setResetLinkSent(true);
  }

  if (confirmationPending) {
    return (
      <div className="mx-auto max-w-sm min-h-screen bg-cream px-6 pt-16 text-center">
        <MailCheck size={32} className="text-burgundy mx-auto mb-4" />
        <h1 className="font-serif text-xl text-charcoal mb-2">{t("confirmEmailTitle")}</h1>
        <p className="text-sm text-muted">{t("confirmEmailBody", { email })}</p>
      </div>
    );
  }

  if (resetLinkSent) {
    return (
      <div className="mx-auto max-w-sm min-h-screen bg-cream px-6 pt-16 text-center">
        <MailCheck size={32} className="text-burgundy mx-auto mb-4" />
        <h1 className="font-serif text-xl text-charcoal mb-2">{t("resetLinkSentTitle")}</h1>
        <p className="text-sm text-muted mb-6">{t("resetLinkSentBody", { email })}</p>
        <button
          onClick={() => {
            setResetLinkSent(false);
            setMode("login");
          }}
          className="text-xs text-burgundy underline font-medium"
        >
          {t("backToSignIn")}
        </button>
      </div>
    );
  }

  if (mode === "forgot") {
    return (
      <div className="mx-auto max-w-sm min-h-screen bg-cream px-6 pt-16 pb-10">
        <Wordmark />
        <h1 className="font-serif text-2xl text-charcoal mb-1">{t("resetPasswordTitle")}</h1>
        <p className="text-sm text-muted mb-6">{t("forgotPasswordSubtitle")}</p>

        <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
          <div>
            <FieldLabel>{t("email")}</FieldLabel>
            <FieldShell icon={<Mail size={15} className="text-taupe flex-shrink-0" />}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@restaurant.com"
                className="flex-1 bg-transparent outline-none text-sm text-charcoal placeholder:text-taupe"
                required
              />
            </FieldShell>
          </div>

          {error && <p className="text-xs text-warn">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full py-3.5 text-sm font-semibold bg-burgundy text-offwhite disabled:opacity-60"
          >
            {loading ? t("pleaseWait") : t("sendResetLink")}
          </button>
        </form>

        <button
          onClick={() => {
            setMode("login");
            setError("");
          }}
          className="w-full text-center text-xs mt-5 text-burgundy underline font-medium"
        >
          {t("backToSignIn")}
        </button>
        <LangToggle lang={lang} setLang={setLang} />
      </div>
    );
  }

  if (mode === "signup") {
    return (
      <div className="mx-auto max-w-sm min-h-screen bg-cream px-6 pt-16 pb-10">
        <Wordmark />
        <h1 className="font-serif text-2xl text-charcoal mb-1">{t("setUpRestaurant")}</h1>
        <p className="text-sm text-muted mb-6">{t("createStaffAccountSubtitle")}</p>

        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          <div>
            <FieldLabel>{t("restaurantName")}</FieldLabel>
            <FieldShell icon={<Store size={15} className="text-taupe flex-shrink-0" />}>
              <input
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                placeholder={t("restaurantNamePlaceholder")}
                className="flex-1 bg-transparent outline-none text-sm text-charcoal placeholder:text-taupe"
                required
              />
            </FieldShell>
          </div>

          <div>
            <FieldLabel>{t("yourName")}</FieldLabel>
            <FieldShell icon={<User size={15} className="text-taupe flex-shrink-0" />}>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm text-charcoal placeholder:text-taupe"
                required
              />
            </FieldShell>
          </div>

          <div>
            <FieldLabel>{t("workEmail")}</FieldLabel>
            <FieldShell icon={<Mail size={15} className="text-taupe flex-shrink-0" />}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@restaurant.com"
                className="flex-1 bg-transparent outline-none text-sm text-charcoal placeholder:text-taupe"
                required
              />
            </FieldShell>
          </div>

          <div>
            <FieldLabel>{t("password")}</FieldLabel>
            <FieldShell icon={<Lock size={15} className="text-taupe flex-shrink-0" />}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={checkCapsLock}
                onKeyUp={checkCapsLock}
                placeholder="••••••••"
                className="flex-1 bg-transparent outline-none text-sm text-charcoal placeholder:text-taupe"
                required
                minLength={PASSWORD_MIN_LENGTH}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                className="text-taupe flex-shrink-0"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </FieldShell>
            {capsLockOn && (
              <p className="text-[11px] text-warn mt-1.5 flex items-center gap-1">
                <AlertTriangle size={11} /> {t("capsLockWarning")}
              </p>
            )}
            <p className="text-[11px] text-taupe mt-1.5">{t("passwordMinHint", { min: PASSWORD_MIN_LENGTH })}</p>
          </div>

          {error && <p className="text-xs text-warn">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full py-3.5 text-sm font-semibold bg-burgundy text-offwhite disabled:opacity-60 mt-1"
          >
            {loading ? t("pleaseWait") : t("createAccount")}
          </button>
        </form>

        <div className="h-px bg-charcoal/[0.08] my-6" />

        <p className="text-center text-sm text-muted">
          {t("alreadyHaveAccount")}{" "}
          <button
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className="text-burgundy font-semibold"
          >
            {t("signIn")}
          </button>
        </p>
        <LangToggle lang={lang} setLang={setLang} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm min-h-screen bg-cream px-6 pt-16 pb-10">
      <Wordmark />
      <h1 className="font-serif text-2xl text-charcoal mb-1">{t("partnerLogin")}</h1>
      <p className="text-sm text-muted mb-6">{t("dashSignInSubtitle")}</p>

      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <div>
          <FieldLabel>{t("email")}</FieldLabel>
          <FieldShell icon={<Mail size={15} className="text-taupe flex-shrink-0" />}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@restaurant.com"
              className="flex-1 bg-transparent outline-none text-sm text-charcoal placeholder:text-taupe"
              required
            />
          </FieldShell>
        </div>

        <div>
          <FieldLabel>{t("password")}</FieldLabel>
          <FieldShell icon={<Lock size={15} className="text-taupe flex-shrink-0" />}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={checkCapsLock}
              onKeyUp={checkCapsLock}
              placeholder="••••••••"
              className="flex-1 bg-transparent outline-none text-sm text-charcoal placeholder:text-taupe"
              required
              minLength={PASSWORD_MIN_LENGTH}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              className="text-taupe flex-shrink-0"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </FieldShell>
          {capsLockOn && (
            <p className="text-[11px] text-warn mt-1.5 flex items-center gap-1">
              <AlertTriangle size={11} /> {t("capsLockWarning")}
            </p>
          )}
        </div>

        {error && <p className="text-xs text-warn">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full py-3.5 text-sm font-semibold bg-burgundy text-offwhite disabled:opacity-60"
        >
          {loading ? t("pleaseWait") : t("signIn")}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode("forgot");
          setError("");
        }}
        className="w-full text-center text-xs mt-4 text-muted underline"
      >
        {t("forgotPassword")}
      </button>

      <div className="h-px bg-charcoal/[0.08] my-6" />

      <p className="text-center text-sm text-muted">
        {t("newToHeld")}{" "}
        <button
          onClick={() => {
            setMode("signup");
            setError("");
          }}
          className="text-burgundy font-semibold"
        >
          {t("createAccount")}
        </button>
      </p>
      <LangToggle lang={lang} setLang={setLang} />
    </div>
  );
}
