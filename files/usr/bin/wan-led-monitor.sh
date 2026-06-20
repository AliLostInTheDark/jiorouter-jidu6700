#!/bin/sh
trap 'exit 0' TERM INT
WAN_IFACE="wan"
RED_LED="/sys/class/leds/red:status"
GREEN_LED="/sys/class/leds/green:status"
BLUE_LED="/sys/class/leds/blue:status"
PING_TARGETS="1.1.1.1 8.8.8.8"

set_led() {
    echo none > ${1}/trigger 2>/dev/null
    echo ${2} > ${1}/brightness 2>/dev/null
}
blink_led() {
    echo timer > ${1}/trigger 2>/dev/null
    echo ${2:-500} > ${1}/delay_on 2>/dev/null
    echo ${2:-500} > ${1}/delay_off 2>/dev/null
}
turn_off_all() {
    set_led "$RED_LED" 0
    set_led "$GREEN_LED" 0
    set_led "$BLUE_LED" 0
}
check_internet() {
    for target in $PING_TARGETS; do
        if ping -c 1 -W 2 -I "$WAN_IFACE" "$target" >/dev/null 2>&1; then
            return 0
        fi
    done
    return 1
}
is_upgrading() {
    pgrep -f "sysupgrade" >/dev/null 2>&1 && return 0
    [ -e /tmp/sysupgrade ] && return 0
    [ -e /overlay/.sysupgrade ] && return 0
    [ -e /tmp/.failsafe ] && return 0
    [ -f /tmp/sysupgrade.always_force_backup ] && return 0
    ls /tmp/sysupgrade-* >/dev/null 2>&1 && return 0
    return 1
}
wan_has_ip() {
    ip addr show "$WAN_IFACE" 2>/dev/null | grep -q "inet "
}

while true; do
    if ip link show pppoe-wan >/dev/null 2>&1; then
        WAN_IFACE="pppoe-wan"
    else
        WAN_IFACE="wan"
    fi

    if is_upgrading; then
        turn_off_all
        exit 0
    fi
    if wan_has_ip; then
        if check_internet; then
            turn_off_all
            set_led "$GREEN_LED" 1
        else
            turn_off_all
            blink_led "$RED_LED"
        fi
    else
        turn_off_all
        set_led "$RED_LED" 1
    fi
    sleep 10
done
