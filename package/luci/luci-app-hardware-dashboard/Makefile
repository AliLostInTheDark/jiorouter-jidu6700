include $(TOPDIR)/rules.mk

# Core logic (hw_dash.js, luci.hwdash, luci.hwdash_wifi_cap.awk) is synced from
# the standalone upstream repository:
#   https://github.com/AliLostInTheDark/luci-app-hw-dashboard
# Synced at v1.0.0-r8 (commit 80f0928). Packaged here as luci-app-hardware-dashboard.

LUCI_TITLE:=Hardware Dashboard
LUCI_DEPENDS:=+luci-base
LUCI_PKGARCH:=all
PKG_VERSION:=1.0.0
PKG_RELEASE:=8
PKG_LICENSE:=Apache-2.0
FEED:=luci

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature

define Package/luci-app-hardware-dashboard/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	rm -f /tmp/luci-indexcache.*
	rm -rf /tmp/luci-modulecache/
	rm -f /tmp/hwdash_*
	rm -rf /etc/hwdash
	/etc/init.d/rpcd restart 2>/dev/null
	exit 0
}
endef
