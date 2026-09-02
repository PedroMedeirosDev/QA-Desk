import { test, expect } from '@playwright/test';

test.use({
  locale: 'pt-BR',
  storageState: '.auth/user.json'
});

test('test', async ({ page }) => {
  await page.goto('https://carmotere.polygonus.com.br:8443/web/react/gestao/login');
  await page.locator('iframe[src="https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/f/av0/rch/wj24x/0x4AAAAAAADnPIDROrmt1Wwj/light/fbE/new/normal?lang=auto"]').contentFrame().locator('body').click();
  await page.goto('https://carmotere.polygonus.com.br:8443/web/react/gestao/login');
  await page.locator('iframe[src="https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/f/av0/rch/ujvex/0x4AAAAAAADnPIDROrmt1Wwj/light/fbE/new/normal?lang=auto"]').contentFrame().locator('body').click();
  await page.goto('https://carmotere.polygonus.com.br:8443/web/react/gestao/login');
});