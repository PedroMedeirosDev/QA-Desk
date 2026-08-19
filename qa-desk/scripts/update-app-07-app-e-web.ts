/**
 * Recategoriza APP-07: App nativo e APP versão WEB (não só APP WEB).
 *   npx tsx scripts/update-app-07-app-e-web.ts
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { appendHistory, readCatalog, writeCatalog } from "../server/storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env") });

const PROJECT = "polygonus" as const;
const BUG_CODE = "APP-07";

async function main() {
  const catalog = await readCatalog(PROJECT);
  const report = catalog.reports.find((r) => r.bugCode === BUG_CODE);
  if (!report) {
    throw new Error(`${BUG_CODE} não encontrado`);
  }

  report.platform = "app_web";
  report.title =
    "Rotina (Mural · App e APP WEB): horário do card em UTC (3h à frente do GMT-3)";
  report.description =
    "Na lista da aba Rotina, no App nativo e no APP versão WEB, o horário ao lado do título do card (Soneca, Banheiro…) aparece 3 horas à frente do horário real de lançamento. Os chips de horário da própria rotina (ex.: 14:20 na Soneca) continuam corretos em GMT-3. Mesmo widget Flutter nos dois. Padrão UTC vs America/Sao_Paulo — mesmo desvio de ~3h já visto em comunicado (“há 3h”) e POL-11 (chat).";
  report.preconditions =
    "App nativo (APK/emulador) e APP versão WEB (browser, amostra). URL WEB: https://amostra.polygonus.com.br/web/react/gestao → iframe Flutter. Login PHJESUS, função COORDENADOR. Relógio em GMT-3. Homologação Rotina 13/08/2026 (print no APP WEB; mesmo card no App).";
  report.steps = [
    "Abrir o App (Android) ou o APP na versão WEB (browser, amostra) — o card é o mesmo widget Flutter",
    "Logar como PHJESUS no perfil COORDENADOR",
    "Abrir Mural → aba Rotina",
    "Lançar uma rotina nova (ex.: Soneca Dormiu/Bem ou Banheiro Xixi/No vaso) e anotar o horário local do envio",
    "Voltar à lista Recebidas do dia e ler o horário ao lado do título do card",
  ];
  report.actualResult =
    "Cabeçalho do card em UTC nos dois: no APP WEB, Soneca 17:20 com chip 14:20; Banheiro 17:15; outra Soneca 17:14 com chip 14:15. Desvio fixo de +3h. Lançamentos por volta das 14:15–14:20 (GMT-3). No App nativo o cabeçalho usa o mesmo datRegistro.hour sem toLocal().";
  report.build = "amostra WEB + APK 6.06.28 (13/08/2026)";
  report.browser = "Chrome (Playwright headed)";
  report.deviceLabel = "emulador (mesmo widget no App)";
  report.technicalEvidence =
    "Mesmo widget no App nativo e no Flutter Web: lib/rotina/widgets/rotina_card.dart — cabeçalho usa registro.datRegistro.hour/.minute sem toLocal(). Parse: DateTime.tryParse(json['datRegistro']) em rotina_registro.dart. Se a API manda RFC3339 com Z, .hour fica em UTC (17:20) e o chip TipResposta.horario (14:20) segue o valor da pergunta, não o datRegistro. Conferir JSON bruto de datRegistro no feed. Print da lista no APP WEB (13/08). Relacionado: CT mural “há 3h” e POL-11.";
  const tags = new Set(report.tags ?? []);
  tags.add("rotina");
  tags.add("fuso-horario");
  tags.add("utc");
  tags.add("app-web");
  tags.add("app-nativo");
  tags.add("mural");
  report.tags = [...tags];

  appendHistory(report, {
    actor: "Pedro (script)",
    action: "test_updated",
    detail:
      "Recategorizado: App (mobile) e APP versão WEB (platform app_web). Código APP-07 mantido.",
  });

  await writeCatalog(PROJECT, catalog);
  console.log("ok", {
    id: report.id,
    bugCode: report.bugCode,
    platform: report.platform,
    title: report.title,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
