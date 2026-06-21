include $(TOPDIR)/rules.mk

LUCI_TITLE:=Hardware Dashboard
LUCI_DEPENDS:=+luci-base
LUCI_PKGARCH:=all
PKG_VERSION:=1.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
FEED:=luci

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature

define Package/luci-app-hardware-dashboard/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	rm -f /tmp/luci-indexcache.*
	rm -rf /tmp/luci-modulecache/
	/etc/init.d/rpcd restart 2>/dev/null
	exit 0
}
endef
