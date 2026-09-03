/**
 * Unidades de produção (relação do Pedro) + amostra CQ.
 * O valor gravado no bug é o nome de exibição — grupo + escola.
 */
export type PolygonusUnit = {
  label: string;
  group?: string;
  url?: string;
  runtimeEnv: "amostra" | "producao";
};

export function unitDisplayName(unit: PolygonusUnit): string {
  return unit.group ? `(${unit.group}) ${unit.label}` : unit.label;
}

export const POLYGONUS_KNOWN_UNITS: PolygonusUnit[] = [
  { label: "Colégio de Demonstração", runtimeEnv: "amostra" },

  { group: "IMM", label: "COLÉGIO PIO XII", url: "https://gestao.portalimm.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "IMM", label: "COLÉGIO LAURA VICUNHA", url: "https://gestao.portalimm.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "IMM", label: "INSTITUTO MADRE MARTA CERUTTI", url: "https://gestao.portalimm.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "IMM", label: "INSTITUTO MARIA AUXILIADORA", url: "https://gestao.portalimm.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "IMM", label: "INSTITUTO AUXILIADORA SILVÂNIA", url: "https://gestao.portalimm.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "IMM", label: "INSTITUTO MARIA IMACULADA", url: "https://gestao.portalimm.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "IMM", label: "INSTITUTO NOSSA SENHORA DA GLÓRIA CASTELO", url: "https://gestao.portalimm.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "IMM", label: "INSTITUTO NOSSA SENHORA AUXILIADORA", url: "https://gestao.portalimm.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "IMM", label: "INSTITUTO TERESA VALSÉ", url: "https://gestao.portalimm.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "IMM", label: "INSTITUTO AUXILIADORA SÃO JOÃO DEL REI", url: "https://gestao.portalimm.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "IMM", label: "ESCOLA PATRONATO MADRE MAZZARELLO", url: "https://gestao.portalimm.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "IMM", label: "ESCOLA SALESIANA BRASÍLIA", url: "https://gestao.portalimm.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "IMM", label: "ESCOLA NOSSA SENHORA AUXILIADORA", url: "https://gestao.portalimm.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "IMM", label: "COLÉGIO CORAÇÃO DE JESUS", url: "https://gestao.portalimm.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },

  { group: "SÃO BENTO", label: "COLÉGIO SANTA ESCOLÁSTICA", url: "https://saobento.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "SÃO BENTO", label: "COLÉGIO CRISTO REI", url: "https://saobento.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "SÃO BENTO", label: "INSTITUTO IMACULADA CONCEIÇÃO", url: "https://saobento.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },

  { group: "AESCOM", label: "COLÉGIO BERLAAR SAGRADO CORAÇÃO DE JESUS", url: "https://aescom.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "AESCOM", label: "COLÉGIO BERLAAR SAGRADO CORAÇÃO DE MARIA", url: "https://aescom.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "AESCOM", label: "ASSOCIAÇÃO DE EDUCAÇÃO SAGRADO CORAÇÃO DE MARIA", url: "https://aescom.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "AESCOM", label: "COLÉGIO BERLAAR IMACULADA CONCEIÇÃO", url: "https://aescom.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "AESCOM", label: "COLÉGIO BERLAAR NOSSA SENHORA DO PATROCÍNIO", url: "https://aescom.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "AESCOM", label: "PATRONATO BERLAAR CORONEL JOÃO CANDIDO DE AGUIAR", url: "https://aescom.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },

  { group: "INSA", label: "SALESIANAS LAURA VICUNA", url: "https://insa.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "INSA", label: "COLÉGIO SALESIANAS AUXILIUM", url: "https://insa.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "INSA", label: "INSTITUTO MARIA AUXILIADORA", url: "https://insa.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "INSA", label: "ESCOLA SANTA MARIA MAZZARELLO", url: "https://insa.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "INSA", label: "COLÉGIO SALESIANAS AUXILIADORA", url: "https://insa.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "INSA", label: "INSPETORIA NOSSA SENHORA DA AMAZÔNIA", url: "https://insa.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },

  { label: "COLÉGIO NOSSA SENHORA DO CARMO VIÇOSA", url: "https://colegiocarmo.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { label: "COLÉGIO NOSSA SENHORA DO CARMO JUIZ DE FORA", url: "https://colegiocarmo.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { label: "COLÉGIO NOSSA SENHORA DO CARMO CATAGUASES", url: "https://colegiocarmo.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { label: "COLÉGIO NOSSA SENHORA DO CARMO TERESÓPOLIS", url: "https://carmotere.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },

  { group: "CENTEC", label: "CENTRO DE ENSINO TÉCNICO", url: "https://centec.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { group: "ITEAM", label: "INSTITUTO TECNOLÓGICO EDUCACIONAL DA AMAZÔNIA", url: "https://centec.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },

  { group: "ISMA", label: "COLÉGIO DOM BOSCO", url: "https://isma.polygonus.com.br/web/react/gestao", runtimeEnv: "producao" },
  { group: "CEC", label: "CENTRO DE EDUCAÇÃO E CULTURA", url: "https://cec.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },

  { label: "ESCOLA LOGOSÓFICA", url: "https://logosofia.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { label: "INSTITUTO BATISTA IDA NELSON", url: "https://idanelson.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { label: "SISTEMA PIAGET DE ENSINO", url: "https://piaget.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { label: "ESCOLA SANTA TERESINHA", url: "https://santateresinha.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { label: "COLÉGIO PROVIDÊNCIA", url: "https://providencia.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { label: "COLÉGIO VILLA REAL", url: "https://villareal.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { label: "ESCOLINHA MARIA IMACULADA", url: "https://emi.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { label: "CENTRO EDUCACIONAL ARTE DO SABER", url: "https://ceas.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { label: "INSTITUTO EDUCACIONAL SANTO ELIAS", url: "https://santoelias.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { label: "COLÉGIO VICENTINO IMACULADA CONCEIÇÃO", url: "https://imaculada.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { label: "COLÉGIO MAURÍCIO SALLES DE MELLO", url: "https://mauriciosalles.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { label: "CENTRO EDUCACIONAL ADALBERTO VALLE", url: "https://adalbertovalle.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { label: "Centro Educacional Adalberto Valle — Unidade I (Manaus)", url: "https://adalbertovalle.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { label: "COLÉGIO NOSSA SENHORA DE NAZARÉ", url: "https://nazare.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { label: "COLÉGIO COPAM PAMPULHA", url: "https://pampulha.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { label: "CENTRO EDUCACIONAL IGAPÓ", url: "https://igapo.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
  { label: "COLÉGIO CONNEXUS", url: "https://connexus.polygonus.com.br/acropoly/FIndex.html", runtimeEnv: "producao" },
];

export function unitsForEnv(runtimeEnv?: "amostra" | "producao") {
  if (!runtimeEnv) return POLYGONUS_KNOWN_UNITS;
  return POLYGONUS_KNOWN_UNITS.filter((u) => u.runtimeEnv === runtimeEnv);
}
