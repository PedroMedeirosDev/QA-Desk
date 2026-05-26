#!/usr/bin/env python3
"""
Extrai um registro mínimo para suporte (Sheets / Discord) a partir de um JSON de evento Sentry.
Usa apenas campos em lista branca — não copia breadcrumbs nem contexts (PII).
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
from pathlib import Path
from typing import Any


def _tag_map(tags: Any) -> dict[str, str]:
    if not isinstance(tags, list):
        return {}
    out: dict[str, str] = {}
    for pair in tags:
        if isinstance(pair, (list, tuple)) and len(pair) >= 2:
            k, v = str(pair[0]), str(pair[1])
            out[k] = v
    return out


def _parse_release(release: str) -> tuple[str, str, str]:
    """
    Formato comum Sentry/Flutter: package@version+build
    Retorna (pacote, versao_app, build).
    """
    release = (release or "").strip()
    if not release:
        return "", "", ""
    if "@" not in release:
        return "", release, ""
    pkg, rest = release.rsplit("@", 1)
    if "+" in rest:
        ver, bld = rest.split("+", 1)
        return pkg, ver, bld
    return pkg, rest, ""


def _platform_from_event(data: dict[str, Any], tag_map: dict[str, str]) -> str:
    # Em Android o Sentry costuma pôr o modelo em device.family (ex.: SM-A356E).
    # Para suporte, priorize o SO: tags os.name ou contexts.os.name.
    os_name = (tag_map.get("os.name") or "").strip()
    if os_name:
        return os_name
    ctx = data.get("contexts")
    if isinstance(ctx, dict):
        os_ctx = ctx.get("os")
        if isinstance(os_ctx, dict):
            nm = str(os_ctx.get("name") or "").strip()
            if nm:
                return nm
    fam = (tag_map.get("device.family") or "").strip()
    if fam:
        return fam
    plat = data.get("platform")
    if isinstance(plat, str) and plat and plat != "other":
        return plat
    return "other"


def _exception_summary(exc: Any) -> tuple[str, str]:
    """(tipo, mensagem) da primeira exceção, se existir."""
    if not isinstance(exc, dict):
        return "", ""
    values = exc.get("values")
    if not isinstance(values, list) or not values:
        return "", ""
    first = values[0]
    if not isinstance(first, dict):
        return "", ""
    return str(first.get("type") or ""), str(first.get("value") or "")


def extract_support_record(data: dict[str, Any]) -> dict[str, str]:
    tag_map = _tag_map(data.get("tags"))
    pkg, ver, build_from_rel = _parse_release(str(data.get("release") or ""))
    dist = str(data.get("dist") or "").strip() or build_from_rel

    etype, emsg = _exception_summary(data.get("exception"))
    title = str(data.get("title") or "").strip()
    if not title and etype:
        title = f"{etype}: {emsg}".strip(": ")

    if etype or emsg:
        desc = f"{etype}: {emsg}".strip(": ").strip()
    else:
        desc = title or "Erro sem mensagem no payload"

    culprit = str(data.get("culprit") or "")

    return {
        "event_id": str(data.get("event_id") or data.get("id") or ""),
        "pacote": pkg,
        "versao_app": ver,
        "build": dist,
        "versao_corrigida": "",
        "data_ocorrencia_utc": str(data.get("datetime") or data.get("timestamp") or ""),
        "data_correcao": "",
        "plataforma": _platform_from_event(data, tag_map),
        "ambiente": str(data.get("environment") or ""),
        "descricao_erro": desc,
        "descricao_solucao": "",
        "titulo_sentry": title,
        "culprit": culprit,
        "sentry_release": str(data.get("release") or ""),
        "dist": dist,
        "observacoes": "",
    }


SHEET_COLUMNS = [
    "event_id",
    "pacote",
    "versao_app",
    "build",
    "versao_corrigida",
    "data_ocorrencia_utc",
    "data_correcao",
    "plataforma",
    "ambiente",
    "descricao_erro",
    "descricao_solucao",
    "titulo_sentry",
    "culprit",
    "sentry_release",
    "dist",
    "observacoes",
]


def record_to_csv_row(rec: dict[str, str]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow([rec.get(c, "") for c in SHEET_COLUMNS])
    return buf.getvalue().rstrip("\n")


def main() -> int:
    p = argparse.ArgumentParser(description="Sentry event JSON → support_record JSON/CSV")
    p.add_argument("input_json", nargs="?", help="Arquivo JSON; omitir para ler stdin")
    p.add_argument("--pretty", action="store_true", help="JSON indentado")
    p.add_argument("--csv", action="store_true", help="Uma linha CSV (ordem Sheets)")
    p.add_argument("--out", type=Path, help="Gravar JSON neste caminho")
    args = p.parse_args()

    raw = Path(args.input_json).read_text(encoding="utf-8") if args.input_json else sys.stdin.read()
    data = json.loads(raw)
    if not isinstance(data, dict):
        print("JSON raiz deve ser um objeto.", file=sys.stderr)
        return 2

    rec = extract_support_record(data)

    if args.csv:
        print(record_to_csv_row(rec))
    else:
        text = json.dumps(rec, ensure_ascii=False, indent=2 if args.pretty else None)
        if args.pretty:
            print(text)
        else:
            print(text)

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
