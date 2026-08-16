'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const workspaceRoot = path.resolve(__dirname, '..');
const htmlPath = path.join(workspaceRoot, 'architecture', 'software-public-architecture.html');
const artifactDir = path.join(workspaceRoot, 'artifacts', 'architecture');
const screenshotPath = path.join(artifactDir, 'software-public-architecture.png');
const executablePath = process.env.ARCH_BROWSER;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  fs.mkdirSync(artifactDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const pageErrors = [];
  const externalRequests = [];

  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('request', request => {
    if (/^https?:/i.test(request.url())) externalRequests.push(request.url());
  });

  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
  await page.locator('html[data-ready="true"]').waitFor();

  assert(await page.locator('[data-view="overview"]').isVisible(), 'Overview is not the default visible view.');
  assert(!(await page.locator('[data-view="platform"]').isVisible()), 'Platform view should be hidden by default.');
  assert(await page.locator('[data-node].is-muted').count() === 0, 'Overview should not mute any folder before the user selects one.');
  assert(await page.locator('[data-node="app-system-lifecycle"]').count() === 1, 'System lifecycle application is missing.');
  assert(await page.locator('[data-node="app-gui-lifecycle"]').count() === 1, 'F133 GUI lifecycle application is missing.');
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-view="overview"]')).opacity) > 0.99, null, { timeout: 3000 });

  const readNodeGeometry = () => page.evaluate(() => Object.fromEntries(
    Array.from(document.querySelectorAll('[data-node]'), node => {
      const rect = node.getBoundingClientRect();
      return [node.dataset.node, { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height }];
    })
  ));
  const assertStableGeometry = (before, after, filterName) => {
    for (const nodeId of Object.keys(before)) {
      const a = before[nodeId];
      const b = after[nodeId];
      assert(Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5,
        `${filterName} filter moved ${nodeId}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
    }
  };

  const baselineGeometry = await readNodeGeometry();
  await page.locator('[data-filter="zephyr"]').click();
  assertStableGeometry(baselineGeometry, await readNodeGeometry(), 'Zephyr');
  assert(await page.locator('[data-node="gui-lvgl"]').isVisible(), 'Zephyr filter removed the LVGL card instead of keeping its position.');
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-node="gui-lvgl"]')).opacity) < 0.4, null, { timeout: 1000 });
  assert(Number(await page.locator('[data-node="gui-lvgl"]').evaluate(node => getComputedStyle(node).opacity)) < 0.4, 'Zephyr filter did not visually de-emphasize the LVGL card.');
  assert(Number(await page.locator('[data-node="component-sensor-hub"]').evaluate(node => getComputedStyle(node).opacity)) > 0.8, 'Zephyr filter de-emphasized a public component.');

  await page.locator('[data-filter="melis"]').click();
  assertStableGeometry(baselineGeometry, await readNodeGeometry(), 'Melis');
  assert(await page.locator('[data-node="adapter-zephyr"]').isVisible(), 'Melis filter removed the Zephyr adapter instead of keeping its position.');
  assert(Number(await page.locator('[data-node="component-power"]').evaluate(node => getComputedStyle(node).opacity)) > 0.8, 'Melis filter did not retain the shared power component.');
  assert(Number(await page.locator('[data-node="component-sensor-hub"]').evaluate(node => getComputedStyle(node).opacity)) > 0.8, 'Melis filter de-emphasized a public component that is portable but not selected by EB500-GUI.');
  await page.locator('[data-filter="all"]').click();

  await page.locator('[data-product-filter="eb500-gui"]').click();
  assertStableGeometry(baselineGeometry, await readNodeGeometry(), 'EB500-GUI');
  assert(Number(await page.locator('[data-node="component-power"]').evaluate(node => getComputedStyle(node).opacity)) > 0.8, 'EB500-GUI did not select the shared power component.');
  assert(Number(await page.locator('[data-node="app-gui-lifecycle"]').evaluate(node => getComputedStyle(node).opacity)) > 0.8, 'EB500-GUI did not select gui_lifecycle.');
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-node="component-sensor-hub"]')).opacity) < 0.4, null, { timeout: 1000 });
  assert(Number(await page.locator('[data-node="component-sensor-hub"]').evaluate(node => getComputedStyle(node).opacity)) < 0.4, 'EB500-GUI did not de-emphasize sensor_hub.');

  await page.locator('[data-product-filter="eb100"]').click();
  assertStableGeometry(baselineGeometry, await readNodeGeometry(), 'EB100');
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-node="app-system-lifecycle"]')).opacity) > 0.8, null, { timeout: 1000 });
  assert(Number(await page.locator('[data-node="app-system-lifecycle"]').evaluate(node => getComputedStyle(node).opacity)) > 0.8, 'EB100 did not select system_lifecycle.');
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-node="app-gui-lifecycle"]')).opacity) < 0.4, null, { timeout: 1000 });
  assert(Number(await page.locator('[data-node="app-gui-lifecycle"]').evaluate(node => getComputedStyle(node).opacity)) < 0.4, 'EB100 did not de-emphasize gui_lifecycle.');
  await page.locator('[data-product-filter="all-products"]').click();

  await page.locator('[data-target="platform"]').click();
  assert(await page.locator('[data-view="platform"]').isVisible(), 'Platform view did not activate.');
  assert((await page.locator('[data-view="platform"]').textContent()).includes('ports/*.h'), 'Platform contracts are missing.');
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-view="platform"]')).opacity) > 0.99, null, { timeout: 3000 });
  const platformOpacity = await page.locator('[data-view="platform"]').evaluate(element => getComputedStyle(element).opacity);
  assert(Number(platformOpacity) > 0.99, `Platform view did not finish its entrance animation; opacity=${platformOpacity}.`);
  await page.screenshot({ path: path.join(artifactDir, 'software-public-architecture-platform.png'), fullPage: true });

  await page.locator('[data-target="flows"]').click();
  assert(await page.locator('[data-view="flows"]').isVisible(), 'Business flow view did not activate.');
  await page.waitForTimeout(450);
  await page.locator('[data-flow-target="assist"]').click();
  assert(await page.locator('[data-flow="assist"]').isVisible(), 'Assist flow did not activate.');
  assert((await page.locator('[data-flow="assist"]').textContent()).includes('F133 Host → RT1046'), 'EB500 action round-trip is missing.');
  await page.screenshot({ path: path.join(artifactDir, 'software-public-architecture-flows.png'), fullPage: true });
  await page.locator('[data-flow-target="power"]').click();
  assert(await page.locator('[data-flow="power"]').isVisible(), 'Power coordination flow did not activate.');
  assert((await page.locator('[data-flow="power"]').textContent()).includes('READY_FOR_POWER_CUT'), 'Power coordination contract is incomplete.');
  await page.screenshot({ path: path.join(artifactDir, 'software-public-architecture-power.png'), fullPage: true });

  await page.locator('[data-target="interfaces"]').click();
  assert(await page.locator('[data-view="interfaces"]').isVisible(), 'Interface trace view did not activate.');
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-view="interfaces"]')).opacity) > 0.99, null, { timeout: 3000 });

  for (const traceName of ['build', 'thread', 'trigger', 'read']) {
    await page.locator(`[data-trace-target="${traceName}"]`).click();
    assert(await page.locator(`[data-interface-trace="${traceName}"]`).isVisible(), `${traceName} interface trace did not activate.`);
  }

  const readTraceText = await page.locator('[data-interface-trace="read"]').textContent();
  for (const functionName of ['imu_device_read_batch', 'sensor_sample_fetch', 'z_impl_sensor_sample_fetch', 'bmi160_sample_fetch', 'spi_transceive_dt', 'spi_mcux_transceive', 'sensor_channel_get', 'motion_fusion_push']) {
    assert(readTraceText.includes(functionName), `Read trace is missing ${functionName}.`);
  }

  const readInterfaceGeometry = () => page.evaluate(() => Object.fromEntries(
    Array.from(document.querySelectorAll('[data-interface-node]'), node => {
      const rect = node.getBoundingClientRect();
      return [node.dataset.interfaceNode, { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height }];
    })
  ));

  const zephyrInterfaceGeometry = await readInterfaceGeometry();
  await page.locator('[data-interface-platform="melis"]').click();
  await page.waitForTimeout(250);
  assertStableGeometry(zephyrInterfaceGeometry, await readInterfaceGeometry(), 'Interface Melis');
  assert(Number(await page.locator('[data-interface-node="public-imu-port"]').evaluate(node => getComputedStyle(node).opacity)) > 0.8, 'Melis interface selection de-emphasized the public IMU port.');
  assert(Number(await page.locator('[data-interface-node="zephyr-sensor-api"]').evaluate(node => getComputedStyle(node).opacity)) < 0.4, 'Melis interface selection did not de-emphasize the Zephyr Sensor API.');
  assert(Number(await page.locator('[data-interface-node="melis-sensor-api"]').evaluate(node => getComputedStyle(node).opacity)) > 0.8, 'Melis interface selection did not emphasize the Melis SDK boundary.');
  await page.locator('[data-interface-platform="zephyr"]').click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(artifactDir, 'software-public-architecture-interfaces.png'), fullPage: true });

  await page.locator('[data-target="overview"]').click();
  await page.locator('[data-filter="public"]').click();
  assert(await page.locator('[data-node].is-filtered').count() > 0, 'Public filter did not hide non-public nodes.');
  assert(await page.locator('[data-node]:not(.is-filtered)').count() > 0, 'Public filter hid every node.');

  await page.locator('[data-filter="all"]').click();
  await page.locator('[data-node="app-system-lifecycle"]').click();
  assert((await page.locator('#node-detail').textContent()).includes('整机'), 'Node detail did not describe the whole-system lifecycle role.');
  assert(await page.locator('[data-node].is-related').count() > 0, 'Selecting a node did not highlight dependencies.');
  await page.locator('[data-node="app-system-lifecycle"]').click();
  assert(await page.locator('[data-node].is-muted').count() === 0, 'Clicking the selected node again did not clear dependency highlighting.');
  await page.waitForTimeout(250);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert(!overflow, 'Unexpected page-level horizontal overflow at 1600px.');
  assert(pageErrors.length === 0, `Browser errors: ${pageErrors.join(' | ')}`);
  assert(externalRequests.length === 0, `External requests detected: ${externalRequests.join(' | ')}`);

  await page.screenshot({ path: screenshotPath, fullPage: true });
  await browser.close();

  console.log(`SCREENSHOT=${screenshotPath}`);
  console.log('ARCHITECTURE_HTML_UI=PASS');
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
