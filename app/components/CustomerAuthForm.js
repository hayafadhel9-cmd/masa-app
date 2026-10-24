"use client";

import { useState } from "react";
import { Eye, EyeOff, AlertTriangle, MailCheck } from "lucide-react";
import { PASSWORD_MIN_LENGTH } from "../../lib/passwordRules";
import { useCapsLockWarning } from "../../lib/useCapsLockWarning";

// Shared customer sign-in/sign-up form — used on the diner app's own auth
// gate (app/page.js, several places) and on the guest-invite accept page
// (app/invite/[token]/page.js), which needs the exact same login-or-signup
// UX before it can add someone to a booking. Fully controlled by the
// caller, which owns all the field state and the submit handler.
export default function CustomerAuthForm({
  mode,
  setMode,
  email,
  setEmail,
  password,
  setPassword,
  fullName,
  setFullName,
  phone,
  setPhone,
  error,
  loading,
  confirmationPending,
  onSubmit,
  t,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const { capsLockOn, checkCapsLock } = useCapsLockWarning();

  if (confirmationPending) {
    return (
      <div className="rounded-2xl p-5 bg-card text-center">
        <MailCheck size={28} className="text-burgundy mx-auto mb-3" />
        <div className="font-serif text-lg text-charcoal mb-1">{t("confirmEmailTitle")}</div>
        <p className="text-sm text-muted">{t("confirmEmailBody", { email })}</p>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {mode === "signup" && (
        <>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-taupe">{t("fullName")}</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full rounded-full px-4 py-3 text-sm mt-2 outline-none bg-tan text-charcoal"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-taupe">{t("mobileNumber")}</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full rounded-full px-4 py-3 text-sm mt-2 outline-none bg-tan text-charcoal"
            />
          </div>
        </>
      )}
      <div>
        <label className="text-[11px] font-bold uppercase tracking-widest text-taupe">{t("email")}</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-full px-4 py-3 text-sm mt-2 outline-none bg-tan text-charcoal"
        />
      </div>
      <div>
        <label className="text-[11px] font-bold uppercase tracking-widest text-taupe">{t("password")}</label>
        <div className="relative mt-2">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={checkCapsLock}
            onKeyUp={checkCapsLock}
            required
            minLength={PASSWORD_MIN_LENGTH}
            className="w-full rounded-full px-4 py-3 pe-11 text-sm outline-none bg-tan text-charcoal"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            className="absolute inset-y-0 end-1 flex items-center px-3 text-taupe"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {capsLockOn && (
          <p className="text-[11px] text-warn mt-1.5 flex items-center gap-1">
            <AlertTriangle size={11} /> {t("capsLockWarning")}
          </p>
        )}
        {mode === "signup" && (
          <p className="text-[11px] text-taupe mt-1.5">{t("passwordRuleHint", { min: PASSWORD_MIN_LENGTH })}</p>
        )}
      </div>
      {error && <p className="text-xs text-warn">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full py-3.5 text-sm font-semibold bg-burgundy text-offwhite disabled:opacity-60"
      >
        {loading ? t("pleaseWait") : mode === "login" ? t("signIn") : t("createAccount")}
      </button>
      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="text-center text-xs text-muted underline"
      >
        {mode === "login" ? t("newCustomerSignUp") : t("haveAccountSignIn")}
      </button>
    </form>
  );
}
