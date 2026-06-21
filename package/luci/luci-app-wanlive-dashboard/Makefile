#
# Copyright (C) 2008-2014 The LuCI Team <luci@lists.subsignal.org>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=WAN Dashboard
LUCI_DEPENDS:=+libc +luci-base
LUCI_PKGARCH:=all
PKG_VERSION:=1.0
PKG_RELEASE:=2
PKG_LICENSE:=Apache-2.0
FEED:=luci

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature

define Package/luci-app-wanlive-dashboard/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	rm -f /tmp/luci-indexcache.*
	rm -rf /tmp/luci-modulecache/
	rm -f /tmp/wandash_state.json
	/etc/init.d/rpcd restart 2>/dev/null
	exit 0
}
endef

$(eval $(call BuildPackage,luci-app-wanlive-dashboard))
