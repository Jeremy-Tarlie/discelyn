#!/usr/bin/env bash
# Discelyn — bootstrap hôte Ubuntu/Debian
# nginx (TLS Let's Encrypt) + fail2ban + UFW + durcissement SSH + Docker (optionnel)
#
# Usage (sur le VPS, en root — 1ère fois seulement) :
#   export DOMAIN=discelyn.example.com EMAIL=admin@example.com
#   export SSH_PUBKEY='ssh-ed25519 AAAA… comment'   # obligatoire pour durcir SSH
#   export DEPLOY_USER=discelyn                     # défaut
#   bash deploy/bootstrap-host.sh
# Ensuite : ssh discelyn@IP — root SSH + mots de passe coupés.
#
# Flags :
#   --skip-docker     ne pas installer Docker
#   --skip-ssh-harden ne pas appliquer le drop-in sshd (clés déjà gérées)
#   --skip-certbot    nginx HTTP only (certs déjà en place ailleurs)
#
# Idempotent : rejouable sans casser une install existante.
set -euo pipefail

SKIP_DOCKER=0
SKIP_SSH_HARDEN=0
SKIP_CERTBOT=0

for arg in "$@"; do
  case "$arg" in
    --skip-docker) SKIP_DOCKER=1 ;;
    --skip-ssh-harden) SKIP_SSH_HARDEN=1 ;;
    --skip-certbot) SKIP_CERTBOT=1 ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "[bootstrap] flag inconnu: $arg" >&2
      exit 1
      ;;
  esac
done

log() { echo "[bootstrap] $*"; }
fail() { echo "[bootstrap] ERREUR: $*" >&2; exit 1; }

[[ "$(id -u)" -eq 0 ]] || fail "lancer en root (sudo bash deploy/bootstrap-host.sh)"

DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
SSH_PUBKEY="${SSH_PUBKEY:-}"
# User sudo pour SSH (root coupé après bootstrap). Défaut: discelyn
DEPLOY_USER="${DEPLOY_USER:-${SSH_DEPLOY_USER:-discelyn}}"

[[ -n "$DOMAIN" ]] || fail "DOMAIN manquant (ex. export DOMAIN=discelyn.example.com)"
[[ -n "$EMAIL" ]] || fail "EMAIL manquant (Let's Encrypt + alertes)"
[[ "$DEPLOY_USER" != "root" ]] || fail "DEPLOY_USER ne peut pas être root (root SSH sera coupé)"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NGINX_TEMPLATE="$SCRIPT_DIR/nginx/discelyn.conf.template"
FAIL2BAN_JAIL="$SCRIPT_DIR/fail2ban/jail.local"
SSHD_DROPIN_SRC="$SCRIPT_DIR/sshd/99-discelyn-hardening.conf"

[[ -f "$NGINX_TEMPLATE" ]] || fail "template manquant: $NGINX_TEMPLATE"
[[ -f "$FAIL2BAN_JAIL" ]] || fail "jail manquant: $FAIL2BAN_JAIL"
[[ -f "$SSHD_DROPIN_SRC" ]] || fail "sshd drop-in manquant: $SSHD_DROPIN_SRC"

if [[ ! -f /etc/os-release ]]; then
  fail "OS non supporté (pas de /etc/os-release)"
fi
# shellcheck source=/dev/null
. /etc/os-release
case "${ID:-}" in
  ubuntu|debian) ;;
  *) fail "OS non supporté: ${ID:-unknown} (Ubuntu/Debian uniquement)" ;;
esac

export DEBIAN_FRONTEND=noninteractive

log "apt update + paquets (nginx, certbot, fail2ban, ufw, sudo)"
apt-get update -y
apt-get install -y \
  nginx \
  certbot \
  python3-certbot-nginx \
  fail2ban \
  ufw \
  sudo \
  curl \
  ca-certificates \
  gnupg \
  openssl

# --- User deploy (SSH clé only ; root coupé ensuite) ---
ensure_deploy_user() {
  if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
    log "création user ${DEPLOY_USER} (sudo, sans mot de passe login)"
    adduser --disabled-password --gecos "Discelyn deploy" "$DEPLOY_USER"
  else
    log "user ${DEPLOY_USER} déjà présent"
  fi
  usermod -aG sudo "$DEPLOY_USER"
  # sudo sans mot de passe (auth déjà faite par clé SSH)
  echo "${DEPLOY_USER} ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-${DEPLOY_USER}"
  chmod 440 "/etc/sudoers.d/90-${DEPLOY_USER}"
  visudo -cf "/etc/sudoers.d/90-${DEPLOY_USER}" >/dev/null
}

install_ssh_key() {
  local target_user="$1"
  local home_dir
  home_dir="$(getent passwd "$target_user" | cut -d: -f6)"
  [[ -n "$home_dir" && -d "$home_dir" ]] || fail "utilisateur SSH inconnu: $target_user"

  local ssh_dir="$home_dir/.ssh"
  local auth_keys="$ssh_dir/authorized_keys"
  mkdir -p "$ssh_dir"
  chmod 700 "$ssh_dir"
  touch "$auth_keys"
  chmod 600 "$auth_keys"
  chown -R "$target_user:$target_user" "$ssh_dir"

  if [[ -n "$SSH_PUBKEY" ]]; then
    if grep -Fqx "$SSH_PUBKEY" "$auth_keys" 2>/dev/null; then
      log "clé SSH déjà présente pour $target_user"
    else
      echo "$SSH_PUBKEY" >> "$auth_keys"
      log "clé SSH ajoutée pour $target_user"
    fi
  fi

  if [[ ! -s "$auth_keys" ]]; then
    return 1
  fi
  return 0
}

ensure_deploy_user

has_ssh_keys=0
if install_ssh_key "$DEPLOY_USER"; then
  has_ssh_keys=1
fi

if [[ "$SKIP_SSH_HARDEN" -eq 0 ]]; then
  if [[ "$has_ssh_keys" -eq 1 ]]; then
    log "durcissement SSH : root COUPÉ, PasswordAuthentication=no, AllowUsers=${DEPLOY_USER}"
    mkdir -p /etc/ssh/sshd_config.d
    sed "s/__DEPLOY_USER__/${DEPLOY_USER}/g" "$SSHD_DROPIN_SRC" \
      > /etc/ssh/sshd_config.d/99-discelyn-hardening.conf
    if sshd -t; then
      systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true
      log "sshd rechargé — connecte-toi désormais : ssh ${DEPLOY_USER}@<host>"
      log "root SSH et auth par mot de passe sont désactivés"
    else
      rm -f /etc/ssh/sshd_config.d/99-discelyn-hardening.conf
      fail "sshd -t a échoué — drop-in retiré, config SSH inchangée"
    fi
  else
    log "ATTENTION: aucune clé pour ${DEPLOY_USER} — durcissement SSH IGNORÉ (évite lockout)"
    log "  Relance avec: SSH_PUBKEY='ssh-ed25519 AAAA…' bash deploy/bootstrap-host.sh"
  fi
else
  log "durcissement SSH ignoré (--skip-ssh-harden)"
fi

# --- UFW ---
log "UFW : deny incoming, allow 22/80/443"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose || true

# --- nginx webroot ACME ---
mkdir -p /var/www/certbot
chown www-data:www-data /var/www/certbot

write_nginx_http_only() {
  cat > /etc/nginx/sites-available/discelyn <<EOF
# Discelyn — phase ACME (HTTP only)
limit_req_zone \$binary_remote_addr zone=discelyn_req:10m rate=10r/s;

upstream discelyn_web {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        limit_req zone=discelyn_req burst=30 nodelay;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_pass http://discelyn_web;
    }
}
EOF
}

write_nginx_https() {
  sed "s/__DOMAIN__/${DOMAIN}/g" "$NGINX_TEMPLATE" > /etc/nginx/sites-available/discelyn
}

ensure_certbot_ssl_snippets() {
  mkdir -p /etc/letsencrypt
  if [[ ! -f /etc/letsencrypt/options-ssl-nginx.conf ]]; then
    # Copie depuis le paquet certbot-nginx si dispo, sinon fichier minimal sûr
    local candidate
    candidate="$(find /usr -path '*certbot_nginx*' -name 'options-ssl-nginx.conf' 2>/dev/null | head -n1 || true)"
    if [[ -n "$candidate" ]]; then
      cp "$candidate" /etc/letsencrypt/options-ssl-nginx.conf
    else
      cat > /etc/letsencrypt/options-ssl-nginx.conf <<'SSL'
ssl_session_cache shared:le_nginx_SSL:10m;
ssl_session_timeout 1440m;
ssl_session_tickets off;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;
SSL
    fi
  fi
  if [[ ! -f /etc/letsencrypt/ssl-dhparams.pem ]]; then
    log "génération ssl-dhparams.pem (peut prendre 1–2 min)…"
    openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048
  fi
}

rm -f /etc/nginx/sites-enabled/default
ln -sfn /etc/nginx/sites-available/discelyn /etc/nginx/sites-enabled/discelyn

if [[ "$SKIP_CERTBOT" -eq 1 ]]; then
  if [[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
    ensure_certbot_ssl_snippets
    write_nginx_https
  else
    write_nginx_http_only
    log "certbot ignoré — nginx en HTTP only"
  fi
else
  write_nginx_http_only
  nginx -t
  systemctl enable --now nginx
  systemctl reload nginx

  log "certbot Let's Encrypt pour ${DOMAIN}"
  certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive \
    --keep-until-expiring \
    --preferred-challenges http

  ensure_certbot_ssl_snippets
  write_nginx_https
fi

nginx -t
systemctl enable --now nginx
systemctl reload nginx

# Renouvellement : hook reload nginx
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'HOOK'
#!/bin/sh
systemctl reload nginx
HOOK
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

# --- fail2ban ---
log "fail2ban jail Discelyn"
cp "$FAIL2BAN_JAIL" /etc/fail2ban/jail.local
systemctl enable --now fail2ban
systemctl restart fail2ban
fail2ban-client status || true

# --- Docker ---
if [[ "$SKIP_DOCKER" -eq 0 ]]; then
  if command -v docker >/dev/null 2>&1; then
    log "Docker déjà installé: $(docker --version)"
  else
    log "installation Docker (repo officiel)"
    install -m 0755 -d /etc/apt/keyrings
    if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
      curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
      chmod a+r /etc/apt/keyrings/docker.asc
    fi
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
  fi
  if getent group docker >/dev/null 2>&1; then
    usermod -aG docker "$DEPLOY_USER"
    log "${DEPLOY_USER} ajouté au groupe docker"
  fi
else
  log "Docker ignoré (--skip-docker)"
fi

# Droits repo pour le user deploy
if [[ -d "$REPO_ROOT" ]]; then
  chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "$REPO_ROOT" || true
fi

MARKER=/etc/discelyn-host-bootstrap
cat > "$MARKER" <<EOF
DOMAIN=${DOMAIN}
EMAIL=${EMAIL}
TLS_MODE=nginx
DEPLOY_USER=${DEPLOY_USER}
SSH_ROOT=disabled
SSH_PASSWORD=disabled
BOOTSTRAPPED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
REPO_ROOT=${REPO_ROOT}
EOF
chmod 644 "$MARKER"

log "OK — hôte prêt (nginx + fail2ban + UFW + SSH clé-only)"
log "SSH : root COUPÉ · mots de passe COUPÉS · user=${DEPLOY_USER}"
log "Suite :"
log "  1. DNS A ${DOMAIN} → IP de ce VPS"
log "  2. Reconnecte en: ssh ${DEPLOY_USER}@<ip>  (plus en root)"
log "  3. .env : APP_ENV=production TRUST_PROXY=1 DOMAIN=${DOMAIN} EMAIL=${EMAIL} TLS_MODE=nginx"
log "  4. cd ${REPO_ROOT} && sudo TLS_MODE=nginx docker compose -f docker-compose.yml -f docker-compose.host-nginx.yml up -d --build"
log "     (ou npm run deploy:prod si Node est installé)"
log "  5. curl -fsS https://${DOMAIN}/api/health"
