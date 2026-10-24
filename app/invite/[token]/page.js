"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";
import { Check } from "lucide-react";
import { useLanguage } from "../../../lib/LanguageContext";
import { passwordRuleMessage } from "../../../lib/passwordRules";
import { authErrorMessage } from "../../../lib/authErrorMessage";
import CustomerAuthForm from "../../components/CustomerAuthForm";

// Opened from a "Share invite link" link (app/components/AddGuestsSheet.js).
// get_invite_preview()/claim_invite() are both SECURITY DEFINER Postgres
// functions (schema.sql) — booking_guests itself has no public SELECT
// policy, so this page can't just query the table directly the way the
// public booking/[id] share page queries `bookings`.
export default function InvitePage() {
  const { t } = useLanguage();
  const { token } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [user, setUser] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [claimError, setClaimError] = useState("");

  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authFullName, setAuthFullName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authConfirmationPending, setAuthConfirmationPending] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.rpc("get_invite_preview", { p_token: token });
      setPreview(data?.[0] || null);
      setLoading(false);
    }
    load();
  }, [token]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function claim() {
    setClaiming(true);
    setClaimError("");
    const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || t("guest");
    const { error } = await supabase.rpc("claim_invite", { p_token: token, p_guest_name: name });
    setClaiming(false);
    if (error) {
      setClaimError(t("inviteClaimFailed"));
      return;
    }
    setClaimed(true);
  }

  useEffect(() => {
    if (user && preview?.valid && !claimed && !claiming) claim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, preview?.valid]);

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthError("");

    if (authMode === "signup") {
      const passwordIssue = passwordRuleMessage(authPassword, t);
      if (passwordIssue) {
        setAuthError(passwordIssue);
        return;
      }
      setAuthLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: { data: { full_name: authFullName, phone: authPhone } },
      });
      setAuthLoading(false);
      if (error) {
        setAuthError(authErrorMessage(error, t));
        return;
      }
      if (!data.session) {
        setAuthConfirmationPending(true);
        return;
      }
      return;
    }

    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    setAuthLoading(false);
    if (error) {
      setAuthError(authErrorMessage(error, t));
      return;
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-cream flex items-center justify-center text-sm text-taupe">{t("loading")}</div>;
  }

  if (!preview || !preview.valid) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-cream px-6 pt-20 text-center">
        <p className="text-sm text-muted">{t("inviteExpired")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-cream px-6 pt-16 pb-10">
      {claimed ? (
        <div className="text-center pt-16">
          <div className="w-14 h-14 rounded-full bg-burgundy text-offwhite flex items-center justify-center mx-auto mb-4">
            <Check size={24} />
          </div>
          <h1 className="font-serif text-2xl text-charcoal mb-2">{t("inviteJoined")}</h1>
          <p className="text-sm text-muted mb-6">{t("inviteJoinedBody", { restaurant: preview.restaurant_name })}</p>
          <button
            onClick={() => router.push("/")}
            className="rounded-full px-6 py-3 text-sm font-semibold bg-burgundy text-offwhite"
          >
            {t("goToMyBookings")}
          </button>
        </div>
      ) : (
        <>
          <h1 className="font-serif text-2xl text-charcoal mb-1">{t("inviteTitle")}</h1>
          <p className="text-sm text-muted mb-7">
            {t("inviteBody", { restaurant: preview.restaurant_name, date: preview.booking_date })}
          </p>

          {claiming ? (
            <p className="text-sm text-taupe text-center">{t("pleaseWait")}</p>
          ) : user ? (
            claimError && <p className="text-sm text-warn text-center">{claimError}</p>
          ) : (
            <CustomerAuthForm
              mode={authMode}
              setMode={setAuthMode}
              email={authEmail}
              setEmail={setAuthEmail}
              password={authPassword}
              setPassword={setAuthPassword}
              fullName={authFullName}
              setFullName={setAuthFullName}
              phone={authPhone}
              setPhone={setAuthPhone}
              error={authError}
              loading={authLoading}
              confirmationPending={authConfirmationPending}
              onSubmit={handleAuthSubmit}
              t={t}
            />
          )}
        </>
      )}
    </div>
  );
}
