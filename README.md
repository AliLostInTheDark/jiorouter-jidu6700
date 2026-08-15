# OpenWrt Flashing Guide for JioRouter AX3000 (JIDU6700)

Welcome to the installation guide for flashing OpenWrt onto your **JioRouter AX3000 (JIDU6700)**. 
This guide assumes you have basic familiarity with UART serial connections and TFTP servers.

## ⚠️ Important Warnings
> [!WARNING]
> Flashing custom firmware carries inherent risks. Make sure you understand these steps fully before proceeding.

> [!CAUTION]
> **DO NOT CONNECT VCC** when attaching your USB to TTL adapter. Doing so will permanently damage your board.

> [!IMPORTANT]
> Flashing erases the vendor dual boot layout. The `ubi` partition is reformatted and both vendor slots are destroyed. Confirm you can reach the U-Boot menu over serial **before** you start, as that is the only recovery path afterwards.

> [!IMPORTANT]
> **Back up every MTD partition before flashing.** `Factory` holds the WiFi calibration EEPROM and `MFG` holds the MAC base address; neither can be regenerated if lost, and without them the board will not have working radios or its original addresses. Do this from the initramfs, before running `sysupgrade`.

### Backing up the vendor partitions

Boot the initramfs first (steps 1-8), then dump all nine partitions. The device is reachable at `192.168.1.1`.

From your computer, pull each one over SSH:

```sh
for i in 0 1 2 3 4 5 6 7 8; do
    ssh root@192.168.1.1 "cat /dev/mtd$i" > "jidu6700-mtd$i.bin"
done
```

Or dump them on the device first and copy them off in one go:

```sh
ssh root@192.168.1.1 'for i in 0 1 2 3 4 5 6 7 8; do dd if=/dev/mtd$i of=/tmp/mtd$i.bin; done'
scp root@192.168.1.1:/tmp/mtd*.bin .
```

The LuCI web interface at `192.168.1.1` can do the same thing without a terminal: **System → Backup / Flash Firmware → Save mtdblock contents**, then pick each partition in turn and download it.

Expected sizes, useful for confirming the dumps are complete:

| dev | partition | size |
|---|---|---|
| mtd0 | BL2 | 1 MiB |
| mtd1 | u-boot-env | 512 KiB |
| mtd2 | Factory | 2 MiB |
| mtd3 | FIP | 2 MiB |
| mtd4 | ubi | 140 MiB |
| mtd5 | ubi2 | 88 MiB |
| mtd6 | BDF | 2 MiB |
| mtd7 | MFG | 2 MiB |
| mtd8 | Jio-Reserved | 2 MiB |

> [!CAUTION]
> `MFG` contains your device's MAC address and factory-provisioned credentials. Keep these dumps private and do not publish them.

---

## Hardware Preparation

### Step 1: UART Connection
Connect your USB to TTL adapter to the UART headers soldered onto your board. 

* **TX** to **RX**
* **RX** to **TX**
* **GND** to **GND**

### Step 2: Establish Serial Console
Use a serial terminal emulator like **PuTTY**, **Tera Term 5**, or **MobaXterm** to gain access to the terminal.

### Step 3: Serial Settings
Configure your terminal with the following settings:
* **Baud Rate:** `115200`
* **Data bits:** `8`
* **Stop bits:** `1`
* **Parity:** `None`
* **Flow control:** `None`

---

## Unlocking the Bootloader

### Step 4: Access U-Boot Menuloader
Power on the router while monitoring the serial terminal. When the **MediaTek U-Boot Menuloader** comes online and displays options `0` through `8`, quickly press **`8`** to gain access to the U-Boot shell.

### Step 5: Shell Authentication Bypass
Press `Enter` **6 times**. 
*(This accounts for 2 retries each for the username and password, eventually landing you on the default authentication shell).*

### Step 6: Login
Enter the default factory credentials:
* **Username:** `cheetah12`
* **Password:** `RtFQm@tb9P(K6vy2`

---

## Flashing OpenWrt

### Step 7: Prepare TFTP Server
Set a static IP on your computer's ethernet interface:
* **IP Address:** `192.168.1.2`
* **Gateway:** `192.168.1.1`

Download the **initramfs image** for the JIDU6700 and host it in the root directory of your TFTP server.

### Step 8: Load and Run Initramfs
In your unlocked U-Boot shell, execute the following commands to load the image into memory and bypass the signature verification:

```sh
setenv ipaddr 192.168.1.1
setenv serverip 192.168.1.2
tftpboot 0x46000000 openwrt-mediatek-filogic-jiorouter_ax3000-jidu6700-initramfs-kernel.bin
fdt addr $(fdtcontroladdr)
fdt rm /signature
bootm
```

### Step 9: Flash Sysupgrade Image
Once OpenWrt boots into RAM (initramfs), you can transfer the final `sysupgrade` image to the `/tmp` folder on the router (e.g., via `scp` or a local web server). 

Flash the image permanently with:

```sh
sysupgrade /tmp/openwrt-mediatek-filogic-jiorouter_ax3000-jidu6700-squashfs-sysupgrade.bin
```

Alternatively, you can connect your PC back to DHCP, access the LuCI web interface at `192.168.1.1`, and use the built-in *Backup / Flash Firmware* option to upload and flash the `sysupgrade.bin` file visually.

---

## ⚠️ Known Issues

* **Wireless Chip Temperatures:** Temperature readings for the Wi-Fi chips are currently non-functional. This is because the necessary calibration values and chip-specific tunings are entirely missing from the device's `Factory` partition.
