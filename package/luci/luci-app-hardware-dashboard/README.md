# luci-app-hw-dashboard

A real-time hardware monitoring dashboard for OpenWrt LuCI. Built entirely from scratch using vanilla JavaScript and CSS — no external libraries or frameworks. Every metric is sourced directly from the kernel and system interfaces, polled live, and rendered without page reloads.

The dashboard is designed to be genuinely informative rather than decorative. It surfaces data that standard LuCI status pages omit: CPU cache topology, NAND wear levels, SoC identity, PCIe negotiated link state, WiFi PHY capabilities, and more. Layout is fully responsive; all cards collapse correctly on mobile.


## Installation

### From pre-built package (recommended)

Download the latest `.apk` from the [Releases](https://github.com/AliLostInTheDark/luci-app-hw-dashboard/releases) page and install it on your router:

```sh
apk add --allow-untrusted luci-app-hw-dashboard-1.0.0.apk
```

The package post-install script restarts `rpcd` automatically. Reload the LuCI interface and navigate to **Status > Hardware Dashboard**.

### From source

Clone into your OpenWrt build tree and compile:

```sh
git clone https://github.com/AliLostInTheDark/luci-app-hw-dashboard.git package/luci/luci-app-hw-dashboard
make menuconfig   # LuCI -> Applications -> luci-app-hw-dashboard
make package/luci/luci-app-hw-dashboard/compile V=s
```

### Upgrading

Installing a newer release over an existing one automatically clears all persisted hardware caches (`/etc/hwdash/`) and the LuCI module cache, so stale data from a previous version is never served.


## Supported Devices

The dashboard runs on any OpenWrt device. It has been developed and validated on the following JioRouter hardware:

| Model | Variants | SoC | Notes |
|-------|----------|-----|-------|
| JIDU6J11 | JIDU6111 to JIDU6911 | Qualcomm IPQ9554 | Primary development target |
| JIDU6J01 | JIDU6101 to JIDU6801 | MediaTek MT7986a | Primary development target |
| JIDU6700 | — | MediaTek MT7981BA | WiFi chip temperatures non-functional — calibration data absent from Factory partition |

On x86/x86\_64 and non-Qualcomm ARM targets, Qualcomm-specific fields (SoC family, SoC ID, machine name) are silently omitted. All other functionality is platform-independent.


## Dashboard Cards

### CPU

An SVG arc dial shows aggregate CPU utilization at a glance. Below it:

- **Cores / Threads** — physical core and logical thread counts
- **Cache** — L0 through L4 sizes read from `/sys/devices/system/cpu/cpu*/cache/`. On kernels without `CONFIG_CPU_CACHE_INFO` (common on QSDK-derived builds), cache sizes are resolved from the ARM CPU implementer and part number in `/proc/cpuinfo` using a built-in lookup table covering Cortex-A5 through Cortex-X4, Falkor, and Neoverse families
- **Current / Max Frequency** — live per-core frequency from `cpufreq`, maximum from `cpuinfo_max_freq`
- **Load Average** — 1 / 5 / 15 minute averages
- **CPU Governor** — active scaling governor
- **Uptime** — formatted as days, hours, minutes
- **Per-core bars** — individual utilization bar and frequency for every logical CPU

The advanced CPU panel (shown alongside) breaks down aggregate time into: Idle, User, Nice, System, I/O Wait, IRQ, Soft IRQ, and tracks Context Switches/s, Hardware Interrupts/s, System Tasks (running / total), and Active Connections against the conntrack limit.

### Memory

An SVG arc dial shows RAM utilization. The stats list includes:

- Physical Total (rounded up to the nearest standard DRAM size: 32 MB through 64 GB)
- Usable Total (as reported by the kernel)
- Used, Free, Cached, Buffers — each with a proportional progress bar
- Swap — shown only when a swap partition or file is active
- ZRAM — compressed RAM block device utilization with the live compression ratio
- Slab Kernel and PageTables — kernel memory overhead

### System Info

Static system identity collected once and persisted:

- Hostname and OpenWrt distribution string
- Kernel version and CPU architecture
- CPU model (from `/proc/cpuinfo` or `/tmp/sysinfo/model` fallback)
- **SoC Family, Machine, SoC ID, SoC Revision, SoC Serial** — read from `/sys/devices/soc0/` (present on Qualcomm platforms; silently absent elsewhere)
- CPU vulnerability mitigations (`/sys/devices/system/cpu/vulnerabilities/`) with color coding: green for mitigated, amber for partially mitigated, red for vulnerable

### Internal Storage

The card leads with the rootfs filesystem as a progress bar showing used vs. usable space, with read/write I/O speed for disk-backed filesystems and percentage utilization for NAND/flash. Additional mounted filesystems appear as separate bars.

Below the filesystem bars, a summary section shows hardware-accurate storage sizes. The content is dynamic based on the detected underlying storage type:

| Storage type | Summary rows shown |
|---|---|
| NAND / MTD (UBI) | Physical NAND Total, rootfs Physical Total, Overlay Total / Used / Free, MTD Partitions |
| eMMC | Physical eMMC Total, Usable Total, Usable Free |
| HDD / SSD / NVMe | Physical Disk Total, rootfs Physical Total (if sub-partitioned), Usable Total, Usable Free |

**Physical NAND Total** is computed by summing MTD partition sizes directly from `/sys/class/mtd/`, not from block device enumeration. This ensures that externally connected USB drives never contaminate the reported NAND chip capacity.

**Overlay** data (Total / Used / Free) is sourced from `df /overlay` and reflects the actual writable space on UBI-based routers — the only number relevant to day-to-day flash usage.

**UBI / NAND Flash** sub-section:

- Chip ID — extracted from `dmesg` at first boot and persisted. Covers QPIC, SPI-NAND, and parallel NAND controllers
- Wear Level — maximum erase cycle count vs. the 3000-cycle rated endurance, shown as a percentage bar
- PEB Utilization — physical erase block usage
- PEB Status — total / available / bad block counts
- NAND Geometry — erase block size, page size, OOB size

**MTD Partition Table** — all MTD devices with their sizes and types in a compact table.

**eMMC, NVMe, and F2FS** detail sections are rendered conditionally when those storage types are detected.

### External Storage

USB mass storage devices are detected by scanning block devices for the `removable` flag. Each detected drive shows its filesystem type, mount point, and capacity.

### Thermal Sensors

All thermal zones from `/sys/class/thermal/` and `hwmon` inputs are collected and sorted into three columns: CPU, WiFi, and Miscellaneous. Each reading is displayed as a color-coded badge that transitions from green through amber to red as it approaches the critical threshold. Columns that are empty on a given platform are suppressed entirely.

### Ethernet Status

Each physical ethernet interface (`eth*`, `lan*`, `wan*`) is queried via `ethtool` for link speed, duplex mode, and error counters. The card shows RX/TX drop and error rates color-coded by severity.

### PCIe Topology

PCIe devices are enumerated from `/sys/bus/pci/devices/`. For each device, the card shows the negotiated link speed and width alongside the controller maximum, making it immediately visible if a device is running below its rated capability.

### USB Bus

USB host controllers are read from `/sys/bus/usb/devices/`. The card shows each root hub's negotiated speed (USB 2.0 / 3.0 / 3.1 / 3.2) and lists connected devices by name and protocol version.

### WiFi PHY

Each wireless radio is queried via `iwinfo` and `iw`. Per-radio data includes:

- Band and channel (with width)
- TX power
- Hardware mode (802.11ac / ax / be)
- Configured and hardware-maximum NSS (spatial streams)
- Enabled channel list
- Current bitrate and associated client count
- Noise floor

WiFi hardware capabilities (`iw list`) are parsed by an AWK script and persisted to `/etc/hwdash/wifi_cap_v4.json` on first run, since `iw list` is expensive and the PHY capabilities never change at runtime.


## Caching Architecture

The dashboard is deliberately conservative about process spawning. Shell forks and `awk`/`iw` invocations account for significant CPU time on embedded platforms. Two tiers of caching are used:

**Persistent cache** (`/etc/hwdash/`) — survives reboots; represents data that is physically impossible to change without replacing hardware:

| File | Content | Invalidated |
|------|---------|-------------|
| `wifi_cap_v4.json` | WiFi PHY hardware capabilities from `iw list` | On package upgrade |
| `sys_static_v2.frag` | CPU cache sizes, SoC identity, kernel version, vulnerability status | On package upgrade |
| `nand_chipid_v1.txt` | NAND chip ID from `dmesg` | On package upgrade |

**Volatile cache** (`/tmp/`) — cleared on reboot; represents live data with a short TTL:

| File | Content | TTL |
|------|---------|-----|
| `hwdash_wifi_radios_v1.json` | Live WiFi radio state (channel, clients, bitrate, noise) | 20 seconds |
| `hwdash_storage_inv_v1.sh` | MTD partition table + UBI device tree (layout fixed at flash time; wear/ECC move slowly) | 30 seconds |

On package upgrade or reinstall, all caches are cleared by the postinst script so that updated parsing logic always runs against fresh data.


## Backend

The backend is a single POSIX shell script registered as an `rpcd` call object at `/usr/libexec/rpcd/luci.hwdash`. It responds to `luci.hwdash info` and returns a single JSON object containing all dashboard data in one round-trip.

Data collection covers: CPU statistics from `/proc/stat`, memory from `/proc/meminfo`, disk I/O from `/proc/diskstats`, filesystem usage from `df`, MTD layout from `/sys/class/mtd/`, UBI state from `/sys/class/ubi/`, thermal zones from `/sys/class/thermal/` and `hwmon`, ethernet link state from `ethtool`, PCIe topology from `/sys/bus/pci/`, USB topology from `/sys/bus/usb/`, WiFi state from `iwinfo` and `iw`, eMMC health from `/sys/block/mmcblk*/`, NVMe identity from `/sys/block/nvme*/`, and F2FS statistics from `/sys/fs/f2fs/`.

The script is written to minimize process spawning on embedded hardware: `/proc/stat` is parsed in a single pass for all CPU-tick, context-switch and interrupt counters; per-device `/sys` stat files are read with shell builtins rather than `cat`/`awk` pipelines; and the slow-changing storage inventory is served from cache (see Caching Architecture above) so the per-poll fork count stays low.

The AWK-based WiFi capability parser (`luci.hwdash_wifi_cap.awk`) handles the structured output of `iw list` to extract per-PHY band support, channel lists, NSS capabilities, and hardware mode.


## Frontend

The frontend is a single LuCI JavaScript view (`hw_dash.js`) that polls `/ubus/call` once per second. All DOM updates are incremental — only the values that change are touched, not the whole card. SVG dials use `stroke-dasharray` transitions for smooth animation.

Dynamic color scaling (`getDynColor`) maps utilization percentages to a green → amber → red gradient without hardcoded thresholds that would be wrong for different metric types. The inversion flag is used for metrics like Free memory and CPU Idle where high values are good.

The layout uses CSS flexbox throughout. Multi-column wide cards (the CPU advanced panel, Thermals, and the UBI/MTD detail row) use a flex-row layout that collapses to a flex-column on viewports below 768px. No media query breakpoints are hardcoded into JavaScript.


## Screenshots

*(Update with current screenshots after installation)*


## License

Apache License 2.0
