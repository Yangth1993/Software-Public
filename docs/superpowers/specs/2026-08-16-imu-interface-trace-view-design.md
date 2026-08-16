# IMU 接口落位视图设计

## 1. 目标

在现有架构 HTML 中新增独立的 `VIEW 04 / 接口落位`，用“sensor_hub 创建线程并通过 SPI 采样 IMU”这一条完整链路，说明公共组件、OSAL、设备 HAL、平台适配和硬件驱动分别承担什么职责。

该视图是架构示例，不表示实际 IMU 型号、Melis SPI API、线程优先级、DMA 通道或最终错误码已经确定。

## 2. 页面结构

视图分为四个区域：

1. **编译与注册链**：从 Kconfig、Devicetree 到 `DEVICE_DT_INST_DEFINE()` 注册 Zephyr Sensor Device。
2. **线程启动链**：从产品入口到 `k_thread_create()`。
3. **DRDY 触发链**：从 IMU GPIO 中断到唤醒 `sensor_hub_worker()`。
4. **单次读取链**：逐函数展开 `sensor_sample_fetch()`、`sensor_channel_get()`、Sensor Driver API、SPI API 和 NXP LPSPI。
5. **文件与接口落位**：按层级展示文件路径、公开函数和实现责任。
6. **高频采样说明**：区分 Zephyr 标准 Sensor API 示例与 1 kHz FIFO/DMA 扩展位置。

## 3. 启动与采样调用链

### 3.1 Zephyr 编译、DTS 与设备注册

页面以 Zephyr 3.1.0 自带的 BMI160 SPI 驱动作为真实调用示例；BMI160 只代表一个具有加速度计、陀螺仪、SPI 和 DRDY 的具体驱动，不表示项目最终选型。

```text
products/eb500_rt/product.conf
  -> CONFIG_SENSOR=y
  -> CONFIG_SPI=y
  -> CONFIG_BMI160=y
  -> CONFIG_BMI160_TRIGGER=y

boards/nxp/eb500_rt.overlay
  -> &lpspi1 { imu0: bmi160@0 { compatible = "bosch,bmi160"; ... }; };

Zephyr build
  -> drivers/sensor/bmi160/bmi160.c
  -> BMI160_DEVICE_INIT(inst)
  -> DEVICE_DT_INST_DEFINE(..., bmi160_init, ..., &bmi160_api)
  -> POST_KERNEL / CONFIG_SENSOR_INIT_PRIORITY
  -> bmi160_init(dev)
  -> bmi160_trigger_mode_init(dev)
```

`DEVICE_DT_INST_DEFINE()` 生成的 `struct device` 保存 `dev->api = &bmi160_api`。因此公共 adapter 后续调用 `sensor_sample_fetch(imu_dev)` 时，Zephyr 能通过 `dev->api` 找到 BMI160 的实现。

### 3.2 线程启动链

```text
products/eb500_rt/main.c
  -> app/core/app_runtime.c : app_runtime_start()
  -> components/sensor_hub/sensor_hub.c : sensor_hub_start()
  -> ports/os/os_thread.h : os_thread_create()
  -> adapters/zephyr/os/os_thread.c : os_thread_create()
  -> zephyr/kernel.h : k_thread_create()
  -> sensor_hub_worker()
```

### 3.3 DRDY 触发链

```text
adapters/zephyr/device/imu_device.c : imu_device_open()
  -> DEVICE_DT_GET(DT_NODELABEL(imu0))
  -> device_is_ready(imu_dev)
  -> sensor_attr_set(..., SENSOR_ATTR_SAMPLING_FREQUENCY, 1000 Hz)
  -> sensor_trigger_set(imu_dev, DATA_READY, imu_zephyr_drdy_handler)
  -> dev->api->trigger_set()
  -> drivers/sensor/bmi160/bmi160_trigger.c : bmi160_trigger_set()

IMU DRDY pin
  -> Zephyr GPIO ISR
  -> bmi160_gpio_callback()
  -> k_sem_give() 或 k_work_submit()
  -> bmi160_handle_interrupts()
  -> imu_zephyr_drdy_handler()
  -> adapters/zephyr/device/imu_device.c : k_sem_give(&sample_ready)
  -> sensor_hub_worker() 中 imu_device_wait_data_ready()
```

### 3.4 读取数据的真实 Zephyr Sensor 调用链

```text
components/sensor_hub/sensor_hub.c
  sensor_hub_worker()
  -> ports/device/imu_device.h : imu_device_read_batch()

adapters/zephyr/device/imu_device.c
  imu_device_read_batch()
  -> sensor_sample_fetch(imu_dev)
  -> sensor_channel_get(imu_dev, SENSOR_CHAN_ACCEL_XYZ, accel)
  -> sensor_channel_get(imu_dev, SENSOR_CHAN_GYRO_XYZ, gyro)
  -> sensor_value -> imu_sample_t

include/zephyr/drivers/sensor.h
  sensor_sample_fetch()
  -> z_impl_sensor_sample_fetch()
  -> ((struct sensor_driver_api *)dev->api)->sample_fetch(dev, SENSOR_CHAN_ALL)

drivers/sensor/bmi160/bmi160.c
  bmi160_api.sample_fetch = bmi160_sample_fetch
  -> bmi160_sample_fetch()
  -> bmi160_read()
  -> bmi160_read_spi()
  -> bmi160_transceive()
  -> spi_transceive_dt(&cfg->bus.spi, ...)

include/zephyr/drivers/spi.h
  spi_transceive_dt()
  -> spi_transceive()
  -> ((struct spi_driver_api *)dev->api)->transceive(...)

drivers/spi/spi_mcux_lpspi.c
  spi_mcux_driver_api.transceive = spi_mcux_transceive
  -> spi_mcux_transceive()
  -> transceive_dma()                    [CONFIG_SPI_MCUX_LPSPI_DMA=y]
     或 transceive()
  -> LPSPI_EnableDMA() / dma_start()
     或 LPSPI_MasterTransferNonBlocking()
  -> NXP LPSPI 寄存器 / SPI 总线 / BMI160

返回路径
  -> bmi160_sample_fetch() 缓存原始值
  -> sensor_channel_get()
  -> z_impl_sensor_channel_get()
  -> dev->api->channel_get()
  -> bmi160_channel_get()
  -> struct sensor_value accel[3] / gyro[3]
  -> adapters/zephyr/device/imu_device.c 转成 imu_sample_t
  -> components/motion_fusion/motion_fusion.c : motion_fusion_push()
```

Melis 目标保留 `sensor_hub` 和 `imu_device.h` 调用链，只替换：

```text
adapters/melis/os/os_thread.c
adapters/melis/device/imu_device.c
Melis Sensor/Driver/SPI implementation
```

其中 Melis 的实际 Sensor、线程与 SPI API 名称标为“由正式 SDK 落实”，不在示例中虚构具体函数名。

## 4. 层级与文件责任

| 层级 | 文件 | 核心接口/函数 | 责任 |
|---|---|---|---|
| 产品装配 | `products/eb500_rt/main.c`、`product.conf` | `app_runtime_start()`、`ENABLE_SENSOR_HUB` | 选择是否编译组件，不实现采样业务 |
| 共享应用 | `app/core/app_runtime.c` | `sensor_hub_init()`、`sensor_hub_start()` | 组织组件启动顺序 |
| 公共组件 | `components/sensor_hub/sensor_hub.c` | `sensor_hub_worker()` | 管理采样线程、读取样本、转交算法 |
| 公共组件 | `components/motion_fusion/motion_fusion.c` | `motion_fusion_push()` | 滤波、姿态融合和派生计算 |
| OSAL | `ports/os/os_thread.h` | `os_thread_create()`、`os_thread_start()` | 提供稳定线程接口 |
| Device HAL | `ports/device/imu_device.h` | `imu_device_open()`、`wait_data_ready()`、`read_batch()` | 提供语义化 IMU 能力，不暴露 Zephyr Device 或 SPI |
| Zephyr Device Adapter | `adapters/zephyr/device/imu_device.c` | `DEVICE_DT_GET()`、`sensor_trigger_set()`、`sensor_sample_fetch()`、`sensor_channel_get()` | 把公版 IMU 接口映射到 Zephyr Sensor API |
| Zephyr Sensor API | `include/zephyr/drivers/sensor.h` | `z_impl_sensor_sample_fetch()`、`z_impl_sensor_channel_get()` | 通过 `dev->api` 分发到具体 Sensor Driver |
| Zephyr IMU Driver | `drivers/sensor/bmi160/bmi160.c` | `bmi160_init()`、`bmi160_sample_fetch()`、`bmi160_channel_get()` | 实现寄存器协议、原始值缓存和单位转换 |
| Zephyr Trigger Driver | `drivers/sensor/bmi160/bmi160_trigger.c` | `bmi160_gpio_callback()`、`bmi160_handle_interrupts()` | 处理 DRDY GPIO 并回调公共 adapter |
| Zephyr SPI API | `include/zephyr/drivers/spi.h` | `spi_transceive_dt()`、`spi_transceive()` | 通过 SPI Device 的 `dev->api` 分发到控制器驱动 |
| NXP SPI Driver | `drivers/spi/spi_mcux_lpspi.c` | `spi_mcux_transceive()`、`transceive_dma()` | 操作 NXP LPSPI、DMA 和中断 |
| BSP/硬件 | DTS、pinctrl、NXP LPSPI、IMU | `DEVICE_DT_INST_DEFINE()` 生成的设备实例 | 提供总线、片选、GPIO、DMA 和物理硬件配置 |

## 5. 接口示例范围

页面只展示能够说明边界的短接口，不给出可直接编译的完整实现：

```c
int os_thread_create(os_thread_t *thread,
                     const os_thread_config_t *config);

int imu_device_wait_data_ready(uint32_t timeout_us);

int imu_device_read_batch(imu_sample_t *samples,
                          size_t capacity,
                          size_t *sample_count);

/* 只存在于 adapters/zephyr/device/imu_device.c */
sensor_sample_fetch(imu_dev);
sensor_channel_get(imu_dev, SENSOR_CHAN_ACCEL_XYZ, accel);
sensor_channel_get(imu_dev, SENSOR_CHAN_GYRO_XYZ, gyro);

int motion_fusion_push(const imu_sample_t *sample);
```

## 6. 架构约束

- `sensor_hub` 不包含 SPI 总线号、片选、寄存器地址、Zephyr device 指针或 Melis 句柄。
- `imu_device` 是面向公共组件的设备能力接口；Zephyr Sensor API 只能出现在 `adapters/zephyr/device/imu_device.c` 及其下层。
- 本视图的 Zephyr 主路径采用平台原生 Sensor Driver，因此不额外插入公版 `spi_bus_port`。若未来需要自有跨平台 IMU 驱动，可以另建 Bus HAL，但不能让 `sensor_hub` 直接访问它。
- `sensor_sample_fetch()` 负责把硬件值更新到驱动内部缓存；随后必须使用 `sensor_channel_get()` 取得加速度和陀螺仪通道值。
- `struct sensor_value` 是 Zephyr 类型，必须在 adapter 中转换为公版 `imu_sample_t`，不能向上泄漏。
- `sensor_hub_worker` 支持批量样本，避免把接口限定为一次一个样本。
- Zephyr 3.1 BMI160 示例的 `bmi160_sample_fetch()` 展示了真实 Sensor/SPI 分发路径，但它是单次 burst read，不等价于已经满足本项目 1 kHz FIFO 需求。正式驱动需根据最终 IMU 增加 FIFO 批量读取，并开启或验证 `CONFIG_SPI_MCUX_LPSPI_DMA`。
- 1 kHz 正式方案使用 DRDY 中断唤醒和 FIFO 批量读取；`sleep(1 ms)` 轮询只作为反例展示。
- 原始 1 kHz IMU 数据停留在 RT1172/RT1046，不发送到 F133。

## 7. 交互与视觉

- 顶部增加第四个固定位置标签 `VIEW 04 / 接口落位`。
- 调用链分为“Build/Init、Thread Start、DRDY Trigger、Read Sample”四条可切换路径，避免把启动期和运行期调用混在一起。
- “Read Sample”逐级展开两次 `dev->api` 动态分发：Sensor API 到 BMI160 Driver、SPI API 到 MCUX LPSPI Driver。
- 调用链保持从上到下的层级方向，颜色沿用现有图例：公版绿色、Zephyr API/adapter 蓝色、具体驱动和硬件灰色。
- 点击调用步骤后，右侧显示文件路径、函数签名、调用者和被调用者。
- Zephyr/Melis 切换只替换 adapter/API/driver 内容，公共 `sensor_hub`、`imu_device.h` 和 `motion_fusion` 卡片位置保持不变。
- 页面离线运行，不增加外部库或网络资源。

## 8. 验收标准

- 能从 `main.c` 顺序追踪到 `k_thread_create()` 和 `sensor_hub_worker()`。
- 能从 `imu_device_read_batch()` 逐函数追踪到 `sensor_sample_fetch()`、`dev->api->sample_fetch()`、`bmi160_sample_fetch()`、`spi_transceive_dt()`、`spi_driver_api->transceive()`、`spi_mcux_transceive()` 和 NXP LPSPI。
- 能看到 `sensor_channel_get()` 如何通过 `dev->api->channel_get()` 调用 `bmi160_channel_get()`，以及 adapter 如何将 `sensor_value` 转成 `imu_sample_t`。
- 能从 DTS/Kconfig 追踪到 `DEVICE_DT_INST_DEFINE()`、`bmi160_init()` 和 `bmi160_api` 注册。
- 能从 DRDY GPIO 追踪到 `bmi160_gpio_callback()`、Zephyr trigger handler 和 `sensor_hub_worker()` 唤醒。
- `sensor_hub`、OSAL、IMU Device HAL、Zephyr Sensor API、BMI160 Driver、Zephyr SPI API、MCUX LPSPI Driver 的文件位置清晰可见。
- Zephyr/Melis 切换时公共调用链位置不变。
- 页面明确说明 Melis API 名称尚待正式 SDK 确认。
- 页面明确说明 1 kHz 推荐中断/FIFO/DMA，而不是依赖 1 ms 睡眠轮询。
- 静态契约和浏览器交互测试覆盖新视图、关键文件名和切换行为。
