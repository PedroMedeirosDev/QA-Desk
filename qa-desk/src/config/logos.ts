import polygonusLogo from "@/assets/logos/polygonus_logo.png";

/** URLs bundladas pelo Vite — mais confiáveis que /public em dev */
const BUNDLED_LOGOS: Record<string, string> = {
  polygonus_logo: polygonusLogo,
  polygonus: polygonusLogo,
};

export function getBundledLogoUrl(logoFile: string): string | undefined {
  const slug = logoFile.replace(/_logo$/, "");
  return BUNDLED_LOGOS[logoFile] ?? BUNDLED_LOGOS[slug] ?? BUNDLED_LOGOS[`${slug}_logo`];
}
