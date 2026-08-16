# Software Public

面向 EB100、EB400、EB500 电助力自行车智能码表的嵌入式 GUI 公版软件架构研究。

当前目标是在 Zephyr 与 Melis 两套底层平台之上，共用一套以 C 为主的业务状态、领域模型、Action、Service、ViewModel 和公共组件。第一阶段允许 Embedded Wizard 与 LVGL 分别实现 GUI View。

## 架构图

下载后用浏览器打开 [`architecture/software-public-architecture.html`](architecture/software-public-architecture.html)。这是一个不依赖 CDN 或外部脚本的离线单文件页面，包含：

- 总体分层与建议目录；
- 公共 C 接口到 Zephyr、Melis、Embedded Wizard、LVGL 的适配关系；
- IMU 实时数据链和助力参数设置业务走查；
- 从公版 `imu_device` 到 Zephyr Sensor、BMI160、SPI 和 NXP LPSPI 的逐函数接口落位；
- EB100/EB400 单芯片部署与 EB500 RT1046/F133 双芯片部署。

## 当前架构边界

- RT1172/RT1046 保存主状态和关键参数，承担最高 1 kHz 的实时采集与运算。
- F133 是 EB500 内接 USB Host，承担 LVGL GUI、Wi-Fi、大文件、语音输出和 eMMC 资源。
- 1 kHz IMU 原始数据不发送到 F133；GUI 消费降频后的 ViewModel 快照。
- 公共业务层不得依赖 Zephyr、Melis、Embedded Wizard 或 LVGL 私有类型。
- 产品差异优先通过能力配置和装配清单表达，避免业务代码中散布项目宏。
- 升级仅预留 RT1046 固件、F133 Melis/应用和 GUI 资源的模块及接口位置。

## 文档

- [架构设计说明](docs/superpowers/specs/2026-08-16-software-public-architecture-html-design.md)
- [HTML 实施计划](docs/superpowers/plans/2026-08-16-software-public-architecture-html.md)
- [IMU 接口落位设计](docs/superpowers/specs/2026-08-16-imu-interface-trace-view-design.md)
- [芯片与平台资料索引](reference/README.md)

## 验证

```powershell
npm install
npx playwright install chromium
npm run test:contract
npm run test:ui
```

如需使用本机浏览器而不是 Playwright 下载的 Chromium，可将 `ARCH_BROWSER` 设置为浏览器可执行文件路径。浏览器测试验证四个视图、平台筛选位置稳定性、依赖高亮、业务流程、接口调用链、外部网络请求和桌面布局。

## 第三方资料边界

本公开仓库不重复托管 Zephyr/Melis SDK，也不包含标记为“秘密”、`Confidential`、许可证不明或需要厂商授权的资料。对应版本、官方入口和缺口记录在 `reference/` 中。量产项目必须使用项目方从芯片厂商或方案商取得的完整授权 SDK。

当前内容是架构讨论初版，不代表目录冻结、固件构建通过或硬件验证完成。
