# F133 / Melis RTOS 研究基线

## 来源与固定版本

- 全志在线 Melis 4.0 开发指南：<https://docs.aw-ol.com/docs/soc/f102/system/%E7%B3%BB%E7%BB%9F%E5%BC%80%E5%8F%91%E6%8C%87%E5%8D%97/>
- 当前可访问的社区镜像：<https://github.com/DongshanPI/D1s-Melis>
- 固定提交：`b289fdae3e6245c3f185259903c91e7db204cfb5`
- 固定提交入口：<https://github.com/DongshanPI/D1s-Melis/commit/b289fdae3e6245c3f185259903c91e7db204cfb5>

原 `Tina-Linux/d1s-melis` 和 `YuzukiHD/d1s-melis` 地址在 2026-08-16 已不可访问，因此当前镜像不能被认定为全志官方发布基线。

本公开仓库不托管该 Melis 镜像、源码 ZIP 或随仓库附带的 PDF。

## 关于 Linux 启动的结论

当前源码证据不支持“F133 先启动 Linux kernel，再运行 Melis”的说法。该镜像的运行链可归纳为：

`BROM -> boot0 -> 可选 U-Boot -> OpenSBI -> Melis/RT-Thread -> GUI/应用`

- `platform.txt` 标识 `sun20iw1p1`、`melis`、`d1s-nezha`。
- Melis 默认选择 RT-Thread 作为内核，RISC-V 启动代码最终进入 RT-Thread 调度器。
- 打包配置包含 boot0、U-Boot、OpenSBI 和 `epos.img`，未发现 Linux kernel 镜像。
- SDK 使用 Ubuntu 构建，并复用 Linux Kbuild、DTC、V4L2 等代码/接口；这解释了“基于 Linux”的印象，但不是运行时依赖 Linux kernel。

## 不能作为量产基线的原因

- 仓库根目录没有统一许可证，不能推断整个 SDK 可再分发。
- boot0、U-Boot、OpenSBI 的对应源码未包含在仓库中，只发现预编译产物及外部 `brandy-2.0` 路径引用。
- `toolchain` 子模块未初始化；它指向预编译工具链，许可证和可追溯性尚未核验。
- 仓库夹带 72 份 PDF：首三页扫描发现 57 份标“文档密级：秘密”、7 份标 `Confidential`。这些文档不应被引用、复制或提交到对外仓库。
- Windows 大小写不敏感文件系统无法同时检出 `ekernel/components/aw/samples/Kconfig` 和同目录的 `kconfig/`，工作树因此显示一个已删除文件。源码 ZIP 保留了两者；正式检出和构建必须使用 Linux/大小写敏感文件系统。

## 后续必需输入

向全志或方案商索取 EB500 实际使用的完整、已授权 SDK，并确认：SDK 版本/提交、F133 板级包、bootloader/OpenSBI 源码、工具链及许可证、量产烧录工具和安全升级能力。

获取并核验日期：2026-08-16。本轮未构建、烧录或进行硬件验证。
