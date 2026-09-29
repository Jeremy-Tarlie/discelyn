#!/usr/bin/env node
/**
 * Provisionne un VPS distant (Ubuntu/Debian) via SSH :
 * nginx + certbot + fail2ban + UFW + durcissement SSH (+ Docker).
 *
 * Prérequis locaux : `ssh` et `scp` dans le PATH (OpenSSH Windows OK).
 * Pour --deploy / --sync-all : `tar` aussi (tar.exe Windows 10+).
 *
 * Usage :
 *   node --env-file=.env scripts/provision-remote.mjs
 *   node --env-file=.env scripts/provision-remote.mjs --deploy
 *
 * Variables (.env ou shell) :
 *   SSH_HOST=203.0.113.10
 *   SSH_USER=root                  (1er bootstrap uniquement ; ensuite discelyn)
 *   DEPLOY_USER=discelyn           (user SSH clé-only après durcissement)
 *   SSH_KEY=%USERPROFILE%\.ssh\id_ed25519
 *   DOMAIN=discelyn.example.com
 *   EMAIL=admin@example.com
 *   SSH_PUBKEY=ssh-ed25519 AAAA…   (sinon lit SSH_KEY.pub)
 *   REMOTE_DIR=/opt/discelyn
 *   PROVISION_DEPLOY=1
 *
 * Flags : --deploy --sync-all --skip-docker --skip-ssh-harden --skip-certbot --help
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function fail(msg) {
  console.error(`[provision:remote] ${msg}`);
  process.exit(1);
}

/** @param {string} s */
function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

/** @param {string} p */
function expandHome(p) {
  if (!p) return p;
  if (p.startsWith("~/") || p === "~") {
    return join(homedir(), p.slice(2));
  }
  return p.replace(/%USERPROFILE%/gi, homedir());
}

const argvFlags = new Set(process.argv.slice(2));
if (argvFlags.has("-h") || argvFlags.has("--help")) {
  console.log(`Usage: npm run provision:remote [-- --deploy]

Variables: SSH_HOST, DOMAIN, EMAIL, SSH_USER, SSH_KEY, SSH_PUBKEY, REMOTE_DIR
Flags: --deploy --sync-all --skip-docker --skip-ssh-harden --skip-certbot`);
  process.exit(0);
}

const sshHost = (process.env.SSH_HOST || "").trim();
const sshUser = (process.env.SSH_USER || "root").trim();
const sshKey = expandHome(
  (process.env.SSH_KEY || join(homedir(), ".ssh", "id_ed25519")).trim()
);
const domain = (process.env.DOMAIN || "").trim();
const email = (process.env.EMAIL || "").trim();
const remoteDir = (process.env.REMOTE_DIR || "/opt/discelyn").trim();
const deployUser = (process.env.DEPLOY_USER || process.env.SSH_DEPLOY_USER || "discelyn").trim();
const wantDeploy =
  argvFlags.has("--deploy") ||
  process.env.PROVISION_DEPLOY === "1" ||
  process.env.PROVISION_DEPLOY === "true";
const syncAll =
  wantDeploy ||
  argvFlags.has("--sync-all") ||
  process.env.PROVISION_SYNC_ALL === "1" ||
  process.env.PROVISION_SYNC_ALL === "true";

let sshPubKey = (process.env.SSH_PUBKEY || "").trim();
if (!sshPubKey) {
  const pubPath = `${sshKey}.pub`;
  if (existsSync(pubPath)) {
    sshPubKey = readFileSync(pubPath, "utf8").trim();
  }
}

if (!sshHost) fail("SSH_HOST manquant");
if (!domain) fail("DOMAIN manquant");
if (!email) fail("EMAIL manquant");
if (!existsSync(sshKey)) fail(`clé privée introuvable: ${sshKey}`);

const repoRoot = process.cwd();
if (!existsSync(join(repoRoot, "deploy", "bootstrap-host.sh"))) {
  fail("deploy/bootstrap-host.sh manquant — lancer depuis la racine du repo");
}

const sshBase = [
  "-i",
  sshKey,
  "-o",
  "StrictHostKeyChecking=accept-new",
  "-o",
  "BatchMode=yes",
];

/**
 * @param {string} cmd
 * @param {string[]} cmdArgs
 * @param {import("node:child_process").SpawnSyncOptions} [opts]
 */
function run(cmd, cmdArgs, opts = {}) {
  console.log(`[provision:remote] $ ${cmd} ${cmdArgs.join(" ")}`);
  const r = spawnSync(cmd, cmdArgs, {
    encoding: "utf8",
    stdio: "inherit",
    shell: false,
    ...opts,
  });
  if (r.status !== 0) {
    fail(`échec: ${cmd} (exit ${r.status ?? "?"})`);
  }
}

const remote = `${sshUser}@${sshHost}`;

console.log(`[provision:remote] cible ${remote}:${remoteDir}`);
console.log(`[provision:remote] DOMAIN=${domain} EMAIL=${email}`);

run("ssh", [...sshBase, remote, `mkdir -p ${shellQuote(remoteDir)}`]);

if (syncAll) {
  console.log(
    "[provision:remote] sync repo (sans node_modules / .next / .git) via tar|ssh"
  );
  const excludes =
    "--exclude=node_modules --exclude=bot-runtime/node_modules --exclude=.next --exclude=bot-runtime/dist --exclude=backups --exclude=.git";
  const sshArgs = sshBase.map(shellQuote).join(" ");
  // Pipeline shell : portable Win (cmd) + Unix
  const pipeline = `tar -cf - ${excludes} -C ${shellQuote(repoRoot)} . | ssh ${sshArgs} ${shellQuote(remote)} tar -xf - -C ${shellQuote(remoteDir)}`;
  const isWin = process.platform === "win32";
  const r = spawnSync(isWin ? "cmd.exe" : "sh", isWin ? ["/c", pipeline] : ["-c", pipeline], {
    stdio: "inherit",
    shell: false,
  });
  if (r.status !== 0) {
    fail(
      "sync tar|ssh a échoué — copie le repo sur le VPS à la main (REMOTE_DIR), puis relance sans --deploy"
    );
  }
} else {
  const pathsToSync = [
    "deploy",
    "docker-compose.yml",
    "docker-compose.host-nginx.yml",
    "docker-compose.tls.yml",
    "package.json",
    "scripts/deploy-prod.mjs",
    ".env.example",
  ];
  for (const rel of pathsToSync) {
    const local = join(repoRoot, rel);
    if (!existsSync(local)) {
      console.warn(`[provision:remote] skip (absent): ${rel}`);
      continue;
    }
    run("scp", [
      ...sshBase,
      "-r",
      local,
      `${remote}:${remoteDir}/${rel.replace(/\\/g, "/")}`,
    ]);
  }
}

if (existsSync(join(repoRoot, ".env"))) {
  console.log("[provision:remote] copie .env → distant");
  run("scp", [...sshBase, join(repoRoot, ".env"), `${remote}:${remoteDir}/.env`]);
} else {
  console.warn("[provision:remote] pas de .env local — à créer sur le serveur");
}

const bootstrapFlags = [];
if (argvFlags.has("--skip-docker")) bootstrapFlags.push("--skip-docker");
if (argvFlags.has("--skip-ssh-harden")) bootstrapFlags.push("--skip-ssh-harden");
if (argvFlags.has("--skip-certbot")) bootstrapFlags.push("--skip-certbot");

const remoteCmd = [
  `cd ${shellQuote(remoteDir)}`,
  `sed -i 's/\\r$//' deploy/bootstrap-host.sh deploy/nginx/*.template deploy/fail2ban/jail.local deploy/sshd/*.conf 2>/dev/null || true`,
  `chmod +x deploy/bootstrap-host.sh`,
  `export DOMAIN=${shellQuote(domain)}`,
  `export EMAIL=${shellQuote(email)}`,
  `export DEPLOY_USER=${shellQuote(deployUser)}`,
  sshPubKey ? `export SSH_PUBKEY=${shellQuote(sshPubKey)}` : "true",
  `bash deploy/bootstrap-host.sh ${bootstrapFlags.join(" ")}`.trim(),
].join(" && ");

run("ssh", [...sshBase, remote, remoteCmd]);

if (wantDeploy) {
  console.log("[provision:remote] docker compose (TLS_MODE=nginx)…");
  // Après harden, root SSH est coupé → deploy via user clé + sudo
  const deployRemote = `${deployUser}@${sshHost}`;
  const deployCmd = [
    `cd ${shellQuote(remoteDir)}`,
    `sudo env TLS_MODE=nginx DOMAIN=${shellQuote(domain)} EMAIL=${shellQuote(email)} docker compose -f docker-compose.yml -f docker-compose.host-nginx.yml up -d --build`,
  ].join(" && ");
  console.log(
    `[provision:remote] SSH post-harden en ${deployUser} (root coupé, clé only)`
  );
  run("ssh", [...sshBase, deployRemote, deployCmd]);
  console.log(`[provision:remote] vérifie: curl -fsS https://${domain}/api/health`);
}

console.log("[provision:remote] terminé.");
console.log(
  `[provision:remote] Prochaines connexions : ssh -i … ${deployUser}@${sshHost}`
);
console.log(
  "[provision:remote] Mets SSH_USER=discelyn dans .env (plus root)."
);
process.exit(0);
