# 嵌入式公版软件架构 HTML 初版设计

## 1. 目标与受众

输出一个离线可打开的单文件 HTML，用于软件架构、开发团队及跨部门评审。页面需要同时回答两个问题：

1. 公版代码位于哪些层、对应哪些建议目录，各项目如何装配。
2. 公共 C 接口如何向下适配 Zephyr/Melis，并通过具体业务说明公版代码如何工作。

第一版是架构讨论稿，不表示 USB 协议、线程优先级、升级流程或最终目录已经冻结。

## 2. 页面结构

页面采用单页四视图，通过顶部标签切换：

1. **总体分层**：目录、层级、公版属性、目标芯片和依赖边界。
2. **平台对接**：公共接口到 Zephyr、Melis、Embedded Wizard、LVGL 的适配关系。
3. **业务走查**：以 IMU 数据、助力参数设置和双芯片电源协作说明单芯片、双芯片的数据/动作流。
4. **接口落位**：用 Zephyr 3.1 BMI160 示例逐函数追踪公版 IMU HAL、Zephyr Sensor API、具体 Sensor Driver、Zephyr SPI API 与 NXP LPSPI Driver。

页面默认打开“总体分层”。所有内容内嵌在 HTML 中，不依赖 CDN、网络字体或外部 JavaScript 库。

## 3. 总体分层视图

### 3.1 七层结构

| 层级 | 建议目录 | 属性 | 主要职责 |
|---|---|---|---|
| 产品装配层 | `products/eb100`、`products/eb400`、`products/eb500_rt`、`products/eb500_gui` | 项目配置 | 通过 `product.conf` 选择功能、目标芯片、平台和装配清单 |
| GUI View 层 | `gui/embedded_wizard`、`gui/lvgl` | GUI 专用 | 页面、控件、触摸事件与框架生命周期 |
| 共享应用层 | `app/core`、`system_lifecycle`、`gui_lifecycle`、`ride`、`vehicle`、`settings`、`navigation`、`connectivity`、`data_export`、`diagnostics`、`viewmodel`、`update` | 公版核心 | 以业务域组织模型、状态机、动作、用例及 ViewModel |
| 公共组件层 | `components/sensor_hub`、`motion_fusion`、`positioning`、`environment`、`vehicle_bus`、`power`、`config_store`、`state_sync`、`logging`、`file_transfer`、`resource_manager`、`voice_player`、`update_endpoint` | 公版组件 | 平台无关、可独立测试的能力组件，产品按需选配 |
| 公共接口层 | `ports/storage.h`、`transport.h`、`time.h`、`device.h`、`event.h`、`power_device.h`、`gui_binding.h`、`update.h` | 稳定 C 契约 | 隔离 OS、驱动、GUI、升级对象和跨芯片通信差异 |
| 系统适配层 | `adapters/zephyr`、`adapters/melis`、`adapters/ew`、`adapters/lvgl` | 平台实现 | 实现公共接口，封装平台私有类型和 API |
| BSP/驱动/硬件层 | `boards`、`drivers`、Zephyr BSP、Melis BSP | 硬件专用 | 芯片、板级资源、外设驱动与启动配置 |

### 3.2 视觉和交互

- 左侧显示七层纵向标尺，中部显示目录卡片，右侧显示 EB100/EB400/EB500 适用标记。
- 绿色表示公版代码，蓝色表示平台适配，橙色表示 GUI 专用，灰色表示 BSP/硬件，虚线表示预留边界。
- 顶部使用两组正交筛选器：平台筛选支持“全部、公版、Zephyr、Melis、Embedded Wizard、LVGL”；产品筛选支持 EB100、EB400、EB500-RT、EB500-GUI。
- 平台筛选回答“公共接口由谁实现”，因此选择 Zephyr 或 Melis 时，全部共享应用、公共组件和公共接口仍保持高亮；产品筛选才回答“哪些模块编入该目标”。
- 两组筛选只改变透明度，不移除节点、不改变卡片坐标，便于直接比较差异。
- 点击目录卡片后，高亮其直接上下游，并在详情栏显示职责、编译目标及依赖规则。
- 页面明确标出两条禁止性规则：公共层不得引用 Zephyr/Melis 私有类型；公共业务层不得引用 Embedded Wizard/LVGL 对象。

## 4. 平台对接视图

该视图采用“公共契约在中间、平台实现在两侧”的结构：

```text
Zephyr / Embedded Wizard 适配  <-  ports/*.h  ->  Melis / LVGL 适配
```

中心展示六组接口契约：

- `storage_port`：关键参数、日志或资源存储访问。
- `transport_port`：本地消息或 RT1046—F133 USB 数据通道。
- `time_port`：单调时钟、时间戳和周期任务时间基准。
- `device_port`：传感器、CAN、蓝牙、4G、Wi-Fi 等设备能力。
- `event_port`：组件间事件发布和订阅。
- `power_device_port`：平台低功耗、断电、唤醒源和准备结果。
- `gui_binding_port`：ViewModel 快照输出和 Action 输入，不暴露 GUI 框架对象。

接口示例使用小段 C 伪代码表达约束，不尝试在第一版定义完整头文件：

```c
int app_action_dispatch(const app_action_t *action);
int app_state_snapshot(app_state_snapshot_t *out);
int storage_write(storage_key_t key, const void *data, size_t size);
int transport_send(transport_channel_t channel, const void *data, size_t size);
```

EB500 的 USB 边界单独突出：F133 为 Host；RT1046 是主状态权威源；传输内容是带版本、序号和时间戳的状态/事件/动作契约，不传递指针、RTOS 句柄或 GUI 对象。

电源协作采用两套不同的应用状态机：`app/system_lifecycle/system_power_sm.c` 维护 RT1046 整机状态；`app/gui_lifecycle/gui_power_sm.c` 维护 F133 GUI 子系统状态。两者只通过 `components/power/power_contract.h` 的粗粒度阶段协作，包括 `PREPARE_SLEEP`、`READY_FOR_SLEEP`、`PREPARE_SHUTDOWN`、`READY_FOR_POWER_CUT` 和 `FAILED`，不要求内部状态一一对应。平台动作分别由 `adapters/zephyr/power_device.c` 和 `adapters/melis/power_device.c` 实现。

升级仅在 `app/update`、`components/update_endpoint` 和 `ports/update.h` 显示三类接口位置：RT1046 固件、F133 Melis/应用、GUI 资源。第一版不展开升级状态机、回滚和断电保护。

## 5. 业务走查视图

### 5.1 IMU 实时数据链

```text
IMU Driver / DMA
  -> 1 kHz Acquisition
  -> Filter / Fusion
  -> Domain State
  -> 降频 ViewModel Snapshot
  -> Embedded Wizard 或 USB State Sync -> LVGL
```

图中明确：1 kHz 原始数据不送 F133；实时处理留在 RT1172/RT1046；GUI 以自身约 30 fps 节拍消费快照，GUI 卡顿不能反向阻塞采样链。

### 5.2 助力参数设置动作链

EB100/EB400 单芯片路径：

```text
EW View -> shared Action -> validation/service -> authoritative state
        -> RT1172/RT1046 Flash -> CAN command -> ViewModel refresh
```

EB500 双芯片路径：

```text
LVGL View -> shared Action definition -> F133 Action Proxy
          -> USB -> RT1046 Action Handler -> validation/service
          -> authoritative state -> RT1046 Flash / CAN
          -> result + state delta -> USB -> F133 State Mirror -> ViewModel -> LVGL
```

动作走查显示请求编号、执行结果和状态版本三个概念，用于说明跨芯片动作不会依赖函数远程调用假象。具体编码、端点和重试策略不在第一版确定。

### 5.3 双芯片电源协作

彻底关机示例中，RT1046 的整机状态机发送 `PREPARE_SHUTDOWN`；F133 的 GUI 子系统状态机停止新任务、收拢地图/语音/文件会话、刷新 eMMC 并关闭显示与网络资源，然后返回 `READY_FOR_POWER_CUT`。RT1046 汇总本地守卫与 F133 结果后执行最终断电。F133 可以返回 `RESOURCE_BUSY`/`FAILED`，但不自行宣告整机已关机。

### 5.4 预留能力

日志、功耗状态、蓝牙 OTA、F133 应用/GUI 资源升级以小型模块卡显示其位置和依赖方向，不展开流程，避免偏离首轮“应用层复用与换芯成本”目标。

## 6. 接口落位视图

该视图把“线程从哪里创建”和“IMU 怎样进入 Zephyr Sensor 接口”拆成四条可切换调用链：

1. `Build / Init`：`product.conf`、DTS、`DEVICE_DT_INST_DEFINE()`、`bmi160_init()` 和 `bmi160_api` 注册。
2. `Thread Start`：`main()`、`app_runtime_start()`、`sensor_hub_start()`、OSAL `os_thread_create()` 和 Zephyr `k_thread_create()`。
3. `DRDY Trigger`：IMU INT1、`bmi160_gpio_callback()`、驱动线程/work、adapter handler 和 `sensor_hub_worker()` 唤醒。
4. `Read Sample`：公共 `imu_device_read_batch()` 逐层调用到 Zephyr Sensor、BMI160、Zephyr SPI 和 MCUX LPSPI，再通过 `sensor_channel_get()` 返回公版 `imu_sample_t`。

核心读取链为：

```text
imu_device_read_batch()
  -> sensor_sample_fetch()
  -> z_impl_sensor_sample_fetch()
  -> dev->api->sample_fetch()
  -> bmi160_sample_fetch()
  -> bmi160_read_spi()
  -> spi_transceive_dt()
  -> spi_driver_api->transceive()
  -> spi_mcux_transceive()
  -> transceive_dma() 或 LPSPI_MasterTransferNonBlocking()
```

页面同时说明 `sensor_sample_fetch()` 更新驱动内部缓存，`sensor_channel_get()` 再通过 `dev->api->channel_get()` 调用 `bmi160_channel_get()`，最后由 `adapters/zephyr/device/imu_device.c` 把 `struct sensor_value` 转成公版 `imu_sample_t`。

BMI160 是 Zephyr 3.1 源码中的真实调用实例，不代表最终器件选型，也不证明其单次 burst read 已满足产品 1 kHz FIFO 指标。Melis 视图只表达与 Zephyr 相同的公版接口边界，正式 Sensor/Driver/SPI API 名称等待授权 SDK 落实。

## 7. EB100、EB400、EB500 部署表达

- EB100：RT1172 + Zephyr + Embedded Wizard；共享业务、组件、接口和 Zephyr 适配运行在单芯片。
- EB400：RT1046 + Zephyr + Embedded Wizard；与 EB100 共享上层，产品配置选择 SPI 小屏及功能裁剪。
- EB500 RT 侧：RT1046 + Zephyr；承载主状态、实时采集/运算、关键参数、车辆控制和动作执行。
- EB500 GUI 侧：F133 + Melis + LVGL；承载状态镜像、ViewModel、Action Proxy、页面、Wi-Fi、大资源、语音输出和 eMMC。

页面不把 EB500 画成两套独立业务系统，而是画成同一公版模型在两个部署角色中的切分。

## 8. 视觉方向

采用“嵌入式系统蓝图”风格：深海军蓝背景、细网格和电路走线质感，绿色突出可复用核心，电蓝表示平台接口，暖橙表示 GUI 差异。字体优先使用本机 `Bahnschrift`、`Microsoft YaHei` 和等宽字体回退，不下载网络资源。

交互保持克制：标签切换、筛选、高亮依赖、详情抽屉和图例说明。动效仅用于视图进入与连线高亮，并尊重 `prefers-reduced-motion`。

## 9. 错误语义与架构约束

- 公共 C 接口以显式返回值表达同步结果；异步动作通过结果事件与状态版本闭环。
- EB500 链路断开时，F133 将状态标为 stale/disconnected，不把本地缓存冒充 RT1046 权威状态。
- 车辆关键参数只由 RT1172/RT1046 持久化；F133 eMMC 保存地图、GUI/语音资源、大文件和非权威缓存。
- 产品差异优先由能力配置和装配清单表达，避免在共享业务代码中散布 `#if EBxxx`。

## 10. 第一版验收标准

- 单个 HTML 文件可离线打开，四个视图均可切换。
- 总体图能看出每个建议目录所在层级和公版属性。
- 能区分共享应用、共享组件、稳定接口、平台适配、GUI 和 BSP。
- 能看出 EB100/EB400 单芯片与 EB500 双芯片部署差异。
- 平台对接视图至少展示四个公共 C 接口示例及两侧适配关系。
- 平台与产品两组筛选均不改变任何卡片坐标；Zephyr/Melis 筛选不会淡化共享应用、组件和接口。
- 业务走查完整展示 IMU、助力参数设置和双芯片电源协作三条链路。
- 电源示例明确区分 RT1046 整机状态机、F133 GUI 子系统状态机、共享协作契约和两侧 `power_device` 适配。
- 接口落位能从 `imu_device_read_batch()` 追踪到 `sensor_sample_fetch()`、`bmi160_sample_fetch()`、`spi_transceive_dt()`、`spi_mcux_transceive()` 和 NXP LPSPI，并显示对应文件层级。
- 页面明确标出 1 kHz 原始数据不跨 USB、主状态位于 RT1046、F133 为 USB Host。
- 在常见桌面宽度下无内容遮挡，并提供横向打印样式。
