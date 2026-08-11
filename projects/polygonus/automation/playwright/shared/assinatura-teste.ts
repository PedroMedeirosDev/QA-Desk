/**
 * Assinatura nos textos de comunicado — identifica origem do teste no Mural.
 *
 * Maestro (emulador): "Teste Maestro Emulador"
 * Playwright (Chrome): "Teste Playwright Chrome"
 *
 * No WEB o ID do card não aparece — use um código curto de run (#…),
 * não horário (UTC confundia com o fuso BR).
 */
export const ASSINATURA_MAESTRO = "Teste Maestro Emulador";
export const ASSINATURA_PLAYWRIGHT = "Teste Playwright Chrome";

/** Código curto por execução (único o bastante p/ achar o card no feed). */
export function runIdCurto(): string {
  return Date.now().toString(36).slice(-6);
}

/**
 * Texto do comunicado com assinatura + rótulo do CT.
 * Por padrão acrescenta `#xxxxxx` (não usa data/hora).
 * `opts.stamp: false` → só assinatura + rótulo.
 */
export function textoComunicadoPlaywright(
  rotulo: string,
  opts?: { stamp?: boolean; runId?: string },
): string {
  const id =
    opts?.stamp === false
      ? ""
      : ` #${opts?.runId?.trim() || runIdCurto()}`;
  return `${ASSINATURA_PLAYWRIGHT} - ${rotulo}${id}`;
}

/** Prefixo Maestro (YAML: prefixar TEXTO_COMUNICADO com isto). */
export function textoComunicadoMaestro(rotulo: string): string {
  return `${ASSINATURA_MAESTRO} - ${rotulo}`;
}
