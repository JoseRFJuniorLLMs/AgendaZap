import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('landing mobile does not overflow and keeps login reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');

  await expect(page.locator('.logo-official img')).toHaveAttribute('src', './logo-horizontal.svg');
  await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible();

  const dimensions=await page.evaluate(()=>({
    client:document.documentElement.clientWidth,
    scroll:document.documentElement.scrollWidth
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);

  await expect(page.getByText('Revenue Autopilot',{exact:true}).first()).toBeVisible();
  await expect(page.getByText('R$ 249/mês')).toBeVisible();
});

test('registration, mobile drawer and Voice AI panel remain usable', async ({ page }) => {
  const suffix=Date.now().toString(36);
  const tenant={id:'tenant-ui',name:'Studio UI',slug:'studio-ui',timezone:'America/Sao_Paulo',recovery_days:60};
  const session={csrf:'csrf-ui',user:{id:'owner-ui',name:'Teste UI',role:'owner'},tenant};

  await page.route('**/AgendaZap/api/**',async route=>{
    const url=new URL(route.request().url());
    const path=url.pathname.replace('/AgendaZap/api','');
    if(path==='/auth/register'||path==='/auth/me')return route.fulfill({json:session});
    if(path.startsWith('/dashboard'))return route.fulfill({json:{metrics:{appointments:0,expected_revenue:0,received_revenue:0,recoverable:0,confirmed:0,cancelled:0,no_show:0},appointments:[]}});
    if(path==='/jobs')return route.fulfill({json:[]});
    if(path==='/settings')return route.fulfill({json:{tenant,integrations:{whatsapp:false,pix:false,ai:false}}});
    if(path==='/voice/health')return route.fulfill({json:{ok:true,provider:'gemini',configured:false,transcribeModel:'gemini-3.5-transcribe',ttsModel:'gemini-3.8-flash-lite-tts'}});
    if(path==='/voice/config/tenant-ui')return route.fulfill({json:{responseMode:'mirror_customer',customVocabulary:['AgendaZap']}});
    if(path==='/voice/usage/tenant-ui')return route.fulfill({json:{requests:0,errors:0,ttsCharacters:0}});
    return route.fulfill({status:404,json:{error:'mock_not_found'}});
  });

  await page.setViewportSize({width:390,height:844});
  await page.goto('./#register');

  await page.getByLabel('Seu nome').fill('Teste UI');
  await page.getByLabel('E-mail').fill(`ui-${suffix}@example.test`);
  await page.getByLabel('Senha').fill('AgendaZap-UI-123!');
  await page.getByLabel('Nome do negócio').fill('Studio UI');
  await page.getByLabel('Endereço da agenda').fill(`studio-ui-${suffix}`);
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:/Criar meu negócio/}).click();

  await expect(page).toHaveURL(/#app\/dashboard/);
  await page.getByRole('button',{name:'Abrir menu'}).click();
  await expect(page.locator('.sidebar')).toHaveClass(/open/);
  await expect(page.locator('.sidebar-backdrop')).toHaveClass(/open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.sidebar')).not.toHaveClass(/open/);

  await page.goto('./#app/automations');
  await expect(page.getByText('Texto e áudio no mesmo atendimento')).toBeVisible();
  await expect(page.locator('#voice-mode')).toBeVisible();
  await expect(page.getByText('Gemini sem chave')).toBeVisible();
});

test('manifest exposes installable raster icons', async ({ request }) => {
  const response=await request.get('./manifest.webmanifest');
  expect(response.ok()).toBeTruthy();
  const manifest=await response.json();
  expect(manifest.start_url).toBe('./');
  expect(manifest.icons.some(icon=>icon.sizes==='192x192')).toBeTruthy();
  expect(manifest.icons.some(icon=>icon.sizes==='512x512')).toBeTruthy();
});


test('PWA shell remains available offline after first load', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });

  await expect(page.locator('.logo-official img')).toBeVisible();
  await expect(page.getByRole('link', { name: /Criar meu negócio/ })).toBeVisible();

  await context.setOffline(false);
});
