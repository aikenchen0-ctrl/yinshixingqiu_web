#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_ENV_FILE="${SCRIPT_DIR}/.env.openwebui-hermes"
EXAMPLE_ENV_FILE="${SCRIPT_DIR}/.env.openwebui-hermes.example"
HERMES_DIR="${HOME}/.hermes"
HERMES_ENV_FILE="${HERMES_DIR}/.env"

DOMAIN="xueyin.net.cn"
WEBUI_URL=""
CORS_ALLOW_ORIGIN=""
ADMIN_NAME="血饮 Boss"
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
WEBUI_SECRET_KEY=""
HERMES_API_KEY=""
HERMES_API_HOST="127.0.0.1"
HERMES_API_PORT="8642"
FORCE="0"

usage() {
  cat <<'EOF'
Usage:
  bash backend/deploy/prepare-openwebui-hermes-env.sh [options]

Options:
  --domain <domain>                 Domain used for /boss (default: xueyin.net.cn)
  --webui-url <url>                 Full WebUI URL (default: https://<domain>/boss)
  --cors-origin <origin>            Allowed browser origin (default: https://<domain>)
  --admin-name <name>               Admin display name (default: 血饮 Boss)
  --admin-email <email>             Admin login email (default: admin@<domain>)
  --admin-password <password>       Admin login password (default: auto-generated)
  --webui-secret <secret>           Open WebUI secret key (default: auto-generated)
  --hermes-key <key>                Hermes API server key (default: auto-generated/reused)
  --hermes-host <host>              Hermes API host (default: 127.0.0.1)
  --hermes-port <port>              Hermes API port (default: 8642)
  --force                           Overwrite backend/deploy/.env.openwebui-hermes
  --help                            Show this help message
EOF
}

require_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "Missing required command: ${cmd}" >&2
    exit 1
  fi
}

generate_secret() {
  openssl rand -hex "$1"
}

read_existing_env_value() {
  local file_path="$1"
  local key="$2"

  if [[ ! -f "${file_path}" ]]; then
    return 0
  fi

  sed -n "s/^${key}=//p" "${file_path}" | tail -n 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)
      DOMAIN="${2:-}"
      shift 2
      ;;
    --webui-url)
      WEBUI_URL="${2:-}"
      shift 2
      ;;
    --cors-origin)
      CORS_ALLOW_ORIGIN="${2:-}"
      shift 2
      ;;
    --admin-name)
      ADMIN_NAME="${2:-}"
      shift 2
      ;;
    --admin-email)
      ADMIN_EMAIL="${2:-}"
      shift 2
      ;;
    --admin-password)
      ADMIN_PASSWORD="${2:-}"
      shift 2
      ;;
    --webui-secret)
      WEBUI_SECRET_KEY="${2:-}"
      shift 2
      ;;
    --hermes-key)
      HERMES_API_KEY="${2:-}"
      shift 2
      ;;
    --hermes-host)
      HERMES_API_HOST="${2:-}"
      shift 2
      ;;
    --hermes-port)
      HERMES_API_PORT="${2:-}"
      shift 2
      ;;
    --force)
      FORCE="1"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

require_cmd openssl
require_cmd install

if [[ ! -f "${EXAMPLE_ENV_FILE}" ]]; then
  echo "Missing example env file: ${EXAMPLE_ENV_FILE}" >&2
  exit 1
fi

if [[ -z "${WEBUI_URL}" ]]; then
  WEBUI_URL="https://${DOMAIN}/boss"
fi

if [[ -z "${CORS_ALLOW_ORIGIN}" ]]; then
  CORS_ALLOW_ORIGIN="https://${DOMAIN}"
fi

if [[ -z "${ADMIN_EMAIL}" ]]; then
  ADMIN_EMAIL="admin@${DOMAIN}"
fi

if [[ -z "${HERMES_API_KEY}" ]]; then
  HERMES_API_KEY="$(read_existing_env_value "${HERMES_ENV_FILE}" "API_SERVER_KEY")"
fi

if [[ -z "${HERMES_API_KEY}" ]]; then
  HERMES_API_KEY="$(generate_secret 24)"
fi

if [[ -z "${ADMIN_PASSWORD}" ]]; then
  ADMIN_PASSWORD="$(generate_secret 12)"
fi

if [[ -z "${WEBUI_SECRET_KEY}" ]]; then
  WEBUI_SECRET_KEY="$(read_existing_env_value "${DEPLOY_ENV_FILE}" "WEBUI_SECRET_KEY")"
fi

if [[ -z "${WEBUI_SECRET_KEY}" ]]; then
  WEBUI_SECRET_KEY="$(generate_secret 32)"
fi

if [[ -f "${DEPLOY_ENV_FILE}" && "${FORCE}" != "1" ]]; then
  echo "Refusing to overwrite existing file: ${DEPLOY_ENV_FILE}" >&2
  echo "Re-run with --force if you really want to regenerate it." >&2
  exit 1
fi

install -d -m 700 "${HERMES_DIR}"

umask 077

cat > "${HERMES_ENV_FILE}" <<EOF
API_SERVER_ENABLED=true
API_SERVER_KEY=${HERMES_API_KEY}
API_SERVER_HOST=${HERMES_API_HOST}
API_SERVER_PORT=${HERMES_API_PORT}
EOF

cat > "${DEPLOY_ENV_FILE}" <<EOF
WEBUI_URL=${WEBUI_URL}
CORS_ALLOW_ORIGIN=${CORS_ALLOW_ORIGIN}
WEBUI_SESSION_COOKIE_SECURE=true
WEBUI_AUTH_COOKIE_SECURE=true
WEBUI_SESSION_COOKIE_SAME_SITE=lax
WEBUI_AUTH_COOKIE_SAME_SITE=lax
ENABLE_SIGNUP=false
ENABLE_LOGIN_FORM=true
WEBUI_ADMIN_NAME=${ADMIN_NAME}
WEBUI_ADMIN_EMAIL=${ADMIN_EMAIL}
WEBUI_ADMIN_PASSWORD=${ADMIN_PASSWORD}
WEBUI_SECRET_KEY=${WEBUI_SECRET_KEY}
OPENAI_API_BASE_URL=http://host.docker.internal:${HERMES_API_PORT}/v1
OPENAI_API_KEY=${HERMES_API_KEY}
GLOBAL_LOG_LEVEL=INFO
EOF

echo "Prepared:"
echo "  - ${HERMES_ENV_FILE}"
echo "  - ${DEPLOY_ENV_FILE}"
echo
echo "Next:"
echo "  1. Start Hermes: hermes gateway"
echo "  2. Start WebUI: docker compose -f ${SCRIPT_DIR}/docker-compose.openwebui-hermes.yml up -d"
echo "  3. Check runtime: bash ${SCRIPT_DIR}/check-openwebui-hermes.sh"
