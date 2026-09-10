/* Run with Playwright available on NODE_PATH; uses a fresh browser context. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const storage = require('../../js/storage.js');
const url = process.env.WEEKFLOW_TEST_URL || 'http://127.0.0.1:8765/Weekflow.html';
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
  const board = page.locator('#timeline-board');
  const bar = page.locator('#timeline-selection-bar');
  let selectionKind = 'task';
  const enterSelection = async () => {
    if (await page.locator('#timeline-selection-toggle').getAttribute('aria-pressed') === 'false') {
      await page.locator('#timeline-selection-toggle').click();
    }
  };
  const choose = async name => {
    if (await bulkView.isVisible()) await bulkView.getByRole('checkbox', { name: '选择 ' + name, exact: true }).check();
    else { await enterSelection(); await board.getByRole('checkbox', { name: '复选 ' + selectionKind + ': ' + name, exact: true }).check(); }
  };
  const action = async name => (await bulkView.isVisible() ? bulkView : bar).getByRole('button', { name, exact: true }).click();
  const modal = name => dialog.getByRole('button', { name, exact: true }).first().click();
  const kind = async value => {
    selectionKind = value;
    if (await bulkView.isVisible()) await bulkView.locator('.bulk-filters select').nth(0).selectOption(value);
    else { await enterSelection(); await page.locator('#timeline-selection-kind').selectOption(value); }
  };
  const goArchive = () => page.locator('nav [data-view="archived"]').click();
  try {
    await page.goto(url);
    await page.evaluate(({ fixture, dataKey }) => { localStorage.setItem(dataKey, JSON.stringify(fixture)); localStorage.setItem('weekflow-v2.4:language', 'zh-CN'); }, { fixture, dataKey });
    await page.reload();
    await page.locator('nav [data-view="timeline"]').click();
    assert.equal(await bulkView.isVisible(), false);
    assert.equal(await bar.isVisible(), false);
    assert.equal(await board.locator('[data-timeline-select]').count(), 0);
    assert.equal(await board.locator('.complete-check:visible').count(), 3);
    await choose('检查');
    assert.equal(await board.locator('.complete-check:visible').count(), 0);
    await page.locator('#timeline-selection-toggle').click();
    assert.equal(await bar.isVisible(), false);
    assert.equal(await board.locator('.complete-check:visible').count(), 3);
    assert.equal((await stored()).tasks[0].status, 'pending');
    await choose('检查');
    assert.equal((await stored()).tasks[0].status, 'pending');
    assert.equal(await page.locator('#timeline-select-all').evaluate(el => el.indeterminate), true);
    await board.locator('.flow-row[data-flow-id="f1"] .collapse-button').click();
    assert.equal(await page.locator('#timeline-selection-count').innerText(), '已选 0');
    await page.locator('#timeline-select-all').check();
    assert.deepEqual(await board.locator('[data-timeline-select]:checked').evaluateAll(nodes => nodes.map(n => n.dataset.timelineSelect).sort()), ['t2', 't3']);
    await page.locator('#timeline-select-all').uncheck();
    await board.locator('.flow-row[data-flow-id="f1"] .collapse-button').click();
    await choose('检查');
    await page.locator('#filter-search').fill('验收');
    await page.waitForFunction(() => document.querySelector('#timeline-selection-count').textContent === '已选 0');
    await page.locator('#timeline-select-all').check();
    assert.deepEqual(await board.locator('[data-timeline-select]:checked').evaluateAll(nodes => nodes.map(n => n.dataset.timelineSelect)), ['t3']);
    await page.locator('#filter-search').fill('');
    await page.waitForFunction(() => document.querySelectorAll('[data-timeline-select]').length === 3);
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
    assert.equal(await bar.isVisible(), false);
    assert.equal(await board.locator('[data-timeline-select]').count(), 0);
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
    await kind('task');
    assert.match(await bar.innerText(), /Select Level/);
    assert.equal(await bar.getByRole('button', { name: 'Complete Selected', exact: true }).count(), 1);
    assert.equal(await bar.getByRole('button', { name: 'Delete Selected', exact: true }).count(), 1);
    await page.locator('#timeline-select-all').check();
    assert.equal(await page.locator('#timeline-selection-count').innerText(), 'Selected 3');
    await board.locator('.week-head[data-week="2026-09-11"]').dblclick();
    assert.equal(await page.locator('#timeline-heading').innerText(), 'Task by Day');
    assert.equal(await page.locator('#timeline-selection-count').innerText(), 'Selected 2');
    assert.deepEqual(await board.locator('[data-timeline-select]').evaluateAll(nodes => nodes.map(n => n.dataset.timelineSelect).sort()), ['t2', 't3']);
    await page.locator('#timeline-week-return').click();
    await page.locator('#timeline-select-all').check();
    assert.equal(await page.locator('#timeline-selection-count').innerText(), 'Selected 3');
    await page.screenshot({ path: '/tmp/weekflow-bulk-en.png', fullPage: true });
    // Exercise complete-replacement Excel import via the UI, including archive metadata.
    await kind('group');
    await page.locator('#timeline-select-all').check();
    await bar.getByRole('button', { name: 'Archive Selected', exact: true }).click();
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
    // Reset only this isolated context for completion/deletion and compact-dialog checks.
    await page.evaluate(({ fixture, dataKey }) => {
      localStorage.setItem(dataKey, JSON.stringify(fixture));
      localStorage.setItem('weekflow-v2.4:language', 'zh-CN');
    }, { fixture, dataKey });
    await page.reload();
    await page.locator('nav [data-view="timeline"]').click();
    await kind('task'); await choose('检查'); await choose('交付');
    await action('批量完成');
    assert.match(await dialog.innerText(), /2 Task/);
    assert.equal((await stored()).tasks[0].status, 'pending');
    await modal('取消');
    assert.equal((await stored()).tasks[0].status, 'pending');
    await action('批量完成'); await modal('确认完成');
    saved = await stored();
    assert.deepEqual(saved.tasks.map(t => t.status), ['completed', 'completed', 'pending']);
    assert.deepEqual(saved.tasks[0].progressEntries, fixture.tasks[0].progressEntries);
    assert.equal(await bar.isVisible(), false);
    await choose('检查'); await choose('交付');
    await action('批量删除');
    assert.equal(await dialog.getByRole('button', { name: '确认永久删除', exact: true }).isDisabled(), true);
    await modal('取消');
    assert.equal((await stored()).tasks.length, 3);
    await action('批量删除');
    await dialog.getByRole('checkbox', { name: '我确认永久删除上述记录', exact: true }).check();
    await modal('确认永久删除');
    saved = await stored();
    assert.deepEqual(saved.tasks.map(t => t.id), ['t3']);
    assert.equal(saved.materials[0].title, fixture.materials[0].title);
    assert.deepEqual(saved.materials[0].taskIds, []);
    assert.deepEqual(saved.materials[0].flowIds, ['f1']);
    await page.reload();
    assert.equal((await stored()).tasks.length, 1);

    const manyTasks = structuredClone(fixture);
    manyTasks.tasks = Array.from({ length: 100 }, (_, i) => ({ ...structuredClone(fixture.tasks[1]), id: 'long-' + i, name: '任务 ' + i + '：确认弹窗滚动和按钮可见' }));
    manyTasks.materials = [];
    await page.evaluate(({ manyTasks, dataKey }) => localStorage.setItem(dataKey, JSON.stringify(manyTasks)), { manyTasks, dataKey });
    await page.reload();
    await page.locator('nav [data-view="timeline"]').click();
    await kind('group'); await choose('项目 A');
    const assertLayout = async () => {
      const layout = await dialog.evaluate(d => {
        const rect = n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; };
        const body = d.querySelector('.bulk-dialog-body');
        return { viewport: { w: innerWidth, h: innerHeight }, dialog: rect(d),
          heading: rect(d.querySelector('h2')), footer: rect(d.querySelector('.modal-actions')),
          inputs: Array.from(d.querySelectorAll('input,select')).map(rect),
          scrollable: body.scrollHeight > body.clientHeight, bodyWidth: body.clientWidth, bodyScrollWidth: body.scrollWidth };
      });
      assert.ok(layout.dialog.x >= 0 && layout.dialog.y >= 0, JSON.stringify(layout));
      assert.ok(layout.dialog.right <= layout.viewport.w && layout.dialog.bottom <= layout.viewport.h, JSON.stringify(layout));
      assert.ok(layout.heading.x >= layout.dialog.x + 14, JSON.stringify(layout));
      assert.ok(layout.footer.bottom <= layout.viewport.h - 8, JSON.stringify(layout));
      assert.ok(layout.bodyScrollWidth <= layout.bodyWidth + 1, JSON.stringify(layout));
      for (const input of layout.inputs) assert.ok(input.x >= layout.dialog.x && input.right <= layout.dialog.right, JSON.stringify(layout));
      return layout;
    };
    await action('批量修改');
    await dialog.locator('select').nth(1).selectOption('high');
    await modal('预览修改');
    assert.equal(await dialog.locator('.bulk-preview-table tr').count(), 100);
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1000, height: 384 }, { width: 960, height: 540 }, { width: 390, height: 600 }]) {
      await page.setViewportSize(viewport);
      assert.equal((await assertLayout()).scrollable, true);
      await dialog.locator('.bulk-dialog-body').evaluate(n => { n.scrollTop = n.scrollHeight; });
      await assertLayout();
    }
    await page.setViewportSize({ width: 1000, height: 384 });
    await dialog.locator('.bulk-dialog-body').evaluate(n => { n.scrollTop = 0; });
    await page.screenshot({ path: '/tmp/weekflow-bulk-dialog-fixed.png' });
    await modal('取消');
    await action('批量删除');
    for (const viewport of [{ width: 1000, height: 384 }, { width: 390, height: 600 }]) {
      await page.setViewportSize(viewport);
      assert.equal((await assertLayout()).scrollable, true);
    }
    await modal('取消');
    assert.equal((await stored()).tasks.length, 100);
    console.log('PASS: bulk completion and deletion, cancel/confirmation/persistence, document preservation, 100-row previews with visible footers at desktop, short and mobile viewports.');
    assert.deepEqual(errors, []);
    console.log('PASS: mutually exclusive completion/selection modes, mode exit preserves completion, auto-exit after applying, direct board checkboxes, completion independence, collapsed/filtered selection scope, bulk preview/apply/cancel, selection reset, archive hierarchy/restore, active stats, document and progress retention, reload, Chinese/English, Excel replace round-trip; no page errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
