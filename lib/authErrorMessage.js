// Supabase's auth-js client discards the response body for any 5xx status
// (treating it as a generic "retryable" infrastructure failure) and falls
// back to `JSON.stringify(rawResponse)` for the error message — which is
// always the literal string "{}" because Response objects don't have their
// own enumerable properties. That means a real server-side error (e.g. the
// confirmation email failing to send) surfaces to the UI as an empty-looking
// "{}" instead of anything useful. Detect that case and show a friendly
// fallback instead; every other status code carries a real, specific message
// from Supabase and is passed through unchanged.
export function authErrorMessage(error, t) {
  if (!error) return "";
  if (error.status >= 500 || error.message === "{}") {
    console.error("Auth request failed with a server error:", error);
    return t("authServerError");
  }
  return error.message;
}
