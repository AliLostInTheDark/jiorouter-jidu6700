'use strict';
'require view';
'require poll';
'require rpc';

var callHwInfo = rpc.declare({
	object: 'luci.hwdash',
	method: 'info',
	expect: {}
});

return view.extend({
	prevCpu: {},
	prevDisk: {},

	load: function() {
		return Promise.resolve();
	},

	render: function() {
		var container = E('div', { id: 'hw-dashboard', class: 'hw-dashboard' });


		var style = E('style', {}, `
			.hw-dashboard {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
				gap: 20px;
				font-family: system-ui, -apple-system, sans-serif;
				width: 100%;
				max-width: 100%;
				overflow: hidden;
			}
			.hw-dashboard * {
				box-sizing: border-box;
			}
			.hw-thermals-container {
				display: flex; flex-direction: row; width: 100%; height: 100%;
			}
			.hw-thermals-col { flex: 1; }
			.hw-thermals-col-left { padding-right: 15px; }
			.hw-thermals-col-mid { padding: 0 15px; }
			.hw-thermals-col-right { padding-left: 15px; }
			.hw-thermals-title { font-size: 0.85em; opacity: 0.6; margin-bottom: 10px; text-align: center; }
			.hw-thermals-divider {
				width: 1px; background: var(--border-color, rgba(128,128,128,0.2)); margin: 10px 15px 30px 15px;
			}
			@media (max-width: 768px) {
				.hw-thermals-container { flex-direction: column; }
				.hw-thermals-col { padding: 0 !important; }
				.hw-thermals-divider { width: auto; height: 1px; margin: 25px 0; }
			}
			.hw-meta-grid {
				margin-top: 15px; font-size: 0.8em; color: currentColor; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; opacity: 0.8; width: 75%; margin-left: auto; margin-right: auto;
			}
			@media (max-width: 480px) {
				.hw-meta-grid { width: 100%; font-size: 0.75em; }
				.hw-dial { transform: scale(0.9); }
				.hw-card { padding: 15px; }
			}
			.hw-card {
				background: var(--background-color-high, rgba(128, 128, 128, 0.05));
				border: 1px solid var(--border-color, rgba(128, 128, 128, 0.2));
				border-radius: 12px;
				padding: 25px;
				display: flex;
				flex-direction: column;
				align-items: center;
				color: var(--text-color, inherit);
				box-shadow: 0 4px 10px rgba(0,0,0,0.1);
				height: 100%;
				max-width: 100%;
				overflow: hidden;
			}
			.hw-card.wide {
				grid-column: 1 / -1;
				align-items: stretch;
			}
			.hw-card h3 {
				margin: 0 0 20px 0;
				font-size: 1.1em;
				color: var(--text-color, inherit);
				opacity: 0.8;
				text-transform: uppercase;
				letter-spacing: 1px;
				text-align: center;
			}
			.hw-dial {
				position: relative;
				width: 160px;
				height: 160px;
				display: flex;
				align-items: center;
				justify-content: center;
				margin: 0 auto;
			}
			.hw-dial svg {
				position: absolute;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				transform: rotate(-90deg);
			}
			.hw-dial-bg {
				fill: none;
				stroke: rgba(128, 128, 128, 0.2);
				stroke-width: 10;
			}
			.hw-dial-progress {
				fill: none;
				stroke-width: 10;
				stroke-linecap: round;
				transition: stroke-dasharray 0.5s ease;
			}
			.hw-dial-text {
				font-size: 2.2em;
				font-weight: 600;
				z-index: 1;
			}
			.hw-dial-subtext {
				position: absolute;
				bottom: 25px;
				font-size: 0.9em;
				opacity: 0.7;
				z-index: 1;
			}
			.hw-stats-list {
				width: 100%;
				margin-top: 30px;
				display: flex;
				flex-direction: column;
				gap: 12px;
			}
			.hw-stats-grid {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 12px 30px;
				width: 100%;
			}
			.hw-stat-row {
				display: flex;
				justify-content: space-between;
				align-items: center;
				width: 100%;
				margin-bottom: 8px;
			}
			.hw-stat-label { 
				opacity: 0.8; 
				font-size: 0.95em; 
				white-space: nowrap; 
				overflow: hidden; 
				text-overflow: ellipsis; 
				min-width: 0; 
				flex-shrink: 1; 
				margin-right: 10px; 
			}
			.hw-stat-value { 
				font-weight: bold; 
				font-size: 0.95em; 
				white-space: nowrap; 
				flex-shrink: 0; 
			}
			.hw-progress-item {
				display: flex;
				flex-direction: column;
				margin-bottom: 15px;
				width: 100%;
			}
			.hw-progress-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 6px;
				width: 100%;
				min-width: 0;
			}
			.hw-bar-bg {
				width: 100%;
				height: 6px;
				background: var(--border-color, rgba(128, 128, 128, 0.2));
				border-radius: 3px;
				overflow: hidden;
				margin-top: 6px;
			}
			.hw-bar-fill {
				height: 100%;
				transition: width 0.5s ease;
			}
			.hw-temp-badge {
				padding: 4px 10px;
				border-radius: 6px;
				font-weight: 600;
				font-size: 0.9em;
				white-space: nowrap;
			}
		`);

		var getDynColor = function(pct, invert) {
			if (invert === true) {
				if (pct >= 40) return '#00bcd4';
				if (pct >= 20) return '#ffea00';
				return '#ff1744';
			}
			if (pct < 60) return '#00bcd4';
			if (pct < 80) return '#ffea00';
			return '#ff1744';
		};

		var updateDial = function(id, pct, circ) {
			var dash = (pct / 100) * circ;
			var prog = document.getElementById('dial-prog-' + id);
			if (prog) {
				prog.style.strokeDasharray = dash + ' ' + circ;
				prog.style.stroke = getDynColor(pct);
			}
			var txt = document.getElementById('dial-txt-' + id);
			if (txt) {
				txt.textContent = Math.round(pct) + '%';
				txt.style.fill = getDynColor(pct);
				txt.style.color = getDynColor(pct);
			}
		};

		var createDial = function(id, title) {
			var radius = 70;
			var circumference = 2 * Math.PI * radius;
			
			var svgContainer = E('div', { id: 'dial-svg-' + id, style: 'position:absolute; top:0; left:0; width:100%; height:100%;' });
			svgContainer.innerHTML = '<svg viewBox="0 0 160 160"><circle class="hw-dial-bg" cx="80" cy="80" r="' + radius + '"/><circle id="dial-prog-' + id + '" class="hw-dial-progress" cx="80" cy="80" r="' + radius + '" style="stroke: #00bcd4; stroke-dasharray: 0 ' + circumference + ';"/></svg>';

			var card = E('div', { class: 'hw-card' }, [
				E('h3', { id: 'title-' + id }, title),
				E('div', { class: 'hw-dial' }, [
					svgContainer,
					E('div', { id: 'dial-txt-' + id, class: 'hw-dial-text' }, '0%'),
					E('div', { id: 'dial-sub-' + id, class: 'hw-dial-subtext' }, '')
				]),
				E('div', { id: 'stats-' + id, class: 'hw-stats-list' })
			]);
			return { node: card, circ: circumference };
		};

		var cpuCard = createDial('cpu', 'CPU');
		var ramCard = createDial('ram', 'MEMORY');
		var dskCard = createDial('dsk', 'STORAGE');

		var coresNode = E('div', { id: 'hw-cores', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0;' });
		cpuCard.node.appendChild(E('h4', { style: 'text-align: center; font-size: 0.85em; opacity: 0.7; letter-spacing: 1px; margin: 15px 0 10px 0; text-transform: uppercase;' }, 'PER-CORE USAGE'));
		cpuCard.node.appendChild(coresNode);
		
		cpuCard.node.appendChild(E('div', { style: 'width: 100%; height: 1px; background: var(--border-color, rgba(128,128,128,0.2)); margin: 15px 0;' }));
		cpuCard.node.appendChild(E('h4', { style: 'text-align: center; font-size: 0.85em; opacity: 0.7; letter-spacing: 1px; margin: 0 0 10px 0; text-transform: uppercase;' }, 'SYSTEM STATUS'));
		var cpuMetaNode = E('div', { id: 'hw-cpu-meta', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0;' });
		cpuCard.node.appendChild(cpuMetaNode);

		var advCard = E('div', { class: 'hw-card', style: 'justify-content: flex-start;' }, [
			E('h3', {}, 'CPU Detailed Load'),
			E('div', { id: 'hw-adv', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0;' }),
			E('div', { style: 'width: 100%; height: 1px; background: var(--border-color, rgba(128,128,128,0.2)); margin: 15px 0;' }),
			E('h3', { style: 'margin-top: 0;' }, 'Hardware Links'),
			E('div', { id: 'hw-eth-links', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0; display: flex; flex-direction: column; gap: 8px;' })
		]);

		var thermCard = E('div', { class: 'hw-card wide', style: 'justify-content: flex-start;' }, [
			E('h3', {}, 'Thermal Sensors'),
			E('div', { class: 'hw-thermals-container' }, [
				E('div', { class: 'hw-thermals-col hw-thermals-col-left' }, [
					E('div', { class: 'hw-thermals-title' }, 'CPU'),
					E('div', { id: 'hw-thermals-cpu', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0;' })
				]),
				E('div', { id: 'hw-thermals-divider-wifi', class: 'hw-thermals-divider' }),
				E('div', { id: 'hw-thermals-col-wifi', class: 'hw-thermals-col hw-thermals-col-mid' }, [
					E('div', { class: 'hw-thermals-title' }, 'Wi-Fi'),
					E('div', { id: 'hw-thermals-wifi', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0;' })
				]),
				E('div', { id: 'hw-thermals-divider-misc', class: 'hw-thermals-divider' }),
				E('div', { id: 'hw-thermals-col-misc', class: 'hw-thermals-col hw-thermals-col-right' }, [
					E('div', { class: 'hw-thermals-title' }, 'MISCELLANEOUS'),
					E('div', { id: 'hw-thermals-misc', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0;' })
				])
			])
		]);

		container.appendChild(style);
		container.appendChild(cpuCard.node);
		container.appendChild(ramCard.node);
		container.appendChild(dskCard.node);
		container.appendChild(advCard);
		container.appendChild(thermCard);

		var usbCard = E('div', { class: 'hw-card', style: 'justify-content: flex-start;' }, [
			E('h3', {}, 'USB Devices'),
			E('div', { id: 'hw-usb-devs', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0; display: flex; flex-direction: column; gap: 8px;' })
		]);
		container.appendChild(usbCard);

		var wifiCard = E('div', { class: 'hw-card', style: 'justify-content: flex-start;' }, [
			E('h3', {}, 'Wi-Fi PHY Status'),
			E('div', { id: 'hw-wifi-radios', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0; display: flex; flex-direction: column; gap: 8px;' })
		]);
		container.appendChild(wifiCard);

		var self = this;

		var parseCpu = function(line) {
			var parts = line.trim().split(/\s+/);
			var name = parts[0];
			var user = parseInt(parts[1]) || 0;
			var nice = parseInt(parts[2]) || 0;
			var sys = parseInt(parts[3]) || 0;
			var idle = parseInt(parts[4]) || 0;
			var iowait = parseInt(parts[5]) || 0;
			var irq = parseInt(parts[6]) || 0;
			var softirq = parseInt(parts[7]) || 0;

			var idleAll = idle + iowait;
			var systemAll = sys + irq + softirq;
			var virtAll = 0;
			var total = user + nice + systemAll + idleAll + virtAll;
			return { 
				name: name, total: total, idleAll: idleAll,
				user: user, nice: nice, sys: sys, idle: idle,
				iowait: iowait, irq: irq, softirq: softirq
			};
		};

		poll.add(function() {
			return callHwInfo().then(function(res) {
				if (!res || !res.cpus) return;


				var coresNode = document.getElementById('hw-cores');
				coresNode.innerHTML = '';
				var advStats = null;

				res.cpus.forEach(function(cpuLine) {
					var stat = parseCpu(cpuLine);
					if (self.prevCpu[stat.name]) {
						var prev = self.prevCpu[stat.name];
						var totalDiff = stat.total - prev.total;
						var idleDiff = stat.idleAll - prev.idleAll;
						var pct = 0;
						if (totalDiff > 0) {
							pct = 100 * (totalDiff - idleDiff) / totalDiff;
						}
						pct = Math.max(0, Math.min(100, pct));

						if (stat.name === 'cpu') {
							var pctRound = Math.round(pct);
							updateDial('cpu', pctRound, cpuCard.circ);
							document.getElementById('dial-sub-cpu').textContent = (res.cpus.length - 1) + ' Cores';

							var calcPct = function(key) {
								return totalDiff > 0 ? ((stat[key] - prev[key]) / totalDiff) * 100 : 0;
							};

							advStats = {
								Idle: calcPct('idle'),
								User: calcPct('user'),
								Nice: calcPct('nice'),
								System: calcPct('sys'),
								'I/O Wait': calcPct('iowait'),
								IRQ: calcPct('irq'),
								'Soft IRQ': calcPct('softirq')
							};
							
							var cpuStats = document.getElementById('stats-cpu');
							cpuStats.innerHTML = '';
							var meta = res.cpu_meta || {};
							var addMeta = function(label, val) {
								cpuStats.appendChild(E('div', { class: 'hw-stat-row', style: 'margin-bottom: 2px;' }, [
									E('span', { class: 'hw-stat-label' }, label),
									E('span', { class: 'hw-stat-value' }, val)
								]));
							};

							addMeta('Physical Cores', meta.cores || (res.cpus.length - 1));
							if (meta.threads && meta.threads !== meta.cores) {
								addMeta('Logical Threads', meta.threads);
							}
							
							var curFreq = '';
							if (res.freqs && res.freqs.length > 0) {
								var validFreqs = res.freqs.filter(function(f) { return f !== null; });
								if (validFreqs.length > 0) {
									var maxC = Math.max.apply(null, validFreqs);
									if (maxC > 1000000) curFreq = (maxC / 1000000).toFixed(2) + ' GHz';
									else if (maxC > 1000) curFreq = (maxC / 1000).toFixed(0) + ' MHz';
									else curFreq = maxC + ' MHz';
								}
							}
							
							var maxFreqStr = '';
							if (meta.max_freq && meta.max_freq > 0) {
								if (meta.max_freq > 1000000) maxFreqStr = (meta.max_freq / 1000000).toFixed(2) + ' GHz';
								else maxFreqStr = (meta.max_freq / 1000).toFixed(0) + ' MHz';
							}

							if (curFreq) addMeta('Current Freq', curFreq);
							if (maxFreqStr) addMeta('Max Freq', maxFreqStr);
							if (meta.tasks) addMeta('Tasks (Run/Total)', meta.tasks);
							
							var uptimeStr = '';
							if (res.uptime) {
								var days = Math.floor(res.uptime / 86400);
								var hours = Math.floor((res.uptime % 86400) / 3600);
								var mins = Math.floor((res.uptime % 3600) / 60);
								if (days > 0) uptimeStr += days + 'd ';
								if (hours > 0 || days > 0) uptimeStr += hours + 'h ';
								uptimeStr += mins + 'm';
							}

							var metaNode = document.getElementById('hw-cpu-meta');
							if (metaNode) {
								metaNode.innerHTML = '';
								metaNode.appendChild(E('div', { class: 'hw-stat-row' }, [
									E('span', { class: 'hw-stat-label' }, 'Load Average'),
									E('span', { class: 'hw-stat-value' }, (res.cpu_meta.load_1 || '0') + ', ' + (res.cpu_meta.load_5 || '0') + ', ' + (res.cpu_meta.load_15 || '0'))
								]));
								if (res.cpu_meta.governor) {
									metaNode.appendChild(E('div', { class: 'hw-stat-row' }, [
										E('span', { class: 'hw-stat-label' }, 'CPU Governor'),
										E('span', { class: 'hw-stat-value', style: 'text-transform: uppercase;' }, res.cpu_meta.governor)
									]));
								}
								metaNode.appendChild(E('div', { class: 'hw-stat-row' }, [
									E('span', { class: 'hw-stat-label' }, 'Uptime'),
									E('span', { class: 'hw-stat-value' }, uptimeStr)
								]));
							}
						} else {
							var coreIdx = parseInt(stat.name.replace('cpu', ''));
							var freqStr = '';
							if (res.freqs && res.freqs[coreIdx] && res.freqs[coreIdx] !== null) {
								var mhz = Math.round(res.freqs[coreIdx] / 1000);
								freqStr = mhz + ' MHz | ';
							}

							var coreName = stat.name.toUpperCase().replace('CPU', 'CORE ');
							var colorCore = getDynColor(pct);
							var coreRow = E('div', { class: 'hw-progress-item' }, [
								E('div', { class: 'hw-progress-header' }, [
									E('span', { class: 'hw-stat-label' }, coreName),
									E('span', { class: 'hw-stat-value', style: `color: ${colorCore};` }, freqStr + pct.toFixed(2) + '%')
								]),
								E('div', { class: 'hw-bar-bg' }, [
									E('div', { class: 'hw-bar-fill', style: `width: ${pct}%; background: ${colorCore};` })
								])
							]);
							coresNode.appendChild(coreRow);
						}
					}
					self.prevCpu[stat.name] = stat;
				});



				if (advStats) {
					var advNode = document.getElementById('hw-adv');
					if (advNode) {
						advNode.innerHTML = '';
						var addAdvBar = function(label, val) {
							var colorAdv = getDynColor(val, label === 'Idle');
							advNode.appendChild(E('div', { class: 'hw-progress-item' }, [
								E('div', { class: 'hw-progress-header' }, [
									E('span', { class: 'hw-stat-label' }, label),
									E('span', { class: 'hw-stat-value', style: `color: ${colorAdv};` }, val.toFixed(1) + '%')
								]),
								E('div', { class: 'hw-bar-bg' }, [
									E('div', { class: 'hw-bar-fill', style: `width: ${val}%; background: ${colorAdv};` })
								])
							]));
						};
						for (var key in advStats) {
							addAdvBar(key, advStats[key]);
						}

						var addAdvRowText = function(label, val, color) {
							advNode.appendChild(E('div', { class: 'hw-progress-item', style: 'margin-top: 5px;' }, [
								E('div', { class: 'hw-progress-header' }, [
									E('span', { class: 'hw-stat-label', style: 'font-size: 0.9em;' }, label),
									E('span', { class: 'hw-stat-value', style: (color ? `color: ${color}; font-size: 0.9em;` : 'font-size: 0.9em;') }, val)
								])
							]));
						};

						if (res.cpu_meta && res.cpu_meta.tasks) {
							addAdvRowText('System Tasks', res.cpu_meta.tasks, null);

							var ctxt = res.cpu_meta.ctxt || 0;
							var intr = res.cpu_meta.intr || 0;
							if (self.prevCtxt !== undefined) {
								var ctxtRate = ctxt - self.prevCtxt;
								var intrRate = intr - self.prevIntr;
								addAdvRowText('Context Switches / s', ctxtRate + ' /s', null);
								addAdvRowText('Hardware Interrupts / s', intrRate + ' /s', null);
							}
							self.prevCtxt = ctxt;
							self.prevIntr = intr;

							var connCount = res.cpu_meta.conntrack || 0;
							var connMax = res.cpu_meta.conntrack_max || 1;
							var connPct = Math.min((connCount / connMax) * 100, 100);
							var colorConn = getDynColor(connPct, false);
							advNode.appendChild(E('div', { class: 'hw-progress-item', style: 'margin-top: 10px;' }, [
								E('div', { class: 'hw-progress-header' }, [
									E('span', { class: 'hw-stat-label' }, 'Active Connections'),
									E('span', { class: 'hw-stat-value', style: `color: ${colorConn};` }, connCount + ' / ' + connMax)
								]),
								E('div', { class: 'hw-bar-bg' }, [
									E('div', { class: 'hw-bar-fill', style: `width: ${connPct}%; background: ${colorConn};` })
								])
							]));
						}
					}
				}


				var mem = res.mem;
				if (mem && mem.total > 0) {
					var used = mem.total - mem.avail;
					var pct = Math.round((used / mem.total) * 100);
					updateDial('ram', pct, ramCard.circ);
					document.getElementById('dial-sub-ram').textContent = (used / 1024).toFixed(0) + ' MB';
					
					var getPhysicalRamTotal = function(memTotalKb) {
						var sizesMB = [32, 64, 128, 256, 512, 1024, 1536, 2048, 3072, 4096, 6144, 8192, 12288, 16384, 24576, 32768, 65536];
						var memTotalMB = memTotalKb / 1024;
						for (var i = 0; i < sizesMB.length; i++) {
							if (memTotalMB <= sizesMB[i]) return sizesMB[i] * 1024;
						}
						return memTotalKb;
					};
					var physRamKB = getPhysicalRamTotal(mem.total);

					var ramStats = document.getElementById('stats-ram');
					ramStats.innerHTML = '';
					
					ramStats.appendChild(E('div', { class: 'hw-stat-row', style: 'margin-bottom: 5px;' }, [
						E('span', { class: 'hw-stat-label' }, 'Physical Total'),
						E('span', { class: 'hw-stat-value' }, (physRamKB / 1024).toFixed(0) + ' MB')
					]));
					ramStats.appendChild(E('div', { class: 'hw-stat-row', style: 'margin-bottom: 15px;' }, [
						E('span', { class: 'hw-stat-label' }, 'Usable Total'),
						E('span', { class: 'hw-stat-value' }, (mem.total / 1024).toFixed(0) + ' MB')
					]));

					var makeMemBar = function(label, valueMb, totalMb) {
						var pct = totalMb > 0 ? (valueMb / totalMb) * 100 : 0;
						var colorMem = getDynColor(pct, label === 'Free');
						var valStr = label === 'Used' || label === 'Free' || label === 'Cached' || label === 'Buffers'
							? valueMb.toFixed(0) + ' MB' 
							: valueMb.toFixed(0) + ' / ' + totalMb.toFixed(0) + ' MB';
							
						return E('div', { class: 'hw-progress-item' }, [
							E('div', { class: 'hw-progress-header' }, [
								E('span', { class: 'hw-stat-label' }, label),
								E('span', { class: 'hw-stat-value' }, valStr)
							]),
							E('div', { class: 'hw-bar-bg' }, [
								E('div', { class: 'hw-bar-fill', style: `width: ${pct}%; background: ${colorMem};` })
							])
						]);
					};

					ramStats.appendChild(makeMemBar('Used', used / 1024, mem.total / 1024));
					ramStats.appendChild(makeMemBar('Free', mem.free / 1024, mem.total / 1024));
					ramStats.appendChild(makeMemBar('Cached', mem.cached / 1024, mem.total / 1024));
					ramStats.appendChild(makeMemBar('Buffers', mem.buffers / 1024, mem.total / 1024));

					if (mem.swap_total > 0) {
						var swapUsed = mem.swap_total - mem.swap_free;
						ramStats.appendChild(makeMemBar('Swap', swapUsed / 1024, mem.swap_total / 1024));
					}

					if (mem.zram_total > 0) {
						ramStats.appendChild(makeMemBar('ZRAM', mem.zram_used / 1024, mem.zram_total / 1024));
					}
					
					if (mem.slab > 0) {
						ramStats.appendChild(makeMemBar('Slab Kernel', mem.slab / 1024, mem.total / 1024));
					}
					if (mem.pagetables > 0) {
						ramStats.appendChild(makeMemBar('PageTables', mem.pagetables / 1024, mem.total / 1024));
					}
				}


				if (res.df && Array.isArray(res.df)) {
					var dskStats = document.getElementById('stats-dsk');
					dskStats.innerHTML = '';
					var totalSpace = 0;
					var totalUsed = 0;
					var totalPhys = res.storage_total_phys ? parseInt(res.storage_total_phys / 1024) : 0;

					res.df.forEach(function(fs) {
						totalSpace += fs.total;
						totalUsed += fs.used;
						
						var readSpeed = 0;
						var writeSpeed = 0;
						var rIops = 0;
						var wIops = 0;
						
						if (fs.mount === '/') {
							var intRead = 0, intWrite = 0, intR_io = 0, intW_io = 0;
							for (var k in res.diskstats) {
								if (!k.match(/^(loop|ram|sda|sdb|sdc)/)) {
									var stat = res.diskstats[k];
									if (self.prevDisk[k]) {
										var prev = self.prevDisk[k];
										intRead += (stat.r - prev.r) * 512;
										intWrite += (stat.w - prev.w) * 512;
										intR_io += (stat.r_io - prev.r_io);
										intW_io += (stat.w_io - prev.w_io);
									}
									self.prevDisk[k] = stat;
								}
							}
							readSpeed = intRead;
							writeSpeed = intWrite;
							rIops = intR_io;
							wIops = intW_io;
						} else if (res.diskstats && res.diskstats[fs.dev]) {
							var stat = res.diskstats[fs.dev];
							if (self.prevDisk[fs.dev]) {
								var prev = self.prevDisk[fs.dev];
								readSpeed = (stat.r - prev.r) * 512;
								writeSpeed = (stat.w - prev.w) * 512;
								rIops = (stat.r_io - prev.r_io);
								wIops = (stat.w_io - prev.w_io);
							}
							self.prevDisk[fs.dev] = stat;
						}

						var formatSpeed = function(bytes) {
							if (bytes < 1024) return bytes + ' B/s';
							if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB/s';
							return (bytes / 1048576).toFixed(1) + ' MB/s';
						};

						var speedStr = 'R: ' + formatSpeed(readSpeed) + ' | W: ' + formatSpeed(writeSpeed);
						var iopsStr = '(' + rIops + 'R / ' + wIops + 'W) IOPS';
						var labelStr = fs.mount === '/' ? 'Root FS' : fs.mount;
						var typeStr = fs.hw_type ? '[' + fs.hw_type + (fs.hw_model ? ' - ' + fs.hw_model : '') + ']' : '';
						var usedPctStr = fs.pct;
						var pctNum = parseInt(usedPctStr) || 0;
						var colorDsk = getDynColor(pctNum);
						
						var inodesInfo = res.inodes ? res.inodes[fs.mount] : null;

						var bars = [
							E('div', { class: 'hw-progress-header' }, [
								E('span', { class: 'hw-stat-label' }, [ labelStr, E('span', { style: 'opacity: 0.6; margin-left: 5px;' }, typeStr) ]),
								E('span', { class: 'hw-stat-value', style: `color: ${colorDsk};` }, speedStr)
							]),
							E('div', { class: 'hw-bar-bg' }, [
								E('div', { class: 'hw-bar-fill', style: `width: ${pctNum}%; background: ${colorDsk};` })
							]),
							E('div', { style: 'width: 100%; display: flex; justify-content: space-between; margin-top: 5px; font-size: 0.9em; opacity: 0.8;' }, [
								E('span', {}, iopsStr),
								E('span', { class: 'hw-stat-value' }, usedPctStr + ' (' + (fs.total / 1024).toFixed(0) + ' MB)')
							])
						];

						if (inodesInfo) {
							var ipctNum = parseInt(inodesInfo.ipct) || 0;
							var icolor = getDynColor(ipctNum);
							bars.push(
								E('div', { class: 'hw-progress-header', style: 'margin-top: 6px;' }, [
									E('span', { class: 'hw-stat-label', style: 'font-size: 0.8em; opacity: 0.7;' }, 'Inodes Used'),
									E('span', { class: 'hw-stat-value', style: `font-size: 0.8em; color: ${icolor};` }, inodesInfo.ipct)
								]),
								E('div', { class: 'hw-bar-bg', style: 'height: 4px;' }, [
									E('div', { class: 'hw-bar-fill', style: `width: ${ipctNum}%; background: ${icolor};` })
								])
							);
						}

						dskStats.appendChild(E('div', { class: 'hw-progress-item', style: 'margin-bottom: 15px;' }, bars));
					});

					if (totalSpace > 0) {
						var usedPct = totalSpace > 0 ? (totalUsed / totalSpace) * 100 : 0;
						updateDial('dsk', usedPct, dskCard.circ);
						document.getElementById('dial-sub-dsk').textContent = (totalUsed / 1024).toFixed(0) + ' MB';
						
						var dskMeta = document.getElementById('dial-meta-dsk');
						if (!dskMeta) {
							dskMeta = E('div', { id: 'dial-meta-dsk', style: 'width: 100%; margin-top: 20px; display: flex; flex-direction: column; gap: 8px;' });
							var dContainer = document.getElementById('dial-txt-dsk').parentNode.parentNode;
							dContainer.appendChild(dskMeta);
						}
						
						var fmtSize = function(kb) {
							if (kb > 1048576) return (kb / 1048576).toFixed(2) + ' GB';
							return (kb / 1024).toFixed(0) + ' MB';
						};
						
						dskMeta.innerHTML = '';
						dskMeta.appendChild(E('div', { class: 'hw-stat-row' }, [
							E('span', { class: 'hw-stat-label' }, 'Physical Total'),
							E('span', { class: 'hw-stat-value' }, fmtSize(totalPhys > 0 ? totalPhys : totalSpace))
						]));
						dskMeta.appendChild(E('div', { class: 'hw-stat-row' }, [
							E('span', { class: 'hw-stat-label' }, 'Usable Total'),
							E('span', { class: 'hw-stat-value' }, fmtSize(totalSpace))
						]));
						dskMeta.appendChild(E('div', { class: 'hw-stat-row' }, [
							E('span', { class: 'hw-stat-label' }, 'Usable Free'),
							E('span', { class: 'hw-stat-value' }, fmtSize(totalSpace - totalUsed))
						]));
						
						if (res.mtd_count > 0) {
							dskMeta.appendChild(E('div', { class: 'hw-stat-row' }, [
								E('span', { class: 'hw-stat-label' }, 'MTD Partitions'),
								E('span', { class: 'hw-stat-value' }, res.mtd_count)
							]));
						}
						if (res.block_count > 0) {
							dskMeta.appendChild(E('div', { class: 'hw-stat-row' }, [
								E('span', { class: 'hw-stat-label' }, 'Block Devices'),
								E('span', { class: 'hw-stat-value' }, res.block_count)
							]));
						}
					}
				}


				if (res.thermals) {
					if (res.model) {
						var title = res.model;
						if (title.length > 30) title = title.substring(0, 30);
						var tEl = document.getElementById('title-cpu');
						if (tEl && tEl.textContent !== title) tEl.textContent = title;
					}

					var cpuNode = document.getElementById('hw-thermals-cpu');
					var wifiNode = document.getElementById('hw-thermals-wifi');
					var miscNode = document.getElementById('hw-thermals-misc');
					if (cpuNode) cpuNode.innerHTML = '';
					if (wifiNode) wifiNode.innerHTML = '';
					if (miscNode) miscNode.innerHTML = '';
					
					var sortedThermals = res.thermals.sort(function(a, b) { return a.type.localeCompare(b.type); });
					var seenSensors = {};
					
					sortedThermals.forEach(function(t) {
						var tempC = t.temp;
						if (tempC > 1000) tempC = tempC / 1000;
						var name = t.type.replace(/_/g, '-').toUpperCase();
						
						if (seenSensors[name]) return;
						seenSensors[name] = true;
						
						if (name.length > 20) name = name.substring(0, 20);

						var color = '#ffea00';
						var bgCol = 'rgba(255,234,0,0.1)';
						if (tempC >= 80) { color = '#ff1744'; bgCol = 'rgba(255,23,68,0.1)'; }
						else if (tempC <= 60) { color = '#00bcd4'; bgCol = 'rgba(0,188,212,0.1)'; }

						var lowerName = name.toLowerCase();
						var targetCol = null;
						if (lowerName.indexOf('cpu') !== -1 || lowerName.indexOf('soc') !== -1 || lowerName.indexOf('cpu_ss') !== -1 || lowerName.indexOf('top-glue') !== -1) {
							targetCol = cpuNode;
						} else if (lowerName.indexOf('wifi') !== -1 || lowerName.indexOf('wlan') !== -1 || lowerName.indexOf('wcss') !== -1 || lowerName.indexOf('phy') !== -1 || lowerName.indexOf('radio') !== -1 || lowerName.indexOf('mt798') !== -1 || lowerName.indexOf('ath') !== -1) {
							targetCol = wifiNode;
						} else {
							targetCol = miscNode;
						}

						var row = E('div', { class: 'hw-stat-row' }, [
							E('span', { class: 'hw-stat-label' }, name),
							E('span', { class: 'hw-temp-badge', style: `color: ${color}; background: ${bgCol};` }, tempC.toFixed(1) + ' °C')
						]);

						if (targetCol) targetCol.appendChild(row);
					});

					var wifiColNode = document.getElementById('hw-thermals-col-wifi');
					var wifiDivNode = document.getElementById('hw-thermals-divider-wifi');
					if (wifiNode && wifiNode.children.length === 0) {
						if (wifiColNode) wifiColNode.style.display = 'none';
						if (wifiDivNode) wifiDivNode.style.display = 'none';
					} else {
						if (wifiColNode) wifiColNode.style.display = 'block';
						if (wifiDivNode) wifiDivNode.style.display = 'block';
					}

					var miscColNode = document.getElementById('hw-thermals-col-misc');
					var miscDivNode = document.getElementById('hw-thermals-divider-misc');
					if (miscNode && miscNode.children.length === 0) {
						if (miscColNode) miscColNode.style.display = 'none';
						if (miscDivNode) miscDivNode.style.display = 'none';
					} else {
						if (miscColNode) miscColNode.style.display = 'block';
						if (miscDivNode) miscDivNode.style.display = 'block';
					}
				}



				if (res.eth_links && Array.isArray(res.eth_links)) {
					var ethNode = document.getElementById('hw-eth-links');
					if (ethNode) {
						ethNode.innerHTML = '';
						if (res.eth_links.length === 0) {
							ethNode.appendChild(E('div', { style: 'text-align: center; opacity: 0.5; font-style: italic;' }, 'No active physical links'));
						} else {
							res.eth_links.forEach(function(link) {
								var speedText = link.speed === 'Down' ? 'Down' : link.speed + ' Mbps';
								var duplexText = link.duplex && link.duplex !== 'unknown' ? ' (' + link.duplex.charAt(0).toUpperCase() + link.duplex.slice(1) + ')' : '';
								var colorStat = link.speed === 'Down' ? '#ff1744' : '#00bcd4';
								ethNode.appendChild(E('div', { class: 'hw-stat-row', style: 'background: rgba(128,128,128,0.05); padding: 10px 15px; border-radius: 6px; margin-bottom: 5px;' }, [
									E('span', { class: 'hw-stat-label', style: 'font-weight: bold; font-size: 1.1em;' }, link.iface.toUpperCase()),
									E('span', { class: 'hw-stat-value', style: 'color: ' + colorStat + ';' }, speedText + duplexText)
								]));
							});
						}
					}
				}

				if (res.usb_devs && Array.isArray(res.usb_devs)) {
					var usbNode = document.getElementById('hw-usb-devs');
					if (usbNode) {
						usbNode.innerHTML = '';
						if (res.usb_devs.length === 0) {
							usbNode.appendChild(E('div', { style: 'text-align: center; opacity: 0.5; font-style: italic; padding: 20px 0;' }, 'No USB devices connected'));
						} else {
							res.usb_devs.forEach(function(usb) {
								var speedText = usb.speed + ' Mbps';
								if (usb.speed === '480') speedText = 'USB 2.0 (480 Mbps)';
								if (usb.speed === '5000') speedText = 'USB 3.0 (5 Gbps)';
								if (usb.speed === '10000') speedText = 'USB 3.1 (10 Gbps)';
								if (usb.speed === '1.5' || usb.speed === '12') speedText = 'USB 1.1 (' + usb.speed + ' Mbps)';
								
								usbNode.appendChild(E('div', { class: 'hw-stat-row', style: 'background: rgba(128,128,128,0.05); padding: 10px 15px; border-radius: 6px; margin-bottom: 5px; display: flex; flex-direction: column; align-items: flex-start;' }, [
									E('div', { style: 'font-weight: bold; display: flex; justify-content: space-between; width: 100%;' }, [
										E('span', {}, usb.name),
										E('span', { style: 'color: #00b0ff; font-size: 0.9em; font-weight: normal;' }, speedText)
									])
								]));
							});
						}
					}
				}

				if (res.wifi_radios && Array.isArray(res.wifi_radios)) {
					var wifiNode = document.getElementById('hw-wifi-radios');
					if (wifiNode) {
						wifiNode.innerHTML = '';
						if (res.wifi_radios.length === 0) {
							wifiNode.appendChild(E('div', { style: 'text-align: center; opacity: 0.5; font-style: italic; padding: 20px 0;' }, 'No Wi-Fi radios found'));
						} else {
							res.wifi_radios.forEach(function(wifi) {
								wifiNode.appendChild(E('div', { class: 'hw-stat-row', style: 'background: rgba(128,128,128,0.05); padding: 12px 15px; border-radius: 6px; margin-bottom: 5px; display: flex; flex-direction: column; align-items: flex-start;' }, [
									E('div', { style: 'font-weight: bold; margin-bottom: 8px; display: flex; justify-content: space-between; width: 100%; font-size: 1.1em;' }, [
										E('span', { style: 'color: #b388ff;' }, wifi.iface.toUpperCase() + ' (' + wifi.band + ')'),
										E('span', { style: 'color: #00bcd4; font-size: 0.85em;' }, wifi.bitrate)
									]),
									E('div', { style: 'display: flex; justify-content: space-between; width: 100%; opacity: 0.8; font-size: 0.9em;' }, [
										E('span', {}, 'Tx: ' + wifi.txpower),
										E('span', {}, 'Noise: ' + wifi.noise),
										E('span', {}, 'Ch: ' + wifi.channel)
									])
								]));
							});
						}
					}
				}

			});
		}, 1);

		return container;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
