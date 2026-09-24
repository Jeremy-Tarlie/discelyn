import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Aide à rédiger le rapport Diagnostic (49 €) à partir d’observations pré-appel.
 * Usage :
 *   node scripts/diagnostic-collect.mjs --org "Acme Formation" --contact "Sofia" \
 *     --server "Acme Discord" --obs1 "Pas de #règles" --obs2 "Support dans #général" \
 *     --obs3 "Bot MEE6 admin" [--out ./rapport-acme.md]
 */

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage:
  node scripts/diagnostic-collect.mjs \\
    --org "Nom orga" --contact "Prénom — rôle" --server "Nom Discord" \\
    --obs1 "…" --obs2 "…" --obs3 "…" [--date "24 septembre 2026"] [--out ./rapport.md]

Pré-remplit docs/DIAGNOSTIC-RAPPORT-MODELE.md avec les 3 observations pré-appel.
Compléter risques / plan d’action avant envoi client.`);
  process.exit(0);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function arg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function requireArg(name) {
  const v = arg(name);
  if (!v) {
    console.error(`Manquant : --${name} (voir --help)`);
    process.exit(1);
  }
  return v;
}

const org = requireArg("org");
const contact = requireArg("contact");
const server = requireArg("server");
const obs1 = requireArg("obs1");
const obs2 = requireArg("obs2");
const obs3 = requireArg("obs3");
const out = arg("out");
const date =
  arg("date") ??
  new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const templatePath = join(root, "docs", "DIAGNOSTIC-RAPPORT-MODELE.md");
let md = readFileSync(templatePath, "utf8");

const replacements = [
  ["[Nom de l’organisme / marque]", org],
  ["[Prénom Nom — rôle]", contact],
  ["[Nom du serveur]", server],
  ["[JJ mois AAAA]", date],
  [
    "[Ex. : Catégories présentes : Accueil, Cours, Support, Off-topic.]",
    obs1,
  ],
  [
    "[Ex. : Pas de salon #règles épinglé visible depuis le canal d’arrivée.]",
    obs2,
  ],
  [
    "[Ex. : Rôle « Apprenant » attribué manuellement / via réaction / via bot X.]",
    obs3,
  ],
];

for (const [from, to] of replacements) {
  md = md.replace(from, to);
}

md = `<!-- Généré par scripts/diagnostic-collect.mjs — compléter risques / plan d’action avant envoi client -->\n\n${md}`;

if (out) {
  writeFileSync(out, md, "utf8");
  console.log(`Rapport écrit : ${out}`);
} else {
  process.stdout.write(md);
}
