/* Run with Playwright available on NODE_PATH; uses a fresh browser context. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const storage = require('../../js/storage.js');
const url = process.env.WEEKFLOW_TEST_URL || 'http://127.0.0.1:8766/Weekflow.html';
const dataKey = 'weekflow-v2.4:data:v4';
const stamp = '2026-09-09T08:00:00.000Z';
const fixture = storage.validateData({ version: 4,
  groups: [{ id: 'g1', name: '项目 A' }, { id: 'g2', name: '项目 B' }],
  flows: [{ id: 'f1', groupId: 'g1', name: '发布流程' }],
  tasks: [
    { id: 't1', groupId: 'g1', flowId: 'f1', flowOrder: 1, name: '检查', ddl: '2026-09-10' },
    { id: 't2', groupId: 'g1', name: '交付', ddl: '2026-09-11' },
    { id: 't3', groupId: 'g2', name: '验收', ddl: '2026-09-12' }
  ].map(t => ({ ...t, urgency: 'medium', status: 'pending', reportTo: 'Lucy', managedObject: 'Jack', deliverable: '交付报告', progressEntries: [{ id: 'p-' + t.id, contentText: '初稿已完成', contentHtml: '<p><strong>初稿已完成</strong></p>', createdAt: stamp, updatedAt: stamp }] })),
  materials: [{ id: 'm1', title: '操作指南', url: 'https://example.com/guide', type: 'document', taskIds: ['t1'], flowIds: ['f1'], groupIds: ['g1'] }], notes: []
}).data;
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  const stored = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), dataKey);
  const bulkView = page.locator('#bulk-view');
  const dialog = page.locator('.bulk-dialog');
  const choose = name => bulkView.getByRole('checkbox', { name: '选择 ' + name, exact: true }).check();
  const action = name => bulkView.getByRole('button', { name, exact: true }).click();
  const modal = name => dialog.getByRole('button', { name, exact: true }).first().click();
  const kind = value => bulkView.locator('.bulk-filters select').nth(0).selectOption(value);
  const goArchive = () => page.locator('nav [data-view="archived"]').click();
  try {
    await page.goto(url);
    await page.evaluate(({ fixture, dataKey }) => { localStorage.setItem(dataKey, JSON.stringify(fixture)); localStorage.setItem('weekflow-v2.4:language', 'zh-CN'); }, { fixture, dataKey });
    await page.reload();
    await page.locator('nav [data-view="timeline"]').click();
    await page.locator('#timeline-view [data-view="bulk"]').click();
    await choose('检查');
    await bulkView.locator('input[type="search"]').fill('交付');
    assert.match(await bulkView.locator('.bulk-action-bar strong').innerText(), /已选 0/);
    await bulkView.locator('input[type="search"]').fill('');
    await choose('检查');
    await action('批量修改');
    await dialog.locator('select').nth(0).selectOption('shift');
    await dialog.locator('input[type="number"]').fill('7');
    await dialog.locator('select').nth(1).selectOption('high');
    await dialog.locator('select').nth(2).selectOption('set');
    await dialog.locator('input[list]').fill('Amy');
    await modal('预览修改');
    assert.match(await dialog.innerText(), /2026-09-10 → 2026-09-17/);
    assert.equal((await stored()).tasks[0].ddl, '2026-09-10');
    await dialog.locator('input[type="number"]').fill('8');
    assert.equal(await dialog.getByRole('button', { name: '确认应用', exact: true }).isDisabled(), true);
    await modal('预览修改');
    await modal('确认应用');
    let saved = await stored();
    assert.equal(saved.tasks[0].ddl, '2026-09-18');
    assert.equal(saved.tasks[0].managedObject, 'Amy');
    assert.equal(saved.tasks[1].managedObject, 'Jack');
    await choose('检查');
    await action('批量归档');
    await modal('取消');
    assert.equal((await stored()).tasks[0].archivedAt, null);
    await action('批量归档'); await modal('确认应用');
    await kind('group'); await choose('项目 A');
    await action('批量归档');
    assert.match(await dialog.innerText(), /1 Group · 1 Flow · 1 Task/);
    await modal('确认应用');
    saved = await stored();
    assert.notEqual(saved.tasks[0].archiveBatchId, saved.tasks[1].archiveBatchId);
    await page.locator('nav [data-view="home"]').click();
    assert.equal(await page.locator('#home-task-total').innerText(), '1');
    await page.locator('nav [data-view="timeline"]').click();
    assert.equal(await page.locator('.task-row').count(), 1);
    await page.locator('nav [data-view="materials"]').click();
    assert.match(await page.locator('#materials-view').innerText(), /操作指南/);
    await goArchive();
    await kind('task');
    assert.equal(await bulkView.getByRole('checkbox', { name: '选择 检查', exact: true }).isDisabled(), true);
    await bulkView.getByRole('button', { name: '检查', exact: true }).click();
    assert.match(await dialog.innerText(), /初稿已完成/);
    assert.match(await dialog.innerText(), /交付报告/);
    await modal('关闭');
    await kind('group'); await choose('项目 A');
    await action('批量恢复'); await modal('确认应用');
    saved = await stored();
    assert.equal(saved.tasks[1].archivedAt, null);
    assert.ok(saved.tasks[0].archivedAt);
    await kind('task');
    assert.equal(await bulkView.locator('tbody tr').count(), 1);
    await page.screenshot({ path: '/tmp/weekflow-archived-zh.png', fullPage: true });
    await choose('检查'); await action('批量恢复'); await modal('确认应用');
    assert.equal((await stored()).tasks.filter(t => t.archivedAt).length, 0);
    await page.reload();
    assert.equal((await stored()).tasks[0].ddl, '2026-09-18');
    await page.locator('[data-language="en"]').click();
    await page.waitForLoadState('load');
    await page.locator('nav [data-view="timeline"]').click();
    await page.locator('#timeline-view [data-view="bulk"]').click();
    assert.match(await bulkView.innerText(), /Bulk Actions/);
    await bulkView.getByRole('checkbox', { name: 'Select All Results', exact: true }).check();
    assert.match(await bulkView.locator('.bulk-action-bar strong').innerText(), /Selected 3 \/ 3/);
    await page.screenshot({ path: '/tmp/weekflow-bulk-en.png', fullPage: true });
    // Exercise complete-replacement Excel import via the UI, including archive metadata.
    await kind('group');
    await bulkView.getByRole('checkbox', { name: 'Select All Results', exact: true }).check();
    await bulkView.getByRole('button', { name: 'Archive Selected', exact: true }).click();
    await dialog.getByRole('button', { name: 'Apply Changes', exact: true }).click();
    const beforeImport = await stored();
    const bytes = await page.evaluate(async () => Array.from(new Uint8Array(await App.excelImport.buildXlsxPackage(App.storage.load(), JSZip, 'arraybuffer', { language: 'en' }))));
    await page.locator('#excel-file-input').setInputFiles({ name: 'archived.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(bytes) });
    await page.locator('#excel-import-dialog').waitFor({ state: 'visible' });
    await page.locator('input[name="excel-import-mode"][value="replace"]').check();
    await page.locator('#excel-import-confirm').click();
    await page.locator('#excel-import-dialog').waitFor({ state: 'hidden' });
    const afterImport = await stored();
    assert.deepEqual(afterImport.tasks.map(t => [t.id, t.archivedAt, t.archiveBatchId]), beforeImport.tasks.map(t => [t.id, t.archivedAt, t.archiveBatchId]));
    assert.deepEqual(afterImport.groups.map(g => [g.id, g.archivedAt, g.archiveBatchId]), beforeImport.groups.map(g => [g.id, g.archivedAt, g.archiveBatchId]));
    assert.deepEqual(afterImport.flows.map(f => [f.id, f.archivedAt, f.archiveBatchId]), beforeImport.flows.map(f => [f.id, f.archivedAt, f.archiveBatchId]));
    assert.equal(afterImport.materials[0].taskIds[0], 't1');
    assert.deepEqual(errors, []);
    console.log('PASS: bulk preview/apply/cancel, selection reset, archive hierarchy/restore, active stats, document and progress retention, reload, Chinese/English, Excel replace round-trip; no page errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
