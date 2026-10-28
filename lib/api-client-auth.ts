const MFA_CHALLENGE_PATH = "/login/mfa";

/**
 * Helper client : redirige vers le challenge MFA si l’API renvoie mfa_required.
 * Hors composant React → navigation full page (pas de useRouter) pour resetter l’état client.
 * URL absolue : évite le bypass router signalé par no-location-assign-relative-destination
 * tout en gardant un reload volontaire (flux MFA).
 * @returns true si une redirection a été déclenchée
 */
export function redirectIfMfaRequired(data: {
  code?: string | null;
}): boolean {
  if (typeof window === "undefined") return false;
  if (data.code !== "mfa_required") return false;
  window.location.assign(
    new URL(MFA_CHALLENGE_PATH, window.location.origin).href
  );
  return true;
}
