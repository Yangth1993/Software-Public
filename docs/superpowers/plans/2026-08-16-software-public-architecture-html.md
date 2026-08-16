# Software Public Architecture HTML Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a polished, offline, single-file HTML architecture explorer for the EB100/EB400/EB500 public software architecture.

**Architecture:** One self-contained HTML file holds semantic markup, scoped CSS, the architecture data model, and small vanilla-JavaScript view controllers. A PowerShell contract test validates required content and offline constraints; a Playwright test opens the file in desktop Edge/Chrome and verifies tab switching, filtering, card selection, details, and layout overflow.

**Tech Stack:** HTML5, CSS Grid/SVG, vanilla JavaScript, PowerShell 7, Node.js, Playwright, local Microsoft Edge or Google Chrome.

## Global Constraints

- Output is a single HTML file that works offline with no CDN, external font, image, stylesheet, or JavaScript dependency.
- Default view is “总体分层”; additional views are “平台对接” and “业务走查”.
- Use green for public code, blue for platform adapters, orange for GUI-specific code, gray for BSP/hardware, and dashed styling for reserved interfaces.
- Public C interfaces must not expose Zephyr, Melis, Embedded Wizard, or LVGL private types.
- The page must show EB100/EB400 single-chip deployment and EB500 RT1046/F133 split deployment.
- IMU 1 kHz raw samples stay on RT1172/RT1046 and do not cross USB.
- RT1046 is the EB500 authoritative state owner; F133 is the internal USB Host.
- Upgrade is shown only as interface/module locations for RT1046 firmware, F133 Melis/application, and GUI resources.
- The current workspace is not a Git repository; do not initialize one or add commit steps that would imply a commit occurred.

---

## File Map

- Create `architecture/software-public-architecture.html`: the complete offline architecture explorer.
- Create `tests/architecture-html-contract.ps1`: static contract and offline-dependency checks.
- Create `tests/architecture-html-ui.cjs`: browser interaction and layout checks using the bundled Node Playwright package (the bundled Python runtime does not include Playwright).
- Create `artifacts/architecture/software-public-architecture.png`: generated desktop preview used for visual inspection.
- Modify `progress.md`: record implementation and verification evidence.

### Task 1: Static Architecture Contract

**Files:**
- Create: `tests/architecture-html-contract.ps1`
- Test: `tests/architecture-html-contract.ps1`

**Interfaces:**
- Consumes: `architecture/software-public-architecture.html` at the workspace root.
- Produces: process exit code `0` and `ARCHITECTURE_HTML_CONTRACT=PASS` when all content/offline checks pass.

- [x] **Step 1: Write the failing contract test**

```powershell
$htmlPath = Join-Path $PSScriptRoot '..\architecture\software-public-architecture.html'
if (-not (Test-Path -LiteralPath $htmlPath)) {
    throw "Missing architecture HTML: $htmlPath"
}
$html = Get-Content -LiteralPath $htmlPath -Raw -Encoding UTF8
$required = @(
    'data-view="overview"', 'data-view="platform"', 'data-view="flows"',
    '共享应用层', '公共组件层', '公共接口层',
    'products/eb100', 'products/eb500_rt', 'app/viewmodel',
    'adapters/zephyr', 'adapters/melis',
    'app_action_dispatch', 'transport_send',
    '1 kHz', 'F133 · USB Host', 'RT1046 · 权威状态',
    '助力参数设置', '@media print', 'prefers-reduced-motion'
)
foreach ($needle in $required) {
    if (-not $html.Contains($needle)) { throw "Missing required content: $needle" }
}
if ($html -match '(?i)<(?:script|link|img)[^>]+(?:src|href)\s*=\s*["'']https?://') {
    throw 'External runtime dependency detected.'
}
Write-Output 'ARCHITECTURE_HTML_CONTRACT=PASS'
```

- [x] **Step 2: Run the contract test and verify failure**

Run:

```powershell
pwsh -NoProfile -File tests/architecture-html-contract.ps1
```

Expected: non-zero exit with `Missing architecture HTML`.

- [x] **Step 3: Keep the failing test for Task 2**

Do not weaken required strings or offline checks to make the test pass. The implementation must satisfy this contract.

### Task 2: Offline Multi-view Architecture Explorer

**Files:**
- Create: `architecture/software-public-architecture.html`
- Test: `tests/architecture-html-contract.ps1`

**Interfaces:**
- Consumes: the folder/layer and flow definitions in `docs/superpowers/specs/2026-08-16-software-public-architecture-html-design.md`.
- Produces: tab buttons using `data-target="overview|platform|flows"`, view panels using `data-view`, filter buttons using `data-filter`, architecture cards using `data-node`, and a details panel with `id="node-detail"`.

- [x] **Step 1: Implement semantic page structure and visual tokens**

Use this exact top-level structure:

```html
<body>
  <header class="hero">...</header>
  <nav class="view-tabs" aria-label="架构视图">...</nav>
  <main>
    <section class="view is-active" data-view="overview">...</section>
    <section class="view" data-view="platform" hidden>...</section>
    <section class="view" data-view="flows" hidden>...</section>
  </main>
  <script>/* embedded data and controllers */</script>
</body>
```

Define CSS variables `--public`, `--platform`, `--gui`, `--hardware`, `--reserved`, `--ink`, and `--surface`. Include a blueprint grid background, focus-visible states, a `@media print` landscape layout, and a `prefers-reduced-motion` override.

- [x] **Step 2: Implement the overview layer/folder model**

Represent each folder card as a semantic button with fields equivalent to:

```js
{
  id: 'app-state',
  path: 'app/state',
  layer: '共享应用层',
  kind: 'public',
  targets: ['EB100', 'EB400', 'EB500 · RT'],
  rule: '主状态权威源；不得依赖 GUI 或 RTOS 私有类型',
  upstream: ['app-actions', 'components-vehicle'],
  downstream: ['app-viewmodel', 'ports-transport']
}
```

Render seven labeled layer rows, folder cards, target chips, filters, a legend, and a details panel. Selecting a card must add `.is-related` to direct dependencies and `.is-muted` to unrelated cards.

- [x] **Step 3: Implement the platform contract view**

Render Zephyr/EW adapters on the left, public C contracts in the center, and Melis/LVGL adapters on the right. Include visible signatures for:

```c
int app_action_dispatch(const app_action_t *action);
int app_state_snapshot(app_state_snapshot_t *out);
int storage_write(storage_key_t key, const void *data, size_t size);
int transport_send(transport_channel_t channel, const void *data, size_t size);
```

Show the internal USB boundary as `F133 · USB Host` connected to `RT1046 · 权威状态`, and show upgrade interface locations with dashed borders.

- [x] **Step 4: Implement the business walkthrough view**

Create two selectable flow panels:

```js
const flows = {
  imu: ['IMU Driver / DMA', '1 kHz Acquisition', 'Filter / Fusion', 'Domain State', '降频 ViewModel', 'EW 或 USB State Sync → LVGL'],
  assist: ['GUI 输入', 'shared Action', 'Action Proxy（仅 EB500）', 'RT1046 Action Handler', '校验与权威状态', 'Flash / CAN', '状态回传与 ViewModel']
};
```

Use arrows and numbered steps. Explicitly state that GUI 30 fps consumption cannot block 1 kHz acquisition. Show EB100/EB400 local action execution and EB500 USB round-trip as separate lanes.

- [x] **Step 5: Implement vanilla-JavaScript controllers**

Provide these functions with matching names and roles:

```js
function activateView(viewName) { /* update tabs, hidden state, and hash */ }
function applyFilter(filterName) { /* show matching overview cards */ }
function selectNode(nodeId) { /* dependency highlight and detail content */ }
function activateFlow(flowName) { /* switch business walkthrough */ }
```

Initialize from `location.hash` when it matches a view, otherwise activate `overview`. Support keyboard activation through native buttons and set `aria-selected` correctly.

- [x] **Step 6: Run the contract test**

Run:

```powershell
pwsh -NoProfile -File tests/architecture-html-contract.ps1
```

Expected: `ARCHITECTURE_HTML_CONTRACT=PASS`.

### Task 3: Browser Interaction and Visual Verification

**Files:**
- Create: `tests/architecture-html-ui.cjs`
- Create: `artifacts/architecture/software-public-architecture.png`
- Modify: `architecture/software-public-architecture.html` only if a browser test or visual inspection exposes an issue.

**Interfaces:**
- Consumes: `data-target`, `data-view`, `data-filter`, `data-node`, and `#node-detail` from Task 2.
- Produces: process exit code `0`, `ARCHITECTURE_HTML_UI=PASS`, and a 1600×1000 PNG preview.

- [x] **Step 1: Write the browser test**

```js
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const executablePath = process.env.ARCH_BROWSER;
const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(root, 'architecture/software-public-architecture.html')).href);
await page.locator('[data-target="platform"]').click();
if (!(await page.locator('[data-view="platform"]').isVisible())) throw new Error('Platform view did not activate');
await page.locator('[data-target="overview"]').click();
await page.locator('[data-filter="public"]').click();
if (await page.locator('[data-node].is-filtered').count() === 0) throw new Error('Filter did not hide any nodes');
await page.locator('[data-node="app-state"]').click();
if (!(await page.locator('#node-detail').textContent()).includes('主状态')) throw new Error('Node detail did not update');
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
if (overflow) throw new Error('Unexpected page-level horizontal overflow');
await page.screenshot({ path: path.join(root, 'artifacts/architecture/software-public-architecture.png'), fullPage: true });
await browser.close();
console.log('ARCHITECTURE_HTML_UI=PASS');
```

- [x] **Step 2: Run browser verification**

Run:

```powershell
$env:ARCH_BROWSER='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
node tests/architecture-html-ui.cjs
```

Expected: `ARCHITECTURE_HTML_UI=PASS` and the PNG preview exists.

- [x] **Step 3: Inspect the preview**

Open `artifacts/architecture/software-public-architecture.png` with the image viewer. Verify that the seven layers are distinguishable, Chinese labels are not clipped, target badges remain readable, and the first viewport communicates the public/platform/GUI boundaries without scrolling.

- [x] **Step 4: Run final verification**

Run both tests again. Expected output:

```text
ARCHITECTURE_HTML_CONTRACT=PASS
ARCHITECTURE_HTML_UI=PASS
```

- [x] **Step 5: Record evidence**

Append exact output paths and test results to `progress.md`, without claiming firmware build, hardware validation, or final architecture approval.
