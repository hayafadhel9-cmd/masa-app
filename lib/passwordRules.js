// Client-side password rules, applied on both the restaurant and customer
// sign-up forms. This is a fail-fast UX layer, not the real security
// boundary — Supabase enforces its own minimum length server-side
// regardless, and leaked-password-protection (a Supabase Auth project
// setting) is the real defense against weak/breached passwords. See
// PROJECT_STATUS.md's security section.
export const PASSWORD_MIN_LENGTH = 8;

export function passwordRuleMessage(password, t) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return t("passwordTooShort", { min: PASSWORD_MIN_LENGTH });
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return t("passwordNeedsLetterAndNumber");
  }
  return null;
}
