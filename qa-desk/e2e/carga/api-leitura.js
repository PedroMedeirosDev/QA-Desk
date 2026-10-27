// Teste de carga simples da API (k6). Sobe junto com a API em modo mock:
//   npm run e2e:api:carga   (outro terminal)
//   npm run test:carga
// Critérios de aceite em `thresholds`: se algum falhar, o k6 sai com erro e o CI reprova.
/* global __ENV */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.QA_DESK_API ?? "http://127.0.0.1:3011";

export const options = {
  stages: [
    { duration: "10s", target: 10 },
    { duration: "20s", target: 10 },
    { duration: "5s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
    checks: ["rate>0.99"],
  },
};

const ROTAS = [
  { nome: "health", url: `${BASE}/api/health` },
  { nome: "projetos", url: `${BASE}/api/projects` },
  { nome: "catalogo", url: `${BASE}/api/projects/anihype/tests` },
];

export default function () {
  for (const rota of ROTAS) {
    const res = http.get(rota.url, { tags: { rota: rota.nome } });
    check(res, {
      [`${rota.nome}: status 200`]: (r) => r.status === 200,
      [`${rota.nome}: corpo JSON`]: (r) => (r.headers["Content-Type"] ?? "").includes("application/json"),
    });
  }
  sleep(1);
}

export function handleSummary(data) {
  const m = data.metrics;
  const linha = (nome, v) => `| ${nome} | ${v} |`;
  const resumo = [
    "## Carga da API (k6)",
    "",
    "| Métrica | Valor |",
    "|---|---|",
    linha("Requisições", m.http_reqs.values.count),
    linha("Falhas", `${(m.http_req_failed.values.rate * 100).toFixed(2)}%`),
    linha("Tempo p95", `${m.http_req_duration.values["p(95)"].toFixed(1)} ms`),
    linha("Tempo médio", `${m.http_req_duration.values.avg.toFixed(1)} ms`),
    "",
  ].join("\n");
  return {
    stdout: `${resumo}\n`,
    "e2e/carga/resultado.json": JSON.stringify(data, null, 2),
    "e2e/carga/resumo.md": resumo,
  };
}
