/**
 * Helpers purs pour le runner de tests (importables depuis run-tests.mjs + vitest).
 */

/**
 * Réécrit l’hôte DB pour un conteneur Docker Desktop / Linux avec host-gateway.
 */
export function rewriteDatabaseUrlForDocker(url) {
  return url
    .replace(/@127\.0\.0\.1(?=[:/])/g, "@host.docker.internal")
    .replace(/@localhost(?=[:/])/g, "@host.docker.internal")
    .replace(/@\[::1\](?=[:/])/g, "@host.docker.internal");
}

/**
 * Sur Windows host, Vitest/Rollup exige un binaire natif optionnel — on évite
 * en lançant Vitest dans un conteneur Linux. CI / Linux restent en local.
 */
export function shouldRunVitestInDocker(input) {
  if (input.forceHost) return false;
  if (input.forceDocker) return true;
  if (input.ci) return false;
  return input.platform === "win32";
}
