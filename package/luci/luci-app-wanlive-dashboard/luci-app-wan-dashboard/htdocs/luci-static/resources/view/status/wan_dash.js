'use strict';
'require view';
'require poll';
'require rpc';
'require ui';
'require uci';

var callInterfaceDump = rpc.declare({
	object: 'network.interface',
	method: 'dump',
	expect: { interface: [] }
});

var callNetDevs = rpc.declare({
	object: 'network.device',
	method: 'status',
	expect: {}
});

var callPingAll = rpc.declare({
	object: 'luci.wandash',
	method: 'ping_all',
	params: [ 'ipv4_target1', 'ipv4_target2', 'ipv6_target1', 'ipv6_target2', 'devices' ],
	expect: { }
});

function formatSize(bytes) {
	if (typeof bytes !== 'number' || isNaN(bytes) || bytes === 0) return '0 B';
	var k = 1024;
	var sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
	var i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatSpeed(bps) {
	if (typeof bps !== 'number' || isNaN(bps) || bps === 0) return '0.00 bps';
	var k = 1024;
	var sizes = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'];
	var i = Math.floor(Math.log(bps) / Math.log(k));
	return parseFloat((bps / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
	if (!seconds) return '0s';
	var d = Math.floor(seconds / 86400);
	var h = Math.floor((seconds % 86400) / 3600);
	var m = Math.floor((seconds % 3600) / 60);
	var s = seconds % 60;
	if (d > 0) return d + 'd ' + h + 'h';
	if (h > 0) return h + 'h ' + m + 'm';
	if (m > 0) return m + 'm ' + s + 's';
	return s + 's';
}

var lastStats = {};
var historyData = {};
var currentLatency = {};
var currentLatColor = {};
var offlineSince = {};
var downSince = {};

function createSmoothPath(data, w, h, max) {
	if (data.length === 0) return '';
	var path = 'M 0,' + (h - (data[0] / max) * h);
	for (var i = 0; i < data.length - 1; i++) {
		var x0 = (i / (data.length - 1)) * w;
		var y0 = h - ((data[i] / max) * h);
		var x1 = ((i + 1) / (data.length - 1)) * w;
		var y1 = h - ((data[i + 1] / max) * h);
		var cp1x = x0 + (x1 - x0) / 2;
		var cp1y = y0;
		var cp2x = x0 + (x1 - x0) / 2;
		var cp2y = y1;
		path += ' C ' + cp1x + ',' + cp1y + ' ' + cp2x + ',' + cp2y + ' ' + x1 + ',' + y1;
	}
	return path;
}

function drawChart(svgEl, rxHistory, txHistory) {
	if (!svgEl) return;
	var maxTxRx = 1024;
	for (var i=0; i<rxHistory.length; i++) {
		if (rxHistory[i] > maxTxRx) maxTxRx = rxHistory[i];
		if (txHistory[i] > maxTxRx) maxTxRx = txHistory[i];
	}

	var width = 120;
	var height = 30;
	
	var rxPath = createSmoothPath(rxHistory, width, height, maxTxRx);
	var txPath = createSmoothPath(txHistory, width, height, maxTxRx);
	
	var rxFill = rxPath + ' L ' + width + ',' + height + ' L 0,' + height + ' Z';
	var txFill = txPath + ' L ' + width + ',' + height + ' L 0,' + height + ' Z';
	
	svgEl.innerHTML = '<svg width="120" height="30" style="background: rgba(0,0,0,0.1); border-radius: 3px;">' +
		'<path d="' + rxFill + '" fill="rgba(76, 175, 80, 0.2)" stroke="none"/>' +
		'<path d="' + rxPath + '" fill="none" stroke="#4CAF50" stroke-width="1.5"/>' +
		'<path d="' + txFill + '" fill="rgba(33, 150, 243, 0.2)" stroke="none"/>' +
		'<path d="' + txPath + '" fill="none" stroke="#2196F3" stroke-width="1.5"/>' +
		'</svg>';
}

function drawLatChart(svgEl, latHistory, color) {
	if (!svgEl) return;
	var maxLat = 100;
	for (var i=0; i<latHistory.length; i++) {
		if (latHistory[i] > maxLat) maxLat = latHistory[i];
	}

	var width = 120;
	var height = 30;
	
	var path = createSmoothPath(latHistory, width, height, maxLat);
	var fillPath = path + ' L ' + width + ',' + height + ' L 0,' + height + ' Z';
	
	var strokeColor = color || '#4CAF50';
	var fillColor = 'rgba(76,175,80,0.2)';
	if (strokeColor === '#F44336') fillColor = 'rgba(244,67,54,0.2)';
	else if (strokeColor === '#FF9800') fillColor = 'rgba(255,152,0,0.2)';
	
	svgEl.innerHTML = '<svg width="120" height="30" style="background: rgba(0,0,0,0.1); border-radius: 3px;">' +
		'<path d="' + fillPath + '" fill="' + fillColor + '" stroke="none"/>' +
		'<path d="' + path + '" fill="none" stroke="' + strokeColor + '" stroke-width="1.5"/>' +
		'</svg>';
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('network'),
			uci.load('firewall'),
			uci.load('wandash'),
			callInterfaceDump()
		]).then(function(res) {
			var firewalls = uci.sections('firewall', 'zone');
			var wanNets = [];
			firewalls.forEach(function(z) {
				if (z.name === 'wan' || z.masq === '1') {
					var nets = z.network ? (Array.isArray(z.network) ? z.network : z.network.split(' ')) : [];
					nets.forEach(function(n) { if (wanNets.indexOf(n) === -1) wanNets.push(n); });
				}
			});
			
			var networks = uci.sections('network', 'interface');
			var interfaces = Array.isArray(res[3]) ? res[3] : [];
			

			var validNets = networks.filter(function(n) {
				if (n['.name'] === 'loopback' || n['.name'] === 'lan') return false;
				var hasDefaultConfig = (n.defaultroute === '1');
				var notDisabled = (n.defaultroute !== '0');
				var inWanZone = wanNets.indexOf(n['.name']) !== -1;
				return notDisabled && (inWanZone || hasDefaultConfig);
			}).map(function(n) { return n['.name']; });
			

			interfaces.forEach(function(i) {
				if (i.interface === 'loopback' || i.interface === 'lan') return;
				var activeDefault = false;
				(i.route || []).forEach(function(r) {
					if (r.target === '0.0.0.0' || r.target === '::') {
						activeDefault = true;
					}
				});
				if (activeDefault && validNets.indexOf(i.interface) === -1) {
					validNets.push(i.interface);
				}
			});
			
			var targetIfaces = interfaces.filter(function(i) {
				return validNets.indexOf(i.interface) !== -1;
			});
			
			return targetIfaces.map(function(i) {
				i.display_name = i.interface;
				i.id_safe = i.interface.replace(/[^a-zA-Z0-9_-]/g, '_');
				return i;
			});
		});
	},

	render: function(wanIfaces) {
		var ipv4Target1 = uci.get('wandash', 'settings', 'ipv4_target') || '1.1.1.1';
		var ipv4Target2 = uci.get('wandash', 'settings', 'ipv4_target2') || '8.8.8.8';
		var ipv6Target1 = uci.get('wandash', 'settings', 'ipv6_target') || '2606:4700:4700::1111';
		var ipv6Target2 = uci.get('wandash', 'settings', 'ipv6_target2') || '2001:4860:4860::8888';

		var settingsBtn = E('button', {
			'class': 'btn cbi-button-action',
			'style': 'float: right; margin-top: 5px;',
			'click': function() {
				var inp4_1 = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'value': ipv4Target1, 'id': 'wd-inp4-1' });
				var inp4_2 = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'value': ipv4Target2, 'id': 'wd-inp4-2' });
				var inp6_1 = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'value': ipv6Target1, 'id': 'wd-inp6-1' });
				var inp6_2 = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'value': ipv6Target2, 'id': 'wd-inp6-2' });

				ui.showModal(_('WAN Dashboard Settings'), [
					E('div', { 'class': 'cbi-section' }, [
						E('div', { 'class': 'cbi-value' }, [
							E('label', { 'class': 'cbi-value-title' }, _('IPv4 Target 1')),
							E('div', { 'class': 'cbi-value-field' }, inp4_1)
						]),
						E('div', { 'class': 'cbi-value' }, [
							E('label', { 'class': 'cbi-value-title' }, _('IPv4 Target 2')),
							E('div', { 'class': 'cbi-value-field' }, inp4_2)
						]),
						E('div', { 'class': 'cbi-value' }, [
							E('label', { 'class': 'cbi-value-title' }, _('IPv6 Target 1')),
							E('div', { 'class': 'cbi-value-field' }, inp6_1)
						]),
						E('div', { 'class': 'cbi-value' }, [
							E('label', { 'class': 'cbi-value-title' }, _('IPv6 Target 2')),
							E('div', { 'class': 'cbi-value-field' }, inp6_2)
						])
					]),
					E('div', { 'class': 'right' }, [
						E('button', { 'class': 'btn cbi-button', 'click': ui.hideModal }, _('Cancel')),
						' ',
						E('button', { 'class': 'btn cbi-button cbi-button-action', 'click': function() {
							uci.set('wandash', 'settings', 'ipv4_target', inp4_1.value);
							uci.set('wandash', 'settings', 'ipv4_target2', inp4_2.value);
							uci.set('wandash', 'settings', 'ipv6_target', inp6_1.value);
							uci.set('wandash', 'settings', 'ipv6_target2', inp6_2.value);
							uci.save().then(function() { return uci.apply(); }).then(function() {
								window.location.reload();
							});
						}}, 'Save & Apply')
					])
				]);
			}
		}, '⚙ Settings');

		var container = E('div', { 'class': 'cbi-map', 'id': 'cbi-wan-dashboard' }, [
			settingsBtn,
			E('h2', { 'style': 'font-weight: 400; margin-bottom: 5px; color: var(--text);' }, 'WAN Live Traffic'),
			E('div', { 'style': 'font-size: 13px; opacity: 0.8; margin-bottom: 20px;' }, 
				'Live per-WAN byte throughput (updates every 1s). WAN uplinks are detected automatically. Green = download, Blue = upload.')
		]);

		if (wanIfaces.length === 0) {
			container.appendChild(E('div', { 'class': 'alert-message warning' }, 'No WAN interfaces with default gateway found.'));
			return container;
		}

		var table = E('table', { 'class': 'table', 'style': 'width: 100%; border-collapse: collapse; background: var(--background); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);' }, [
			E('tr', { 'style': 'border-bottom: 1px solid var(--border-color); background: rgba(255,255,255,0.03);' }, [
				E('th', { 'style': 'padding: 15px; text-align: left; width: 25%; font-weight: bold;' }, 'WAN uplink'),
				E('th', { 'style': 'padding: 15px; text-align: left; width: 15%; font-weight: bold;' }, '↓ Download'),
				E('th', { 'style': 'padding: 15px; text-align: left; width: 15%; font-weight: bold;' }, '↑ Upload'),
				E('th', { 'style': 'padding: 15px; text-align: center; width: 15%; font-weight: bold;' }, 'Activity'),
				E('th', { 'style': 'padding: 15px; text-align: left; width: 20%; font-weight: bold;' }, 'Total Data'),
				E('th', { 'style': 'padding: 15px; text-align: left; width: 10%; font-weight: bold;' }, 'Latency')
			])
		]);

		wanIfaces.forEach(function(iface, index) {
			var devName = iface.l3_device || iface.device || '';
			historyData[iface.id_safe] = { rx: Array(30).fill(0), tx: Array(30).fill(0), lat: Array(30).fill(0) };
			currentLatency[iface.id_safe] = 0;
			currentLatColor[iface.id_safe] = '#4CAF50';
			

			var isAlt = index % 2 === 1;
			var rowBg = isAlt ? 'rgba(0,0,0,0.1)' : 'transparent';
			
			var row = E('tr', { 'style': 'border-bottom: 1px solid var(--border-color); background: ' + rowBg + '; transition: background 0.3s;', 'id': 'row-' + iface.id_safe }, [

				E('td', { 'style': 'padding: 15px; vertical-align: top;' }, [
					E('div', { 'style': 'display: flex; align-items: center; gap: 8px; font-weight: bold; font-size: 14px; margin-bottom: 4px;' }, [
						E('div', { 'id': 'dot-' + iface.id_safe, 'style': 'width: 10px; height: 10px; border-radius: 50%; background: #4CAF50; transition: background 0.3s;' }),
						iface.display_name
					]),
					E('div', { 'style': 'font-size: 11px; opacity: 0.6; margin-bottom: 4px;' }, devName),
					E('div', { 'style': 'font-size: 11px; font-weight: 500; display: flex; flex-direction: column; gap: 2px;' }, [
						E('div', {}, [ E('span', { 'style': 'opacity: 0.7' }, 'Uptime: '), E('span', { 'id': 'uptime-' + iface.id_safe }, '0s') ]),
						E('div', {}, [ E('span', { 'style': 'opacity: 0.7' }, 'Downtime: '), E('span', { 'id': 'downtime-' + iface.id_safe }, 'N/A') ])
					])
				]),

				E('td', { 'style': 'padding: 15px; vertical-align: middle; color: #4CAF50; font-weight: bold;' }, [
					E('span', { 'id': 'rx-speed-' + iface.id_safe }, '0.00 bps')
				]),

				E('td', { 'style': 'padding: 15px; vertical-align: middle; color: #2196F3; font-weight: bold;' }, [
					E('span', { 'id': 'tx-speed-' + iface.id_safe }, '0.00 bps')
				]),

				E('td', { 'style': 'padding: 15px; vertical-align: middle; text-align: center;' }, [
					E('div', { 'id': 'chart-' + iface.id_safe })
				]),

				E('td', { 'style': 'padding: 15px; vertical-align: middle; font-size: 12px;' }, [
					E('div', { 'style': 'margin-bottom: 4px; color: #4CAF50;' }, [ '↓ ', E('span', { 'id': 'rx-total-' + iface.id_safe }, '0 B') ]),
					E('div', { 'style': 'color: #2196F3;' }, [ '↑ ', E('span', { 'id': 'tx-total-' + iface.id_safe }, '0 B') ])
				]),

				E('td', { 'style': 'padding: 15px; vertical-align: middle; font-weight: bold; text-align: center;' }, [
					E('div', { 'id': 'latency-' + iface.id_safe, 'style': 'margin-bottom: 5px;' }, 'Pinging...'),
					E('div', { 'id': 'lat-chart-' + iface.id_safe })
				])
			]);
			table.appendChild(row);
		});


		table.appendChild(E('tr', { 'style': 'background: rgba(255,255,255,0.05); font-weight: bold;' }, [
			E('td', { 'style': 'padding: 15px; border-top: 2px solid var(--border-color);' }, 'All WANs'),
			E('td', { 'style': 'padding: 15px; border-top: 2px solid var(--border-color); color: #4CAF50;' }, [ E('span', { 'id': 'rx-all' }, '0.00 bps') ]),
			E('td', { 'style': 'padding: 15px; border-top: 2px solid var(--border-color); color: #2196F3;' }, [ E('span', { 'id': 'tx-all' }, '0.00 bps') ]),
			E('td', { 'colspan': '3', 'style': 'border-top: 2px solid var(--border-color);' })
		]));

		container.appendChild(table);

		if (!window.wdPingInterval) {
			window.wdPingInterval = window.setInterval(function() {
				if (window.wdPingActive) return;
				window.wdPingActive = true;

				var devListStr = wanIfaces.map(function(i) { return i.l3_device || i.device || ''; })
					.filter(function(d) { return d !== ''; })
					.join(' ');
				
				if (!devListStr) {
					window.wdPingActive = false;
					return;
				}

				callPingAll(ipv4Target1, ipv4Target2, ipv6Target1, ipv6Target2, devListStr).then(function(results) {
					window.wdPingActive = false;
					var resObj = results || {};
					wanIfaces.forEach(function(iface) {
						var devName = iface.l3_device || iface.device || '';
						if (!devName || !resObj[devName]) return;
						
						var devState = resObj[devName];
						var latencyStr = devState.latency;
						iface.failCount = devState.failCount || 0;
						iface.offlineSince = devState.offlineSince || 0;
						
						var isTimeout = (latencyStr === 'N/A' || latencyStr === 'timeout');
						if (!isTimeout) {
							iface.lastLatency = parseFloat(latencyStr) || 0;
						}
					});
				}).catch(function() {
					window.wdPingActive = false;
				});
			}, 3000);
		}


		poll.add(function() {
			return Promise.all([
				callInterfaceDump(),
				callNetDevs()
			]).then(function(res) {
				var ifDump = Array.isArray(res[0]) ? res[0] : [];
				var nd = res[1] || {};
				var now = Date.now();
				var allRxRate = 0;
				var allTxRate = 0;

				wanIfaces.forEach(function(iface) {
					var currentIface = ifDump.find(function(i) { return i.interface === iface.interface; }) || {};
					if (currentIface.l3_device) iface.l3_device = currentIface.l3_device;
					if (currentIface.device) iface.device = currentIface.device;
					
					var devName = iface.l3_device || iface.device || '';
					var isUp = currentIface.up === true;
					var failCount = iface.failCount || 0;
					
					var dotEl = document.getElementById('dot-' + iface.id_safe);
					var upEl = document.getElementById('uptime-' + iface.id_safe);
					var downEl = document.getElementById('downtime-' + iface.id_safe);
					var latEl = document.getElementById('latency-' + iface.id_safe);
					var rowEl = document.getElementById('row-' + iface.id_safe);
					
					var state = 'ONLINE';
					if (!isUp || failCount > 3) state = 'OFFLINE';
					else if (failCount > 0) state = 'TIMEOUT';
					
					var curLatColor = '#4CAF50';
					var curLat = 0;
					
					if (state === 'ONLINE') {
						if (dotEl) dotEl.style.backgroundColor = '#4CAF50';
						if (latEl) {
							curLat = iface.lastLatency || 0;
							if (curLat >= 50) curLatColor = '#F44336';
							else if (curLat >= 15) curLatColor = '#FF9800';
							latEl.textContent = curLat + ' ms';
							latEl.style.color = curLatColor;
						}
					} else if (state === 'TIMEOUT') {
						if (dotEl) dotEl.style.backgroundColor = '#FF9800';
						if (latEl) {
							latEl.textContent = 'Timeout...';
							latEl.style.color = '#FF9800';
							curLatColor = '#FF9800';
							curLat = 100;
						}
					} else if (state === 'OFFLINE') {
						if (dotEl) dotEl.style.backgroundColor = '#F44336';
						if (latEl) {
							latEl.textContent = 'Offline';
							latEl.style.color = '#F44336';
							curLatColor = '#F44336';
							curLat = 100;
						}
					}
					
					currentLatency[iface.id_safe] = curLat;
					currentLatColor[iface.id_safe] = curLatColor;

					if (upEl && downEl) {
						if (state === 'OFFLINE') {
							upEl.textContent = 'N/A';
							upEl.style.color = '';
							
							var dt = 0;
							var offSinceUnix = iface.offlineSince || 0;
							if (offSinceUnix > 0) {
								dt = Math.floor(now / 1000) - offSinceUnix;
								if (dt < 0) dt = 0;
							}
							downEl.textContent = formatUptime(dt);
							downEl.style.color = '#F44336';
						} else {
							upEl.textContent = formatUptime(currentIface.uptime || 0);
							upEl.style.color = (state === 'TIMEOUT') ? '#FF9800' : '#4CAF50';
							downEl.textContent = 'N/A';
							downEl.style.color = '';
						}
					}

					var stats = nd[devName] ? nd[devName].statistics : null;
					var rxRate = 0, txRate = 0;
					var currentRxBytes = stats ? stats.rx_bytes : 0;
					var currentTxBytes = stats ? stats.tx_bytes : 0;

					var last = lastStats[iface.id_safe];
					if (last) {
						var dt = (now - last.time) / 1000;
						if (dt > 0) {
							rxRate = ((currentRxBytes - last.rx) * 8) / dt;
							txRate = ((currentTxBytes - last.tx) * 8) / dt;
							if (rxRate < 0) rxRate = 0;
							if (txRate < 0) txRate = 0;
						}
					}
					lastStats[iface.id_safe] = { rx: currentRxBytes, tx: currentTxBytes, time: now };

					var rSpeedEl = document.getElementById('rx-speed-' + iface.id_safe);
					var tSpeedEl = document.getElementById('tx-speed-' + iface.id_safe);
					var rTotEl = document.getElementById('rx-total-' + iface.id_safe);
					var tTotEl = document.getElementById('tx-total-' + iface.id_safe);
					var svgEl = document.getElementById('chart-' + iface.id_safe);
					var latSvgEl = document.getElementById('lat-chart-' + iface.id_safe);

					if (rSpeedEl) rSpeedEl.textContent = formatSpeed(rxRate);
					if (tSpeedEl) tSpeedEl.textContent = formatSpeed(txRate);
					if (rTotEl) rTotEl.textContent = formatSize(currentRxBytes);
					if (tTotEl) tTotEl.textContent = formatSize(currentTxBytes);


					var h = historyData[iface.id_safe];
					h.rx.shift(); h.rx.push(rxRate);
					h.tx.shift(); h.tx.push(txRate);
					var curLatCol = currentLatColor[iface.id_safe] || '#4CAF50';
					h.lat.shift(); h.lat.push(curLat);
					
					drawChart(svgEl, h.rx, h.tx);
					drawLatChart(latSvgEl, h.lat, curLatCol);

					allRxRate += rxRate;
					allTxRate += txRate;
				});
				
				var rxAllEl = document.getElementById('rx-all');
				var txAllEl = document.getElementById('tx-all');
				if (rxAllEl) rxAllEl.textContent = formatSpeed(allRxRate);
				if (txAllEl) txAllEl.textContent = formatSpeed(allTxRate);
			});
		}, 1);

		return container;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
