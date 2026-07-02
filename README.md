# OpenWrt Flashing Guide for JioRouter AX3000 (JIDU6700)

Welcome to the installation guide for flashing OpenWrt onto your **JioRouter AX3000 (JIDU6700)**. 
This guide assumes you have basic familiarity with UART serial connections and TFTP servers.

## ⚠️ Important Warnings
> [!WARNING]
> Flashing custom firmware carries inherent risks. Make sure you understand these steps fully before proceeding.

> [!CAUTION]
> **DO NOT CONNECT VCC** when attaching your USB to TTL adapter. Doing so will permanently damage your board.

---

## Hardware Preparation

### Step 1: UART Connection
Connect your USB to TTL adapter to the UART headers soldered onto your board. 

* **TX** to **RX**
* **RX** to **TX**
* **GND** to **GND**

<img width="2252" height="1642" alt="UART" src="https://github.com/user-attachments/assets/4954d1e0-f3de-46d7-aa17-4c7bccf8faa5" />

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
