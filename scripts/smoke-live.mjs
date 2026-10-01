/**
 * Smoke post-deploy — vérifie /api/health puis imprime la checklist live.
 *
 * Usage :
 *   npm run smoke:live
 *   SMOKE_BASE_URL=https://app.example.com npm run smoke:live
 *
 * Exit 1 si health ≠ 200 / status ≠ ok.
 */

const base =
  (process.env.SMOKE_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "")
    .trim()
    .replace(/\/$/, "") || "http://localhost:3000";

const healthUrl = `${base}/api/health`;

console.log(`[smoke] GET ${healthUrl}`);

let res;
try {
  res = await fetch(healthUrl, { redirect: "manual" });
} catch (err) {
  console.error(`[smoke] réseau: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}

const text = await res.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  console.error(`[smoke] body non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
  process.exit(1);
}

console.log(`[smoke] HTTP ${res.status}`, body);

if (res.status !== 200 || body.status !== "ok") {
  console.error("[smoke] ÉCHEC health — corriger avant money-path live");
  process.exit(1);
}

console.log(`
[smoke] Health OK.

Checklist manuelle (docs/SMOKE-LIVE.md) :
  1. OWNER + 2FA
  2. Produit price → rôle
  3. Payment Link (carte test) → claim → join → rôle
  4. Refund / cancel → revoke
  5. (abo) past_due → badge Apprenants sans revoke immédiat
  6. POST /api/cron/access Bearer CRON_SECRET → 200

Voir aussi docs/GO-LIVE.md et docs/RELEASE.md §5.
`);

process.exit(0);
