$ErrorActionPreference = 'Stop'

$htmlPath = Join-Path $PSScriptRoot '..\architecture\software-public-architecture.html'

if (-not (Test-Path -LiteralPath $htmlPath)) {
    throw "Missing architecture HTML: $htmlPath"
}

$html = Get-Content -LiteralPath $htmlPath -Raw -Encoding UTF8
$required = @(
    'data-view="overview"',
    'data-view="platform"',
    'data-view="flows"',
    'data-target="interfaces"',
    'data-view="interfaces"',
    'data-trace-target="build"',
    'data-trace-target="thread"',
    'data-trace-target="trigger"',
    'data-trace-target="read"',
    'data-interface-platform="zephyr"',
    'data-interface-platform="melis"',
    'data-product-filter="eb100"',
    'data-product-filter="eb400"',
    'data-product-filter="eb500-rt"',
    'data-product-filter="eb500-gui"',
    '共享应用层',
    '公共组件层',
    '公共接口层',
    'products/eb100',
    'products/eb500_rt',
    'app/viewmodel',
    'app/system_lifecycle',
    'app/gui_lifecycle',
    'app/ride',
    'app/vehicle',
    'app/settings',
    'components/sensor_hub',
    'components/motion_fusion',
    'components/power',
    'components/state_sync',
    'imu_device_read_batch',
    'sensor_sample_fetch',
    'z_impl_sensor_sample_fetch',
    'dev-&gt;api-&gt;sample_fetch',
    'bmi160_sample_fetch',
    'sensor_channel_get',
    'spi_transceive_dt',
    'spi_mcux_transceive',
    'LPSPI_MasterTransferNonBlocking',
    'DEVICE_DT_INST_DEFINE',
    'bmi160_gpio_callback',
    'products/eb500_gui/product.conf',
    'adapters/zephyr',
    'adapters/melis',
    'app_action_dispatch',
    'transport_send',
    '1 kHz',
    'F133 · USB Host',
    'RT1046 · 权威状态',
    'power_contract',
    'system_power_sm',
    'gui_power_sm',
    'READY_FOR_POWER_CUT',
    'data-flow="power"',
    '助力参数设置',
    '@media print',
    'prefers-reduced-motion'
)

foreach ($needle in $required) {
    if (-not $html.Contains($needle)) {
        throw "Missing required content: $needle"
    }
}

if ($html -match '(?i)<(?:script|link|img)[^>]+(?:src|href)\s*=\s*["'']https?://') {
    throw 'External runtime dependency detected.'
}

Write-Output 'ARCHITECTURE_HTML_CONTRACT=PASS'
