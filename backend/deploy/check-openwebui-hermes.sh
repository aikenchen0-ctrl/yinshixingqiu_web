#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_ENV_FILE="${SCRIPT_DIR}/.env.openwebui-hermes"
HERMES_ENV_FILE="${HOME}/.hermes/.env"

BOSS_URL="https://xueyin.net.cn/boss/"
BACKEND_URL="http://127.0.0.1:3000/health"
HERMES_HEALTH_URL="http://127.0.0.1:8642/health"
HERMES_MODELS_URL="http://127.0.0.1:8642/v1/models"
TIMEOUT_SECONDS="8"
SKIP_BOSS="0"

usage() {
  cat <<'EOF'
Usage:
  bash backend/deploy/check-openwebui-hermes.sh [options]

Options:
  --boss-url <url>            Full public /boss URL to check
  --backend-url <url>         Backend health endpoint
  --hermes-health <url>       Hermes health endpoint
  --hermes-models <url>       Hermes models endpoint
  --timeout <seconds>         curl timeout in seconds (default: 8)
  --skip-boss                 Skip public /boss check
  --help                      Show this help message
EOF
}

read_env_value() {
  local file_path="$1"
  local key="$2"

  if [[ ! -f "${file_path}" ]]; then
    return 0
  fi

  sed -n "s/^${key}=//p" "${file_path}" | tail -n 1
}

pass() {
  echo "[PASS] $1"
}

warn() {
  echo "[WARN] $1"
}

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

check_http_contains() {
  local name="$1"
  local url="$2"
  local expected="$3"
  local body

  body="$(curl --silent --show-error --fail --location --max-time "${TIMEOUT_SECONDS}" "${url}")" || fail "${name} unreachable: ${url}"
  if [[ "${body}" != *"${expected}"* ]]; then
    fail "${name} response missing expected content: ${expected}"
  fi

  pass "${name}: ${url}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --boss-url)
      BOSS_URL="${2:-}"
      shift 2
      ;;
    --backend-url)
      BACKEND_URL="${2:-}"
      shift 2
      ;;
    --hermes-health)
      HERMES_HEALTH_URL="${2:-}"
      shift 2
      ;;
    --hermes-models)
      HERMES_MODELS_URL="${2:-}"
      shift 2
      ;;
    --timeout)
      TIMEOUT_SECONDS="${2:-}"
      shift 2
      ;;
    --skip-boss)
      SKIP_BOSS="1"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      fail "Unknown option: $1"
      ;;
  esac
done

command -v curl >/dev/null 2>&1 || fail "Missing required command: curl"

if [[ -f "${DEPLOY_ENV_FILE}" ]]; then
  current_webui_url="$(read_env_value "${DEPLOY_ENV_FILE}" "WEBUI_URL")"
  current_openai_api_key="$(read_env_value "${DEPLOY_ENV_FILE}" "OPENAI_API_KEY")"
  current_api_base_url="$(read_env_value "${DEPLOY_ENV_FILE}" "OPENAI_API_BASE_URL")"

  [[ -n "${current_webui_url}" ]] || fail "WEBUI_URL missing in ${DEPLOY_ENV_FILE}"
  [[ "${current_webui_url}" == *"/boss" ]] || fail "WEBUI_URL must end with /boss: ${current_webui_url}"
  [[ "${current_api_base_url}" == *"/v1" ]] || fail "OPENAI_API_BASE_URL must end with /v1: ${current_api_base_url}"
  pass "Open WebUI env file looks sane"
else
  warn "Missing ${DEPLOY_ENV_FILE}; run prepare-openwebui-hermes-env.sh first"
  current_openai_api_key=""
fi

if [[ -f "${HERMES_ENV_FILE}" ]]; then
  current_hermes_key="$(read_env_value "${HERMES_ENV_FILE}" "API_SERVER_KEY")"
  [[ -n "${current_hermes_key}" ]] || fail "API_SERVER_KEY missing in ${HERMES_ENV_FILE}"
  if [[ -n "${current_openai_api_key}" && "${current_openai_api_key}" != "${current_hermes_key}" ]]; then
    fail "Hermes API_SERVER_KEY does not match Open WebUI OPENAI_API_KEY"
  fi
  pass "Hermes env file looks sane"
else
  warn "Missing ${HERMES_ENV_FILE}; run prepare-openwebui-hermes-env.sh first"
fi

if command -v systemctl >/dev/null 2>&1; then
  if systemctl list-unit-files "hermes-gateway@*.service" >/dev/null 2>&1; then
    if systemctl is-active --quiet "hermes-gateway@$(id -un)"; then
      pass "systemd service hermes-gateway@$(id -un) is active"
    else
      warn "systemd service hermes-gateway@$(id -un) is not active"
    fi
  fi
fi

if command -v docker >/dev/null 2>&1; then
  if docker ps --format '{{.Names}}' | grep -qx 'xueyin-open-webui'; then
    pass "Docker container xueyin-open-webui is running"
  else
    warn "Docker container xueyin-open-webui is not running"
  fi
fi

check_http_contains "Backend health" "${BACKEND_URL}" '"service":"xueyin-backend"'
check_http_contains "Hermes health" "${HERMES_HEALTH_URL}" '"status"'
check_http_contains "Hermes models" "${HERMES_MODELS_URL}" '"data"'

if [[ "${SKIP_BOSS}" != "1" ]]; then
  boss_headers="$(curl --silent --show-error --fail --location --head --max-time "${TIMEOUT_SECONDS}" "${BOSS_URL}")" || fail "Public /boss unreachable: ${BOSS_URL}"
  if [[ "${boss_headers}" != *"200"* && "${boss_headers}" != *"302"* ]]; then
    fail "Unexpected /boss response headers from ${BOSS_URL}"
  fi
  pass "Public /boss reachable: ${BOSS_URL}"
fi

echo "All critical checks completed."
