# IMU Interface Trace View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `VIEW 04 / 接口落位` to the offline architecture HTML and make the Zephyr 3.1 Sensor-to-SPI call chain traceable by file, layer, and function.

**Architecture:** Keep the existing single-file HTML and interaction patterns. Add one top-level view containing four runtime/build traces plus a fixed layer/file matrix; trace selection changes content emphasis without moving cards, and Zephyr/Melis platform selection preserves public-node geometry.

**Tech Stack:** Offline HTML/CSS/JavaScript, PowerShell contract test, Playwright browser test with Microsoft Edge.

## Global Constraints

- Do not add CDN, network fonts, external JavaScript, or runtime network requests.
- Treat BMI160 as a concrete Zephyr 3.1 source example, not the final product IMU selection.
- Do not invent concrete Melis Sensor/SPI function names without the formal SDK.
- Keep `sensor_hub`, `imu_device.h`, and `motion_fusion` independent of Zephyr types.
- Show that the stock BMI160 burst-read example does not itself prove the 1 kHz FIFO requirement.
- Preserve card coordinates when switching trace or platform selections.

---

### Task 1: Contract for the fourth view

**Files:**
- Modify: `tests/architecture-html-contract.ps1`
- Modify: `tests/architecture-html-ui.cjs`

**Interfaces:**
- Consumes: existing `[data-target]` tab and Playwright interaction conventions.
- Produces: required `data-view="interfaces"`, `data-trace-target`, `data-interface-platform`, and stable-geometry assertions.

- [x] **Step 1: Add failing static assertions**

Require these literal markers in the HTML contract test:

```powershell
'data-target="interfaces"'
'data-view="interfaces"'
'data-trace-target="read"'
'data-interface-platform="zephyr"'
'sensor_sample_fetch'
'z_impl_sensor_sample_fetch'
'dev-&gt;api-&gt;sample_fetch'
'bmi160_sample_fetch'
'spi_transceive_dt'
'spi_mcux_transceive'
'LPSPI_MasterTransferNonBlocking'
```

- [x] **Step 2: Run the static test and verify RED**

Run:

```powershell
pwsh -NoProfile -File tests\architecture-html-contract.ps1
```

Expected: FAIL with `Missing required content: data-target="interfaces"`.

- [x] **Step 3: Add browser assertions**

The UI test must activate the fourth view, switch `Build/Init`, `Thread Start`, `DRDY Trigger`, and `Read Sample`, assert the read trace contains `sensor_sample_fetch` through `spi_mcux_transceive`, and compare public-node geometry before/after Zephyr/Melis interface selection.

### Task 2: Implement the interface trace view

**Files:**
- Modify: `architecture/software-public-architecture.html`

**Interfaces:**
- Consumes: existing `.view-tab`, `.view`, `.flow-switch`, code-card, color-token, and `activateView()` patterns.
- Produces: `activateInterfaceTrace(traceName)` and `activateInterfacePlatform(platformName)`.

- [x] **Step 1: Add the fourth fixed tab and view shell**

Add `VIEW 04 / 接口落位` with `data-target="interfaces"`, and add `interfaces` to the `activateView()` allow-list and initial hash handling.

- [x] **Step 2: Add four trace panels**

Implement panels for:

```text
build   : product.conf -> DTS -> DEVICE_DT_INST_DEFINE -> bmi160_init -> bmi160_api
thread  : main.c -> app_runtime_start -> sensor_hub_start -> os_thread_create -> k_thread_create
trigger : DRDY -> bmi160_gpio_callback -> trigger handler -> sample_ready -> sensor_hub_worker
read    : imu_device_read_batch -> sensor_sample_fetch -> Sensor dev->api -> BMI160 -> SPI dev->api -> MCUX LPSPI -> sensor_channel_get -> motion_fusion_push
```

- [x] **Step 3: Add the layer/file responsibility matrix**

Show exact paths for public application/component/port, Zephyr adapter, Zephyr Sensor API, BMI160 driver, Zephyr SPI API, MCUX LPSPI driver, DTS/Kconfig, and hardware.

- [x] **Step 4: Add concise interface excerpts**

Show the public signatures:

```c
int imu_device_wait_data_ready(uint32_t timeout_us);
int imu_device_read_batch(imu_sample_t *samples,
                          size_t capacity,
                          size_t *sample_count);
```

and the adapter-only Zephyr calls:

```c
sensor_sample_fetch(imu_dev);
sensor_channel_get(imu_dev, SENSOR_CHAN_ACCEL_XYZ, accel);
sensor_channel_get(imu_dev, SENSOR_CHAN_GYRO_XYZ, gyro);
```

- [x] **Step 5: Add fixed-position Zephyr/Melis selection**

Zephyr shows the verified Sensor/SPI chain. Melis replaces only platform/API/driver descriptions with explicit formal-SDK placeholders while public cards remain in place.

- [x] **Step 6: Run static test and verify GREEN**

Expected: `ARCHITECTURE_HTML_CONTRACT=PASS`.

### Task 3: Browser verification and documentation

**Files:**
- Modify: `tests/architecture-html-ui.cjs`
- Modify: `docs/superpowers/specs/2026-08-16-software-public-architecture-html-design.md`
- Modify: `progress.md`
- Generate: `artifacts/architecture/software-public-architecture-interfaces.png`

**Interfaces:**
- Consumes: the fourth view and its two selection controls.
- Produces: reproducible interaction verification and screenshot evidence.

- [x] **Step 1: Run browser verification**

Run the existing Playwright test with bundled Node dependencies and Edge. Expected: `ARCHITECTURE_HTML_UI=PASS`, zero page errors, zero external requests, and no page-level overflow at 1600 px.

- [x] **Step 2: Inspect the screenshot**

Verify function names remain legible, call arrows do not overlap, and the fourth tab stays fixed relative to the first three.

- [x] **Step 3: Synchronize durable documentation**

Record the fourth view, the two `dev->api` dispatches, the BMI160 example boundary, and the unverified 1 kHz FIFO caveat in the main architecture design and progress log.

- [x] **Step 4: Final regression**

Re-run static and browser tests. Expected outputs:

```text
ARCHITECTURE_HTML_CONTRACT=PASS
ARCHITECTURE_HTML_UI=PASS
```

No commit step is included because `D:\MyProject\SoftwarePublic` is not currently a Git repository.
