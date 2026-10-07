/**
 * Helper client : redirige vers le challenge MFA si l’API renvoie mfa_required.
 * @returns true si une redirection a été déclenchée
 */
export function redirectIfMfaRequired(data: {
  code?: string | null;
}): boolean {
  if (typeof window === "undefined") return false;
  if (data.code !== "mfa_required") return false;
  window.location.assign("/login/mfa");
  return true;
}
