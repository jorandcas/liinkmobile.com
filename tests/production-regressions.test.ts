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
