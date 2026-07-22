import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');

test('valid login audits the id returned from tenants', () => {
  const source = fs.readFileSync(path.join(root, 'src/controllers/auth.controller.ts'), 'utf8');
  assert.match(source, /await logAction\(\s*result\.user!\.id,/);
});

test('login without a resolved tenant audits NULL and validates ids', () => {
  const controller = fs.readFileSync(path.join(root, 'src/controllers/auth.controller.ts'), 'utf8');
  const auditService = fs.readFileSync(path.join(root, 'src/services/audit.service.ts'), 'utf8');
  assert.match(controller, /await logAction\(\s*null,/);
  assert.match(auditService, /tenantId: number \| null/);
  assert.match(auditService, /SELECT id FROM tenants WHERE id = \$1/);
});

test('campaign retry supplies campana.id as parameter 7', () => {
  const source = fs.readFileSync(path.join(root, 'src/services/campana.service.db.ts'), 'utf8');
  const update = source.match(/UPDATE campanas[\s\S]*?WHERE id = \$7`[,]?[\s\S]*?\[([\s\S]*?)\]\s*\)/);
  assert.ok(update, 'campaign statistics update was not found');
  assert.match(update[1], /'completada',\s*campana\.id/);
});

test('API requests use the centralized three-second delay', () => {
  const config = fs.readFileSync(path.join(root, 'src/config/endpoints.config.ts'), 'utf8');
  const distributor = fs.readFileSync(path.join(root, 'src/services/distribuidor.service.ts'), 'utf8');
  const campaignDb = fs.readFileSync(path.join(root, 'src/services/campana.service.db.ts'), 'utf8');

  assert.match(config, /delayBetweenRequests: 3000/);
  assert.doesNotMatch(distributor, /setTimeout\(resolve, 5000\)/);
  assert.doesNotMatch(campaignDb, /setTimeout\(resolve, 5000\)/);
  assert.match(distributor, /API_CONFIG\.concurrency\.delayBetweenRequests/);
  assert.match(campaignDb, /API_CONFIG\.concurrency\.delayBetweenRequests/);
});

test('bulk validation UI estimates time at three seconds per DN', () => {
  const dashboard = fs.readFileSync(path.join(root, 'public/js/dashboard.js'), 'utf8');
  const dashboardHtml = fs.readFileSync(path.join(root, 'public/dashboard.html'), 'utf8');

  assert.match(dashboard, /cantidadNumeros \* 3 \/ 60/);
  assert.doesNotMatch(dashboard, /cantidadNumeros \* 5 \/ 60/);
  assert.match(dashboardHtml, /3 segundos de espera entre cada consulta/);
});

test('bulk validation displays live progress and timing details', () => {
  const dashboard = fs.readFileSync(path.join(root, 'public/js/dashboard.js'), 'utf8');
  const dashboardHtml = fs.readFileSync(path.join(root, 'public/dashboard.html'), 'utf8');

  for (const id of ['progressBar', 'progressText', 'progressProcessed', 'progressElapsed', 'progressRemaining']) {
    assert.match(dashboardHtml, new RegExp(`id=["']${id}["']`));
  }
  assert.match(dashboard, /function renderBulkProgress\(\)/);
  assert.match(dashboard, /setInterval\(renderBulkProgress, 1000\)/);
  assert.match(dashboard, /showProgressBar\(cantidadNumeros\)/);
  assert.match(dashboardHtml, /dashboard\.js\?v=17/);
});

test('bulk validation prevents duplicate jobs and flushes progress events', () => {
  const controller = fs.readFileSync(path.join(root, 'src/controllers/distribuidor.controller.ts'), 'utf8');
  const service = fs.readFileSync(path.join(root, 'src/services/distribuidor.service.ts'), 'utf8');

  assert.match(controller, /tenantsConValidacionActiva\.has\(tenantId\)/);
  assert.match(controller, /tenantsConValidacionActiva\.add\(tenantId\)/);
  assert.match(controller, /tenantsConValidacionActiva\.delete\(tenantId\)/);
  assert.match(controller, /\.flush\?\.\(\)/);
  assert.match(service, /onProgress\(0, telefonos\.length\)/);
});

test('bulk validation progress can be polled per tenant', () => {
  const controller = fs.readFileSync(path.join(root, 'src/controllers/distribuidor.controller.ts'), 'utf8');
  const routes = fs.readFileSync(path.join(root, 'src/routes/distribuidor.routes.ts'), 'utf8');
  const dashboard = fs.readFileSync(path.join(root, 'public/js/dashboard.js'), 'utf8');

  assert.match(controller, /progresoValidacionesMasivas\.get\(tenantId\)/);
  assert.match(routes, /router\.get\('\/validate\/bulk\/status'/);
  assert.match(dashboard, /fetch\('\/api\/validate\/bulk\/status'/);
  assert.match(dashboard, /setInterval\(pollBulkProgress, 1000\)/);
  assert.match(dashboard, /resumeActiveBulkProgress\(\)/);
});

test('completed bulk validation is persisted as a campaign by the backend', () => {
  const controller = fs.readFileSync(path.join(root, 'src/controllers/distribuidor.controller.ts'), 'utf8');
  const dashboard = fs.readFileSync(path.join(root, 'public/js/dashboard.js'), 'utf8');

  assert.match(controller, /await CampanaServiceDB\.crear\(/);
  assert.match(controller, /campana: \{ id: campana\.id, nombre: campana\.nombre \}/);
  assert.match(dashboard, /La campaña ya fue persistida por el backend/);
});
