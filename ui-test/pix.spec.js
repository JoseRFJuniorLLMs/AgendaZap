import {test,expect} from '@playwright/test';

test('owner saves multiple Pix keys and selects a primary key on desktop and mobile',async({page})=>{
 const tenant={id:'tenant-ui',name:'Hotel UI',slug:'hotel-ui',timezone:'America/Sao_Paulo',address:'',review_url:'',min_notice_minutes:60,horizon_days:90,buffer_minutes:0,cancellation_hours:24,recovery_days:60,integrations:{phone_id:''}},session={csrf:'ui-csrf',user:{name:'Owner UI',role:'owner'},tenant};
 let pix={enabled:false,recipient_name:'',recipient_city:'',keys:[],default_key_id:null};
 await page.route('**/AgendaZap/api/**',async route=>{const path=new URL(route.request().url()).pathname.replace('/AgendaZap/api','');if(path==='/auth/me')return route.fulfill({json:session});if(path==='/settings/pix'){pix=route.request().postDataJSON();return route.fulfill({json:pix});}if(path==='/settings')return route.fulfill({json:{tenant,pix,integrations:{pix:pix.enabled,whatsapp:false,ai:false}}});return route.fulfill({status:404,json:{error:'mock_not_found'}});});
 await page.setViewportSize({width:1421,height:788});await page.goto('./#app/settings');
 await expect(page.getByRole('heading',{name:'Meu Pix · recebimento direto'})).toBeVisible();
 await expect(page.getByText('Mercado Pago')).toHaveCount(0);
 await page.getByLabel('Nome do recebedor',{exact:true}).fill('Hotel UI');await page.getByLabel('Cidade do recebedor',{exact:true}).fill('São Paulo');
 await page.getByRole('button',{name:'+ Adicionar chave Pix'}).click();const first=page.locator('[data-pix-key]').first();await first.getByLabel('Chave Pix',{exact:true}).fill('hotel@example.com');await first.getByLabel('Identificação (opcional)').fill('Conta e-mail');
 await page.getByRole('button',{name:'+ Adicionar chave Pix'}).click();const second=page.locator('[data-pix-key]').nth(1);await second.getByLabel('Tipo de chave').selectOption('phone');await second.getByLabel('Chave Pix',{exact:true}).fill('+5511999999999');await second.getByLabel('Chave principal').check();
 await page.getByLabel('Ativar Pix nas reservas com sinal').check();await page.getByRole('button',{name:'Salvar meu Pix'}).click();
 await expect(page.locator('[data-pix-key]')).toHaveCount(2);expect(pix.keys.length).toBe(2);expect(pix.default_key_id).toBe(pix.keys[1].id);expect(pix.enabled).toBe(true);
 await page.setViewportSize({width:390,height:844});await page.reload();await expect(page.locator('[data-pix-key]')).toHaveCount(2);await expect(page.locator('[data-pix-key]').nth(1).getByLabel('Chave principal')).toBeChecked();
 const dimensions=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
 await page.locator('[data-pix-key]').nth(1).getByRole('button',{name:'Remover'}).click();await expect(page.locator('[data-pix-key]')).toHaveCount(1);await expect(page.locator('[data-pix-key]').first().getByLabel('Chave principal')).toBeChecked();
});
