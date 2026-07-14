#!/usr/bin/env bash
# Sincroniza clones locais do codigo da empresa (somente leitura neste projeto QA).
#
# WINDOWS (PowerShell): NAO rode este .sh no terminal padrao.
#   Use na raiz do projeto:  .\sync.bat
#   ou:  .\scripts\sync-company-repos.ps1
#
# Linux / macOS / Git Bash:
# Uso: ./scripts/sync-company-repos.sh
#      ./scripts/sync-company-repos.sh --only mobile
#      ./scripts/sync-company-repos.sh --hard

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ONLY="all"
HARD=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --only) ONLY="${2:-}"; shift 2 ;;
    --hard) HARD=1; shift ;;
    -h|--help)
      echo "Uso: $0 [--only mobile|react|all] [--hard]"
      exit 0
      ;;
    *) echo "Opcao desconhecida: $1" >&2; exit 1 ;;
  esac
done

sync_repo() {
  local id="$1" name="$2" url="$3" branch="$4"
  local target="${ROOT}/${name}"

  echo ""
  echo "==> ${name}"

  if [[ ! -d "${target}" ]]; then
    echo "    Clonando ${url} ..."
    git clone --branch "${branch}" "${url}" "${target}"
    return
  fi

  if [[ ! -d "${target}/.git" ]]; then
    echo "ERRO: ${target} existe mas nao e um repositorio git." >&2
    exit 1
  fi

  pushd "${target}" >/dev/null
  git fetch origin "${branch}"

  if [[ -n "$(git status --porcelain)" ]]; then
    if [[ "${HARD}" -eq 1 ]]; then
      echo "    AVISO: descartando alteracoes locais (--hard)."
      git reset --hard "origin/${branch}"
      git clean -fd
    else
      echo "    AVISO: ha alteracoes locais. Nao atualizei."
      git status -sb
      echo "    Rode com --hard para descartar."
      popd >/dev/null
      return
    fi
  else
    git checkout "${branch}" 2>/dev/null || true
    git pull --ff-only origin "${branch}"
  fi

  echo "    OK: $(git log -1 --oneline)"
  popd >/dev/null
}

echo "QA Automate — sincronizar codigo da empresa"
echo "Raiz: ${ROOT}"

if [[ "${ONLY}" == "all" || "${ONLY}" == "mobile" ]]; then
  sync_repo mobile polygonus-mobile \
    "https://github.com/polygonus-br/polygonus-mobile.git" cq
fi

if [[ "${ONLY}" == "all" || "${ONLY}" == "react" ]]; then
  sync_repo react polygonus-react \
    "https://github.com/polygonus-br/polygonus-react.git" cq
fi

echo ""
echo "Concluido."
