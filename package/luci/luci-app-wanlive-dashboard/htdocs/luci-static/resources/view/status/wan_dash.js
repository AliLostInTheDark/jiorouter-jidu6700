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

function drawChart(svgEl, rxHistory, txHistory, id) {
	if (!svgEl) return;
	var maxTxRx = 1024;
	for (var i=0; i<rxHistory.length; i++) {
		if (rxHistory[i] > maxTxRx) maxTxRx = rxHistory[i];
		if (txHistory[i] > maxTxRx) maxTxRx = txHistory[i];
	}

	var width = 160;
	var height = 40;
	
	var rxPath = createSmoothPath(rxHistory, width, height, maxTxRx);
	var txPath = createSmoothPath(txHistory, width, height, maxTxRx);
	
	var rxFill = rxPath + ' L ' + width + ',' + height + ' L 0,' + height + ' Z';
	var txFill = txPath + ' L ' + width + ',' + height + ' L 0,' + height + ' Z';
	
	var defs = '<defs>' +
		'<linearGradient id="gradRx-' + id + '" x1="0%" y1="0%" x2="0%" y2="100%">' +
		'<stop offset="0%" stop-color="var(--rx-color)" stop-opacity="0.8" />' +
		'<stop offset="100%" stop-color="var(--rx-color)" stop-opacity="0.1" />' +
		'</linearGradient>' +
		'<linearGradient id="gradTx-' + id + '" x1="0%" y1="0%" x2="0%" y2="100%">' +
		'<stop offset="0%" stop-color="var(--tx-color)" stop-opacity="0.8" />' +
		'<stop offset="100%" stop-color="var(--tx-color)" stop-opacity="0.1" />' +
		'</linearGradient>' +
		'</defs>';

	svgEl.innerHTML = '<svg class="chart-svg" viewBox="0 0 160 40" preserveAspectRatio="none" style="width: 100%; height: 40px; min-width: 60px; background: transparent;">' +
		defs +
		'<path d="' + rxFill + '" fill="url(#gradRx-' + id + ')" stroke="none"/>' +
		'<path d="' + txFill + '" fill="url(#gradTx-' + id + ')" stroke="none"/>' +
		'</svg>';
}

function drawLatChart(svgEl, latHistory, color, id) {
	if (!svgEl) return;
	var maxLat = 100;
	for (var i=0; i<latHistory.length; i++) {
		if (latHistory[i] > maxLat) maxLat = latHistory[i];
	}

	var width = 160;
	var height = 40;
	
	var path = createSmoothPath(latHistory, width, height, maxLat);
	var fillPath = path + ' L ' + width + ',' + height + ' L 0,' + height + ' Z';
	
	var defs = '<defs>' +
		'<linearGradient id="gradLat-' + id + '" x1="0%" y1="0%" x2="0%" y2="100%">' +
		'<stop offset="0%" stop-color="' + color + '" stop-opacity="0.8" />' +
		'<stop offset="100%" stop-color="' + color + '" stop-opacity="0.1" />' +
		'</linearGradient>' +
		'</defs>';
	
	svgEl.innerHTML = '<svg class="chart-svg" viewBox="0 0 160 40" preserveAspectRatio="none" style="width: 100%; height: 40px; min-width: 60px; background: transparent;">' +
		defs +
		'<path d="' + fillPath + '" fill="url(#gradLat-' + id + ')" stroke="none"/>' +
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
			
			var hiddenIfacesStr = uci.get('wandash', 'settings', 'hidden_ifaces') || '';
			var hiddenIfaces = hiddenIfacesStr.split(' ').filter(function(x) { return x.length > 0; });
			
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
				return validNets.indexOf(i.interface) !== -1 && hiddenIfaces.indexOf(i.interface) === -1;
			});
			
			var mappedIfaces = targetIfaces.map(function(i) {
				i.display_name = i.interface;
				i.id_safe = i.interface.replace(/[^a-zA-Z0-9_-]/g, '_');
				return i;
			});

			return {
				targetIfaces: mappedIfaces,
				allIfaces: interfaces,
				hiddenIfaces: hiddenIfaces
			};
		});
	},

	render: function(data) {
		var wanIfaces = data.targetIfaces;
		var allIfaces = data.allIfaces;
		var hiddenIfaces = data.hiddenIfaces;

		var ipv4Target1 = uci.get('wandash', 'settings', 'ipv4_target') || '1.1.1.1';
		var ipv4Target2 = uci.get('wandash', 'settings', 'ipv4_target2') || '8.8.8.8';
		var ipv6Target1 = uci.get('wandash', 'settings', 'ipv6_target') || '2606:4700:4700::1111';
		var ipv6Target2 = uci.get('wandash', 'settings', 'ipv6_target2') || '2001:4860:4860::8888';

		var settingsBtn = E('button', {
			'class': 'btn cbi-button-action',
			'style': 'float: right; margin-top: 5px;',
			'click': function() {
				var inp4_1 = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'value': ipv4Target1 });
				var inp4_2 = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'value': ipv4Target2 });
				var inp6_1 = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'value': ipv6Target1 });
				var inp6_2 = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'value': ipv6Target2 });
				
				var choices = {};
				allIfaces.forEach(function(i) {
					if (i.interface !== 'loopback' && i.interface !== 'lan') {
						choices[i.interface] = i.interface;
					}
				});
				var drop = new ui.Dropdown(hiddenIfaces, choices, { multiple: true, placeholder: _('Select interfaces to hide') });

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
						]),
						E('div', { 'class': 'cbi-value' }, [
							E('label', { 'class': 'cbi-value-title' }, _('Hidden Interfaces')),
							E('div', { 'class': 'cbi-value-field' }, drop.render())
						])
					]),
					E('div', { 'class': 'right' }, [
						E('button', { 'class': 'btn cbi-button', 'click': ui.hideModal }, _('Cancel')),
						' ',
						E('button', { 'class': 'btn cbi-button cbi-button-action', 'click': function() {
							var val = drop.getValue();
							var hiddenStr = Array.isArray(val) ? val.join(' ') : (val || '');
							uci.set('wandash', 'settings', 'ipv4_target', inp4_1.value);
							uci.set('wandash', 'settings', 'ipv4_target2', inp4_2.value);
							uci.set('wandash', 'settings', 'ipv6_target', inp6_1.value);
							uci.set('wandash', 'settings', 'ipv6_target2', inp6_2.value);
							uci.set('wandash', 'settings', 'hidden_ifaces', hiddenStr);
							uci.save().then(function() { return uci.apply(); }).then(function() {
								window.location.reload();
							});
						}}, _('Save & Apply'))
					])
				]);
			}
		}, '⚙ Settings');

		var styleEl = E('style', {}, 
			'#cbi-wan-dashboard { --rx-color: #388e3c; --tx-color: #1976d2; }\n' +
			'@media (prefers-color-scheme: dark) { #cbi-wan-dashboard { --rx-color: #4caf50; --tx-color: #2196f3; } }\n' +
			'#cbi-wan-dashboard .center-pc { text-align: center; }\n' +
			'#cbi-wan-dashboard .left-pc { text-align: left; }\n' +
			'#cbi-wan-dashboard .chart-svg { display: block; margin: 0 auto; }\n' +
			'#cbi-wan-dashboard .chart-container { width: 100%; }\n' +
			'@media (max-width: 768px) {\n' +
			'  #cbi-wan-dashboard .center-pc { text-align: left !important; }\n' +
			'  #cbi-wan-dashboard .chart-svg { margin: 0 !important; }\n' +
			'  #cbi-wan-dashboard table { border: none !important; box-shadow: none !important; background: transparent !important; }\n' +
			'  #cbi-wan-dashboard thead { display: none; }\n' +
			'  #cbi-wan-dashboard tbody { display: flex; flex-direction: column; gap: 15px; }\n' +
			'  #cbi-wan-dashboard .wd-data-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: rgba(128,128,128,0.03) !important; border: 1px solid var(--border-color); border-radius: 8px; padding: 15px; }\n' +
			'  #cbi-wan-dashboard .wd-footer-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: rgba(128,128,128,0.03) !important; border: 1px solid var(--border-color); border-radius: 8px; padding: 15px; }\n' +
			'  #cbi-wan-dashboard td { display: flex; flex-direction: column; justify-content: center; padding: 0 !important; border: none !important; text-align: left !important; }\n' +
			'  #cbi-wan-dashboard .wd-data-row td:nth-child(1) { grid-column: 1 / -1; border-bottom: 1px dashed rgba(128,128,128,0.2) !important; padding-bottom: 15px !important; margin-bottom: 5px; }\n' +
			'  #cbi-wan-dashboard .wd-data-row td:nth-child(2) { align-items: center; text-align: center !important; }\n' +
			'  #cbi-wan-dashboard .wd-data-row td:nth-child(3) { align-items: center; text-align: center !important; }\n' +
			'  #cbi-wan-dashboard .wd-data-row td:nth-child(4) { grid-column: 1 / -1; align-items: center; text-align: center !important; }\n' +
			'  #cbi-wan-dashboard .wd-data-row td:nth-child(5) { grid-column: 1 / -1; align-items: center; text-align: center !important; }\n' +
			'  #cbi-wan-dashboard .wd-data-row td:nth-child(6) { grid-column: 1 / -1; align-items: center; text-align: center !important; }\n' +
			'  #cbi-wan-dashboard .wd-footer-row td:nth-child(1) { grid-column: 1 / -1; border-bottom: 1px dashed rgba(128,128,128,0.2) !important; padding-bottom: 10px !important; margin-bottom: 5px; }\n' +
			'  #cbi-wan-dashboard .wd-footer-row td:nth-child(2) { grid-column: 1 / 2; }\n' +
			'  #cbi-wan-dashboard .wd-footer-row td:nth-child(3) { grid-column: 2 / 3; }\n' +
			'  #cbi-wan-dashboard .wd-footer-row td:nth-child(4) { display: none !important; }\n' +
			'  #cbi-wan-dashboard td::before { content: attr(data-title); font-size: 11px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-weight: bold; display: block; }\n' +
			'  #cbi-wan-dashboard td:nth-child(1)::before { display: none; }\n' +
			'  #cbi-wan-dashboard .total-data-wrapper { align-items: center !important; justify-content: center !important; flex-direction: row !important; gap: 20px !important; }\n' +
			'  #cbi-wan-dashboard .total-data-wrapper > div { margin-bottom: 0 !important; }\n' +
			'  #cbi-wan-dashboard td > div { text-align: left; width: 100%; }\n' +
			'}'
		);

		var container = E('div', { 'class': 'cbi-map', 'id': 'cbi-wan-dashboard' }, [
			styleEl,
			settingsBtn,
			E('h2', { 'style': 'font-weight: 400; margin-bottom: 5px; color: var(--text);' }, 'WAN Live Traffic'),
			E('div', { 'style': 'font-size: 13px; opacity: 0.8; margin-bottom: 20px;' }, 
				'Live per-WAN byte throughput (updates every 500ms). WAN uplinks are detected automatically. Green = download, Blue = upload.')
		]);

		if (wanIfaces.length === 0) {
			container.appendChild(E('div', { 'class': 'alert-message warning' }, 'No WAN interfaces found or all are hidden.'));
			return container;
		}

		var table = E('table', { 'class': 'table', 'style': 'width: 100%; border-collapse: collapse; background: transparent; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);' }, [
			E('thead', {}, [
				E('tr', { 'style': 'border-bottom: 1px solid var(--border-color); background: rgba(128,128,128,0.05);' }, [
					E('th', { 'class': 'left-pc', 'style': 'padding: 15px; width: 20%; font-weight: bold;' }, 'WAN uplink'),
					E('th', { 'class': 'center-pc', 'style': 'padding: 15px; width: 13%; font-weight: bold;' }, '↓ Download'),
					E('th', { 'class': 'center-pc', 'style': 'padding: 15px; width: 13%; font-weight: bold;' }, '↑ Upload'),
					E('th', { 'class': 'center-pc', 'style': 'padding: 15px; width: 20%; font-weight: bold;' }, 'Activity'),
					E('th', { 'class': 'center-pc', 'style': 'padding: 15px; width: 18%; font-weight: bold;' }, 'Total Data'),
					E('th', { 'class': 'center-pc', 'style': 'padding: 15px; width: 16%; font-weight: bold;' }, 'Latency')
				])
			]),
			E('tbody', { 'id': 'wd-tbody' })
		]);

		var tbody = table.querySelector('tbody');

		wanIfaces.forEach(function(iface, index) {
			var devName = iface.l3_device || iface.device || '';
			historyData[iface.id_safe] = { rx: Array(60).fill(0), tx: Array(60).fill(0), lat: Array(60).fill(0) };
			currentLatency[iface.id_safe] = 0;
			currentLatColor[iface.id_safe] = 'var(--rx-color)';
			
			var isAlt = index % 2 === 1;
			var rowBg = isAlt ? 'rgba(128,128,128,0.02)' : 'transparent';
			
			var row = E('tr', { 'class': 'wd-data-row', 'style': 'border-bottom: 1px solid var(--border-color); background: ' + rowBg + '; transition: background 0.3s;', 'id': 'row-' + iface.id_safe }, [
				E('td', { 'data-title': 'Interface', 'style': 'padding: 15px; vertical-align: top;' }, [
					E('div', { 'style': 'display: flex; align-items: center; gap: 8px; font-weight: bold; font-size: 14px; margin-bottom: 4px;' }, [
						E('div', { 'id': 'dot-' + iface.id_safe, 'style': 'width: 10px; height: 10px; border-radius: 50%; background: var(--rx-color); transition: background 0.3s;' }),
						iface.display_name
					]),
					E('div', { 'style': 'font-size: 11px; opacity: 0.6; margin-bottom: 4px;' }, devName),
					E('div', { 'style': 'font-size: 11px; font-weight: 500; display: flex; flex-direction: column; gap: 2px;' }, [
						E('div', {}, [ E('span', { 'style': 'opacity: 0.7' }, 'Uptime: '), E('span', { 'id': 'uptime-' + iface.id_safe }, '0s') ]),
						E('div', {}, [ E('span', { 'style': 'opacity: 0.7' }, 'Downtime: '), E('span', { 'id': 'downtime-' + iface.id_safe }, 'N/A') ])
					])
				]),
				E('td', { 'class': 'center-pc', 'data-title': '↓ Download', 'style': 'padding: 15px; vertical-align: middle; color: var(--rx-color); font-weight: bold;' }, [
					E('span', { 'id': 'rx-speed-' + iface.id_safe }, '0.00 bps')
				]),
				E('td', { 'class': 'center-pc', 'data-title': '↑ Upload', 'style': 'padding: 15px; vertical-align: middle; color: var(--tx-color); font-weight: bold;' }, [
					E('span', { 'id': 'tx-speed-' + iface.id_safe }, '0.00 bps')
				]),
				E('td', { 'class': 'center-pc', 'data-title': 'Activity', 'style': 'padding: 15px; vertical-align: middle;' }, [
					E('div', { 'id': 'chart-' + iface.id_safe, 'style': 'width: 100%;' })
				]),
				E('td', { 'class': 'center-pc', 'data-title': 'Total Data', 'style': 'padding: 15px; vertical-align: middle; font-size: 12px;' }, [
					E('div', { 'class': 'total-data-wrapper', 'style': 'display: flex; flex-direction: column; align-items: center;' }, [
						E('div', { 'style': 'margin-bottom: 4px; color: var(--rx-color);' }, [ '↓ ', E('span', { 'id': 'rx-total-' + iface.id_safe }, '0 B') ]),
						E('div', { 'style': 'color: var(--tx-color);' }, [ '↑ ', E('span', { 'id': 'tx-total-' + iface.id_safe }, '0 B') ])
					])
				]),
				E('td', { 'class': 'center-pc', 'data-title': 'Latency', 'style': 'padding: 15px; vertical-align: middle; font-weight: bold;' }, [
					E('div', { 'id': 'latency-' + iface.id_safe, 'style': 'margin-bottom: 5px;' }, 'Pinging...'),
					E('div', { 'id': 'lat-chart-' + iface.id_safe, 'style': 'width: 100%;' })
				])
			]);
			tbody.appendChild(row);
		});

		tbody.appendChild(E('tr', { 'class': 'wd-footer-row', 'style': 'background: rgba(128,128,128,0.05); font-weight: bold;' }, [
			E('td', { 'data-title': 'Total WAN', 'class': 'left-pc', 'style': 'padding: 15px; border-top: 2px solid var(--border-color);' }, 'All WANs'),
			E('td', { 'data-title': '↓ Total', 'class': 'center-pc', 'style': 'padding: 15px; border-top: 2px solid var(--border-color); color: var(--rx-color);' }, [ E('span', { 'id': 'rx-all' }, '0.00 bps') ]),
			E('td', { 'data-title': '↑ Total', 'class': 'center-pc', 'style': 'padding: 15px; border-top: 2px solid var(--border-color); color: var(--tx-color);' }, [ E('span', { 'id': 'tx-all' }, '0.00 bps') ]),
			E('td', { 'colspan': '3', 'style': 'border-top: 2px solid var(--border-color);' })
		]));

		var tableWrapper = E('div', { 'style': 'width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 20px;' }, [
			table
		]);
		container.appendChild(tableWrapper);

		if (!window.wdPingInterval) {
			window.wdPingInterval = window.setInterval(function() {
				if (window.wdPingActive) return;
				window.wdPingActive = true;

				var devListStr = wanIfaces.map(function(i) { return i.interface || ''; })
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
						var devName = iface.interface || '';
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
			}, 500);
		}

		if (window.wdDataInterval) {
			window.clearInterval(window.wdDataInterval);
		}
		window.wdDataInterval = window.setInterval(function() {
			if (window.wdDataActive) return;
			window.wdDataActive = true;
			
			Promise.all([
				callInterfaceDump(),
				callNetDevs()
			]).then(function(res) {
				window.wdDataActive = false;
				var ifDump = Array.isArray(res[0]) ? res[0] : [];
				var nd = res[1] || {};
				var now = Date.now();
				var allRxRate = 0;
				var allTxRate = 0;
				var seenDevs = {};

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
					
					var state = 'ONLINE';
					if (!isUp || failCount > 3) state = 'OFFLINE';
					else if (failCount > 0) state = 'TIMEOUT';
					
					var curLatColor = 'var(--rx-color)';
					var curLat = 0;
					
					if (state === 'ONLINE') {
						if (dotEl) dotEl.style.backgroundColor = 'var(--rx-color)';
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
							upEl.style.color = (state === 'TIMEOUT') ? '#FF9800' : 'var(--rx-color)';
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

					var P = 120; // Keep 120 points of history (1 minute)
					var h = historyData[iface.id_safe];
					h.rx.shift(); h.rx.push(rxRate);
					h.tx.shift(); h.tx.push(txRate);
					var curLatCol = currentLatColor[iface.id_safe] || 'var(--rx-color)';
					h.lat.shift(); h.lat.push(curLat);
					
					drawChart(svgEl, h.rx, h.tx, iface.id_safe);
					drawLatChart(latSvgEl, h.lat, curLatCol, iface.id_safe);
					
					if (devName && !seenDevs[devName]) {
						allRxRate += rxRate;
						allTxRate += txRate;
						seenDevs[devName] = true;
					}
				});
				
				var rxAllEl = document.getElementById('rx-all');
				var txAllEl = document.getElementById('tx-all');
				if (rxAllEl) rxAllEl.textContent = formatSpeed(allRxRate);
				if (txAllEl) txAllEl.textContent = formatSpeed(allTxRate);
			}).catch(function() {
				window.wdDataActive = false;
			});
		}, 500);

		return container;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
