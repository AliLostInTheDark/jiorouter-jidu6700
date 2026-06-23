'use strict';
'require view';
'require poll';
'require rpc';
'require fs';
var callHwInfo = rpc.declare({
    object: 'luci.hwdash',
    method: 'info',
    expect: {}
});
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
    return { name: name, total: total, idleAll: idleAll, user: user, nice: nice, sys: sys, idle: idle, iowait: iowait, irq: irq, softirq: softirq };
};
return view.extend({
    prevCpu: {},
    prevDisk: {},
    load: function() {
        var self = this;
        self.prevCpu = {};
        return L.resolveDefault(fs.lines('/proc/stat'), []).then(function(lines) {
            lines.forEach(function(line) {
                if (line.indexOf('cpu') === 0) {
                    var stat = parseCpu(line);
                    self.prevCpu[stat.name] = stat;
                }
            });
            return Promise.resolve();
        });
    },
    render: function() {
        var container = E('div', {
            id: 'hw-dashboard',
            class: 'hw-dashboard'
        });
        var style = E('style', {}, ' .hw-dashboard { display: flex; flex-wrap: wrap; align-items: stretch; gap: 20px; padding: 15px; font-family: system-ui, -apple-system, sans-serif; width: 100%; max-width: 100%; overflow: hidden; } .hw-dashboard * { box-sizing: border-box; } .hw-thermals-container { display: flex; flex-direction: row; width: 100%; height: 100%; } .hw-thermals-col { flex: 1; } .hw-thermals-col-left { padding-right: 15px; } .hw-thermals-col-mid { padding: 0 15px; } .hw-thermals-col-right { padding-left: 15px; } .hw-thermals-title { font-size: 0.85em; opacity: 0.6; margin-bottom: 10px; text-align: center; } .hw-thermals-divider { width: 1px; background: var(--border-color, rgba(128,128,128,0.2)); margin: 10px 15px 30px 15px; } @media (max-width: 768px) { .hw-thermals-container { flex-direction: column; } .hw-thermals-col { padding: 0 !important; } .hw-thermals-divider { width: auto; height: 1px; margin: 25px 0; } } .hw-meta-grid { margin-top: 15px; font-size: 0.8em; color: currentColor; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; opacity: 0.8; width: 75%; margin-left: auto; margin-right: auto; } @media (max-width: 480px) { .hw-meta-grid { width: 100%; font-size: 0.75em; } .hw-dial { transform: scale(0.9); } .hw-card { padding: 15px; } } .hw-card { flex: 1 1 280px; background: var(--background-color-high, rgba(128, 128, 128, 0.05)); border: 1px solid var(--border-color, rgba(128, 128, 128, 0.2)); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-color, inherit); position: relative; box-shadow: 0 4px 10px rgba(0,0,0,0.1); max-width: 100%; overflow: hidden; } .hw-card.wide { flex: 1 1 100%; align-items: stretch; } .hw-card h3 { margin: 0 0 20px 0; font-size: 1.1em; color: var(--text-color, inherit); opacity: 0.8; text-transform: uppercase; letter-spacing: 1px; text-align: center; } .hw-dial { position: relative; width: 160px; height: 160px; display: flex; align-items: center; justify-content: center; margin: 0 auto; } .hw-dial svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; transform: rotate(-90deg); } .hw-dial-bg { fill: none; stroke: rgba(128, 128, 128, 0.2); stroke-width: 10; } .hw-dial-progress { fill: none; stroke-width: 10; stroke-linecap: round; transition: stroke-dasharray 0.5s ease; } .hw-dial-text { font-size: 2.2em; font-weight: 600; z-index: 1; } .hw-dial-subtext { position: absolute; bottom: 25px; font-size: 0.9em; opacity: 0.7; z-index: 1; } .hw-stats-list { width: 100%; display: flex; flex-direction: column; gap: 12px; } .hw-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 30px; width: 100%; } .hw-stat-row { display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 8px; } .hw-stat-label { opacity: 0.8; font-size: 0.95em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex-shrink: 1; margin-right: 10px; } .hw-stat-value { font-weight: bold; font-size: 0.95em; white-space: nowrap; flex-shrink: 0; } .hw-progress-item { display: flex; flex-direction: column; margin-bottom: 15px; width: 100%; } .hw-progress-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; width: 100%; min-width: 0; } .hw-bar-bg { width: 100%; height: 6px; background: var(--border-color, rgba(128, 128, 128, 0.2)); border-radius: 3px; overflow: hidden; margin-top: 6px; } .hw-bar-fill { height: 100%; transition: width 0.5s ease; } .hw-temp-badge { padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 0.9em; white-space: nowrap; } #hw-nand-row { align-items: flex-start; } @media (max-width: 768px) { #hw-nand-row { align-items: stretch; } #hw-nand-row > .hw-thermals-col { width: 100%; min-width: 0; } #hw-nand-row > .hw-thermals-divider { margin: 12px 0; } } ');
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
            var svgContainer = E('div', {
                id: 'dial-svg-' + id,
                style: 'position:absolute; top:0; left:0; width:100%; height:100%; background:transparent !important;'
            });
            svgContainer.innerHTML = '<svg viewBox="0 0 160 160" style="background:transparent !important;"><circle class="hw-dial-bg" cx="80" cy="80" r="' + radius + '"/><circle id="dial-prog-' + id + '" class="hw-dial-progress" cx="80" cy="80" r="' + radius + '" style="stroke: #00bcd4; stroke-dasharray: 0 ' + circumference + ';"/></svg>';
            var card = E('div', {
                class: 'hw-card',
                style: 'justify-content: flex-start;'
            }, [E('h3', {
                id: 'title-' + id
            }, title), E('div', {
                class: 'hw-dial',
                style: 'background:transparent !important;'
            }, [svgContainer, E('div', {
                id: 'dial-txt-' + id,
                class: 'hw-dial-text'
            }, '0%'), E('div', {
                id: 'dial-sub-' + id,
                class: 'hw-dial-subtext'
            }, '')]), E('div', {
                id: 'stats-' + id,
                class: 'hw-stats-list'
            })]);
            return {
                node: card,
                circ: circumference
            };
        };
        var groupChannels = function(band, channels) {
            if (!channels || channels.length === 0) return '';
            var groups = [];
            var currentGroup = [];
            for (var i = 0; i < channels.length; i++) {
                var ch = parseInt(channels[i]);
                if (isNaN(ch)) continue;
                if (currentGroup.length === 0) {
                    currentGroup.push(ch);
                } else {
                    var prev = currentGroup[currentGroup.length - 1];
                    var diff = ch - prev;
                    var breakGroup = false;
                    
                    if (band.indexOf('2.4') !== -1 && diff > 1) breakGroup = true;
                    if (band.indexOf('2.4') === -1 && diff > 4) breakGroup = true;
                    if (prev <= 48 && ch >= 52) breakGroup = true;
                    if (prev <= 64 && ch >= 100) breakGroup = true;
                    if (prev <= 144 && ch >= 149) breakGroup = true;
                    if (prev <= 165 && ch >= 169) breakGroup = true;
                    
                    if (!breakGroup) {
                        currentGroup.push(ch);
                    } else {
                        groups.push(currentGroup);
                        currentGroup = [ch];
                    }
                }
            }
            if (currentGroup.length > 0) groups.push(currentGroup);
            
            var strGroups = groups.map(function(g) {
                if (g.length === 1) return g[0].toString();
                var start = g[0];
                var end = g[g.length - 1];
                var label = '';
                if (band.indexOf('5') !== -1) {
                    if (start >= 36 && end <= 48) label = 'UNII-1';
                    else if (start >= 52 && end <= 64) label = 'UNII-2A';
                    else if (start >= 100 && end <= 144) label = 'UNII-2C';
                    else if (start >= 149 && end <= 165) label = 'UNII-3';
                    else if (start >= 169 && end <= 177) label = 'UNII-4';
                } else if (band.indexOf('6') !== -1) {
                    if (start >= 1 && end <= 93) label = 'UNII-5';
                    else if (start >= 97 && end <= 113) label = 'UNII-6';
                    else if (start >= 117 && end <= 185) label = 'UNII-7';
                    else if (start >= 189 && end <= 233) label = 'UNII-8';
                }
                return (label ? label + ' (' + start + '-' + end + ')' : start + '-' + end);
            });
            return strGroups.join(', ');
        };

        var calcMaxBitrate = function(hwmode, max_cw, max_spatial) {
            if (!hwmode || !max_cw || !max_spatial) return null;
            var mode = hwmode.toLowerCase();
            var cw = typeof max_cw === 'string' ? parseInt(max_cw.replace(/[^0-9]/g, '')) || 20 : max_cw;
            var streams = parseInt(max_spatial) || 1;
            
            var ratePerStream = 54;
            if (mode.indexOf('be') !== -1) {
                if (cw >= 320) ratePerStream = 2882;
                else if (cw >= 160) ratePerStream = 1441;
                else if (cw >= 80) ratePerStream = 688;
                else if (cw >= 40) ratePerStream = 344;
                else ratePerStream = 137;
            } else if (mode.indexOf('ax') !== -1) {
                if (cw >= 160) ratePerStream = 1201;
                else if (cw >= 80) ratePerStream = 600;
                else if (cw >= 40) ratePerStream = 287;
                else ratePerStream = 143;
            } else if (mode.indexOf('ac') !== -1) {
                if (cw >= 160) ratePerStream = 867;
                else if (cw >= 80) ratePerStream = 433;
                else if (cw >= 40) ratePerStream = 200;
                else ratePerStream = 86;
            } else if (mode.indexOf('n') !== -1) {
                if (cw >= 40) ratePerStream = 150;
                else ratePerStream = 72;
            }
            return (ratePerStream * streams) + ' Mbps';
        };

        var cpuCard = createDial('cpu', 'CPU');
        var ramCard = createDial('ram', 'MEMORY');
        var _dskNode = E('div', {class: 'hw-card wide', style: 'justify-content: flex-start; align-items: stretch;'});
        _dskNode.appendChild(E('h3', {}, 'Internal Storage'));
        _dskNode.appendChild(E('div', {id: 'stats-dsk', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0;'}));
        _dskNode.appendChild(E('div', {style: 'width: 100%; height: 1px; background: var(--border-color, rgba(128,128,128,0.2)); margin: 15px 0;'}));
        _dskNode.appendChild(E('div', {id: 'dial-meta-dsk', style: 'display: flex; flex-direction: column; gap: 5px;'}));
        _dskNode.appendChild(E('div', {id: 'hw-dsk-horiz-divider', style: 'width: 100%; height: 1px; background: var(--border-color, rgba(128,128,128,0.2)); margin: 15px 0; display: none;'}));
        _dskNode.appendChild(E('div', {id: 'hw-int-storage-extra', style: 'width: 100%;'}));
        var dskCard = {node: _dskNode};
        var coresNode = E('div', {
            id: 'hw-cores',
            class: 'hw-stats-list',
            style: 'margin-top: 0; padding-top: 0;'
        });
        cpuCard.node.appendChild(E('h4', {
            style: 'text-align: center; font-size: 0.85em; opacity: 0.7; letter-spacing: 1px; margin: 15px 0 10px 0; text-transform: uppercase;'
        }, 'PER-CORE USAGE'));
        cpuCard.node.appendChild(coresNode);
        cpuCard.node.appendChild(E('div', {
            style: 'width: 100%; height: 1px; background: var(--border-color, rgba(128,128,128,0.2)); margin: 15px 0;'
        }));
        cpuCard.node.appendChild(E('h4', {
            style: 'text-align: center; font-size: 0.85em; opacity: 0.7; letter-spacing: 1px; margin: 0 0 10px 0; text-transform: uppercase;'
        }, 'SYSTEM STATUS'));
        var cpuMetaNode = E('div', {
            id: 'hw-cpu-meta',
            class: 'hw-stats-list',
            style: 'margin-top: 0; padding-top: 0;'
        });
        cpuCard.node.appendChild(cpuMetaNode);
        var advCard = E('div', {
            class: 'hw-card'
        }, [E('h3', {}, 'CPU Detailed Load'), E('div', {
            id: 'hw-adv',
            class: 'hw-stats-list',
            style: 'margin-top: 0; padding-top: 0;'
        })]);
        var extCard = E('div', {
            id: 'hw-ext-card',
            class: 'hw-card',
            style: 'display: none;'
        }, [E('h3', {}, 'EXTERNAL STORAGE'), E('div', {
            id: 'hw-ext-list',
            class: 'hw-stats-list',
            style: 'margin-top: 0; padding-top: 0; width: 100%;'
        }), E('div', {
            id: 'hw-ext-meta',
            style: 'width: 100%; margin-top: 20px; display: flex; flex-direction: column; gap: 8px;'
        })]);
        
        
        
        var thermCard = E('div', {
            class: 'hw-card wide', style: 'display: none;'
        }, [E('h3', {}, 'Thermal Sensors'), E('div', {
            class: 'hw-thermals-container'
        }, [E('div', {
            class: 'hw-thermals-col hw-thermals-col-left'
        }, [E('div', {
            class: 'hw-thermals-title'
        }, 'CPU'), E('div', {
            id: 'hw-thermals-cpu',
            class: 'hw-stats-list',
            style: 'margin-top: 0; padding-top: 0;'
        })]), E('div', {
            id: 'hw-thermals-divider-wifi',
            class: 'hw-thermals-divider'
        }), E('div', {
            id: 'hw-thermals-col-wifi',
            class: 'hw-thermals-col hw-thermals-col-mid'
        }, [E('div', {
            class: 'hw-thermals-title'
        }, 'Wi-Fi'), E('div', {
            id: 'hw-thermals-wifi',
            class: 'hw-stats-list',
            style: 'margin-top: 0; padding-top: 0;'
        })]), E('div', {
            id: 'hw-thermals-divider-misc',
            class: 'hw-thermals-divider'
        }), E('div', {
            id: 'hw-thermals-col-misc',
            class: 'hw-thermals-col hw-thermals-col-right'
        }, [E('div', {
            class: 'hw-thermals-title'
        }, 'MISCELLANEOUS'), E('div', {
            id: 'hw-thermals-misc',
            class: 'hw-stats-list',
            style: 'margin-top: 0; padding-top: 0;'
        })])])]);
        
        
        var ethCard = E('div', { class: 'hw-card', style: 'justify-content: flex-start; display: none;' }, [E('h3', {}, 'Ethernet Switch Topology'), E('div', { id: 'hw-eth-links', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0; display: flex; flex-direction: column; gap: 8px;' })]);

        
        
        var pcieUsbCard = E('div', { class: 'hw-card', style: 'justify-content: flex-start; display: none;' }, [E('h3', {}, 'PCI-e & USB Bus Topology'), E('div', { id: 'hw-pcie-usb', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0; display: flex; flex-direction: column; gap: 8px;' })]);

        
        
        var wifiCard = E('div', { class: 'hw-card', style: 'justify-content: flex-start; display: none;' }, [E('h3', {}, 'Wi-Fi PHY & Spectrum'), E('div', { id: 'hw-wifi-radios', class: 'hw-stats-list', style: 'margin-top: 0; padding-top: 0; display: flex; flex-direction: column; gap: 8px;' })]);

        var sysCard = E('div', {class: 'hw-card wide', style: 'justify-content: flex-start;'});
        sysCard.appendChild(E('h3', {}, 'System Info'));
        sysCard.appendChild(E('div', {id: 'hw-sysinfo-grid', style: 'width: 100%;'}));

        container.appendChild(style);
        container.appendChild(sysCard);
        container.appendChild(cpuCard.node);
        container.appendChild(ramCard.node);
        container.appendChild(advCard);
        container.appendChild(dskCard.node);
        container.appendChild(extCard);
        var myExtWrapper = E('div', {
            id: 'my-ext-wrapper',
            style: 'display: contents;'
        });
        container.appendChild(myExtWrapper);
        container.appendChild(ethCard);
        container.appendChild(pcieUsbCard);
        container.appendChild(wifiCard);
        container.appendChild(thermCard);
        var self = this;
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
                                cpuStats.appendChild(E('div', {
                                    class: 'hw-stat-row',
                                    style: 'margin-bottom: 2px;'
                                }, [E('span', {
                                    class: 'hw-stat-label'
                                }, label), E('span', {
                                    class: 'hw-stat-value'
                                }, val)]));
                            };
                            var _cores = meta.cores || (res.cpus.length - 1);
                            var _threads = meta.threads || _cores;
                            addMeta('Cores / Threads', _cores + 'C / ' + _threads + 'T');
                            var _si = res.sys_info || {};
                            var _fmtC = function(b) { return b >= 1048576 ? (b/1048576).toFixed(0)+' MB' : (b/1024).toFixed(0)+' KB'; };
                            var _cacheParts = [];
                            if (_si.l0 > 0) _cacheParts.push('L0 ' + _fmtC(_si.l0));
                            var _l1 = (_si.l1d || 0) + (_si.l1i || 0);
                            if (_l1 > 0) _cacheParts.push('L1 ' + _fmtC(_l1));
                            if (_si.l2 > 0) _cacheParts.push('L2 ' + _fmtC(_si.l2));
                            if (_si.l3 > 0) _cacheParts.push('L3 ' + _fmtC(_si.l3));
                            if (_si.l4 > 0) _cacheParts.push('L4 ' + _fmtC(_si.l4));
                            addMeta('Cache', _cacheParts.length > 0 ? _cacheParts.join(' + ') : '0 MB');
                            var curFreq = '';
                            if (res.freqs && res.freqs.length > 0) {
                                var validFreqs = res.freqs.filter(function(f) {
                                    return f !== null;
                                });
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
                                metaNode.appendChild(E('div', {
                                    class: 'hw-stat-row'
                                }, [E('span', {
                                    class: 'hw-stat-label'
                                }, 'Load Average'), E('span', {
                                    class: 'hw-stat-value'
                                }, (res.cpu_meta.load_1 || '0') + ', ' + (res.cpu_meta.load_5 || '0') + ', ' + (res.cpu_meta.load_15 || '0'))]));
                                if (res.cpu_meta.governor && res.cpu_meta.governor.trim() !== '' && res.cpu_meta.governor !== 'null') {
                                    metaNode.appendChild(E('div', {
                                        class: 'hw-stat-row'
                                    }, [E('span', {
                                        class: 'hw-stat-label'
                                    }, 'CPU Governor'), E('span', {
                                        class: 'hw-stat-value',
                                        style: 'text-transform: uppercase;'
                                    }, res.cpu_meta.governor)]));
                                }
                                metaNode.appendChild(E('div', {
                                    class: 'hw-stat-row'
                                }, [E('span', {
                                    class: 'hw-stat-label'
                                }, 'Uptime'), E('span', {
                                    class: 'hw-stat-value'
                                }, uptimeStr)]));
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
                            var coreRow = E('div', {
                                class: 'hw-progress-item'
                            }, [E('div', {
                                class: 'hw-progress-header'
                            }, [E('span', {
                                class: 'hw-stat-label'
                            }, coreName), E('span', {
                                class: 'hw-stat-value',
                                style: 'color: ' + colorCore + ';'
                            }, freqStr + pct.toFixed(2) + '%')]), E('div', {
                                class: 'hw-bar-bg'
                            }, [E('div', {
                                class: 'hw-bar-fill',
                                style: 'width: ' + pct + '%; background: ' + colorCore + ';'
                            })])]);
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
                            advNode.appendChild(E('div', {
                                class: 'hw-progress-item'
                            }, [E('div', {
                                class: 'hw-progress-header'
                            }, [E('span', {
                                class: 'hw-stat-label'
                            }, label), E('span', {
                                class: 'hw-stat-value',
                                style: 'color: ' + colorAdv + ';'
                            }, val.toFixed(1) + '%')]), E('div', {
                                class: 'hw-bar-bg'
                            }, [E('div', {
                                class: 'hw-bar-fill',
                                style: 'width: ' + val + '%; background: ' + colorAdv + ';'
                            })])]));
                        };
                        for (var key in advStats) {
                            addAdvBar(key, advStats[key]);
                        }
                        var addAdvRowText = function(label, val, color) {
                            advNode.appendChild(E('div', {
                                class: 'hw-progress-item',
                                style: 'margin-top: 5px;'
                            }, [E('div', {
                                class: 'hw-progress-header'
                            }, [E('span', {
                                class: 'hw-stat-label',
                                style: 'font-size: 0.9em;'
                            }, label), E('span', {
                                class: 'hw-stat-value',
                                style: (color ? 'color: ' + color + '; font-size: 0.9em;' : 'font-size: 0.9em;')
                            }, val)])]));
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
                            advNode.appendChild(E('div', {
                                class: 'hw-progress-item',
                                style: 'margin-top: 10px;'
                            }, [E('div', {
                                class: 'hw-progress-header'
                            }, [E('span', {
                                class: 'hw-stat-label'
                            }, 'Active Connections'), E('span', {
                                class: 'hw-stat-value',
                                style: 'color: ' + colorConn + ';'
                            }, connCount + ' / ' + connMax)]), E('div', {
                                class: 'hw-bar-bg'
                            }, [E('div', {
                                class: 'hw-bar-fill',
                                style: 'width: ' + connPct + '%; background: ' + colorConn + ';'
                            })])]));
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
                    ramStats.appendChild(E('div', {
                        class: 'hw-stat-row',
                        style: 'margin-bottom: 5px;'
                    }, [E('span', {
                        class: 'hw-stat-label'
                    }, 'Physical Total'), E('span', {
                        class: 'hw-stat-value'
                    }, (physRamKB / 1024).toFixed(0) + ' MB')]));
                    ramStats.appendChild(E('div', {
                        class: 'hw-stat-row',
                        style: 'margin-bottom: 15px;'
                    }, [E('span', {
                        class: 'hw-stat-label'
                    }, 'Usable Total'), E('span', {
                        class: 'hw-stat-value'
                    }, (mem.total / 1024).toFixed(0) + ' MB')]));
                    var makeMemBar = function(label, valueMb, totalMb) {
                        var pct = totalMb > 0 ? (valueMb / totalMb) * 100 : 0;
                        var colorMem = getDynColor(pct, label === 'Free');
                        var valStr = label === 'Used' || label === 'Free' || label === 'Cached' || label === 'Buffers' ? valueMb.toFixed(0) + ' MB' : valueMb.toFixed(0) + ' / ' + totalMb.toFixed(0) + ' MB';
                        return E('div', {
                            class: 'hw-progress-item'
                        }, [E('div', {
                            class: 'hw-progress-header'
                        }, [E('span', {
                            class: 'hw-stat-label'
                        }, label), E('span', {
                            class: 'hw-stat-value'
                        }, valStr)]), E('div', {
                            class: 'hw-bar-bg'
                        }, [E('div', {
                            class: 'hw-bar-fill',
                            style: 'width: ' + pct + '%; background: ' + colorMem + ';'
                        })])]);
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
                    if (mem.zram_total > 0) {
                        var ratio = mem.zram_used > 0 ? (mem.zram_orig / mem.zram_used).toFixed(2) : 1.0;
                        ramStats.appendChild(E('div', {style: 'text-align: center; font-size: 0.8em; opacity: 0.8; margin-top: -10px; margin-bottom: 10px;'}, 'Compression: ' + ratio + 'x'));
                    }
                    if (mem.slab > 0) {
                        ramStats.appendChild(makeMemBar('Slab Kernel', mem.slab / 1024, mem.total / 1024));
                    }
                    if (mem.pagetables > 0) {
                        ramStats.appendChild(makeMemBar('PageTables', mem.pagetables / 1024, mem.total / 1024));
                    }
                }
                if (res.df && Array.isArray(res.df)) {
                    var totalSpace = 0;
                    var totalUsed = 0;
                    var totalPhys = 0;
                    var nandChipTotal = (res.mtd_count > 0 && res.mtd_phys) ? Math.round(res.mtd_phys / 1024) : 0;
                    var nandRootfsVol = 0;
                    var emmcTotal = 0;
                    var diskTotal = 0;
                    var diskRootfsVol = 0;
                    var _seenDiskDev = {};
                    var dskNode = document.getElementById('stats-dsk');
                    if (dskNode) dskNode.innerHTML = '';
                    res.df.forEach(function(fs) {
                        var isExt = (fs.hw_type === 'USB');
                        if (fs.total > 0 && !isExt) {
                            totalSpace += fs.total;
                            totalUsed += fs.used;
                        }
                        if (fs.hw_size > 0 && !isExt) totalPhys += fs.hw_size;
                        if (fs.hw_type === 'NAND' && !isExt && fs.mount === '/' && fs.hw_size > 0) {
                            nandRootfsVol = fs.hw_size;
                        }
                        if (!isExt) {
                            if (fs.hw_type === 'eMMC' || fs.hw_type === 'MMC' || fs.hw_type === 'SD') {
                                if (fs.hw_size > emmcTotal) emmcTotal = fs.hw_size;
                            } else if (fs.hw_type === 'HDD' || fs.hw_type === 'SSD' || fs.hw_type === 'NVMe') {
                                if (!_seenDiskDev[fs.dev]) { diskTotal += fs.hw_size; _seenDiskDev[fs.dev] = true; }
                                if (fs.mount === '/' && fs.total > 0) diskRootfsVol = fs.total;
                            }
                        }
                        if (isExt) return;
                        var readSpeed = 0;
                        var writeSpeed = 0;
                        var rIops = 0;
                        var wIops = 0;
                        if (fs.mount === '/') {
                            var intRead = 0,
                                intWrite = 0,
                                intR_io = 0,
                                intW_io = 0;
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
                            if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB/s';
                            return (bytes / 1048576).toFixed(1) + ' MB/s';
                        };
                        var usedPctStr = fs.pct;
                        var pctNum = parseInt(usedPctStr) || 0;
                        var colorDsk = getDynColor(pctNum);
                        var labelStr = fs.mount === '/' ? 'Root FS' : fs.mount.replace(/^\/mnt\//, '');
                        var typeStr = fs.hw_type ? '[' + fs.hw_type + (fs.hw_model ? ' - ' + fs.hw_model : '') + ']' : '';
                        var inodesInfo = res.inodes ? res.inodes[fs.mount] : null;
                        if (dskNode) {
                            var _fmtKb = function(kb) { return kb >= 1048576 ? (kb/1048576).toFixed(1)+' GB' : kb >= 1024 ? (kb/1024).toFixed(0)+' MB' : kb+' KB'; };
                            var _isNand = fs.hw_type === 'NAND';
                            var speedStr = _isNand ? _fmtKb(fs.used) + ' / ' + _fmtKb(fs.total) : 'R: ' + formatSpeed(readSpeed) + ' | W: ' + formatSpeed(writeSpeed);
                            var iopsStr = _isNand ? (fs.total > 0 ? ((fs.used/fs.total)*100).toFixed(1)+'% filesystem used' : '') : '(' + rIops + 'R / ' + wIops + 'W) IOPS';
                            var bars = [E('div', {
                                class: 'hw-progress-header'
                            }, [E('span', {
                                style: 'display: flex; opacity: 0.8; font-size: 0.95em; flex-shrink: 1; min-width: 0; margin-right: 5px;'
                            }, [E('span', {
                                style: 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
                            }, labelStr), E('span', {
                                style: 'opacity: 0.6; margin-left: 5px; flex-shrink: 0;'
                            }, typeStr)]), E('span', {
                                class: 'hw-stat-value',
                                style: 'color: ' + colorDsk + '; flex-shrink: 0;'
                            }, speedStr)]), E('div', {
                                class: 'hw-bar-bg'
                            }, [E('div', {
                                class: 'hw-bar-fill',
                                style: 'width: ' + pctNum + '%; background: ' + colorDsk + ';'
                            })]), E('div', {
                                style: 'width: 100%; display: flex; justify-content: space-between; margin-top: 5px; font-size: 0.9em; opacity: 0.8;'
                            }, [E('span', {}, iopsStr), E('span', {
                                class: 'hw-stat-value'
                            }, usedPctStr)])];
                            if (inodesInfo && inodesInfo.ipct !== '-') {
                                var ipctNum = parseInt(inodesInfo.ipct) || 0;
                                var icolor = getDynColor(ipctNum);
                                bars.push(E('div', {
                                    class: 'hw-progress-header',
                                    style: 'margin-top: 6px;'
                                }, [E('span', {
                                    class: 'hw-stat-label',
                                    style: 'font-size: 0.8em; opacity: 0.7;'
                                }, 'Inodes Used'), E('span', {
                                    class: 'hw-stat-value',
                                    style: 'font-size: 0.8em; color: ' + icolor + ';'
                                }, inodesInfo.ipct)]), E('div', {
                                    class: 'hw-bar-bg',
                                    style: 'height: 4px;'
                                }, [E('div', {
                                    class: 'hw-bar-fill',
                                    style: 'width: ' + ipctNum + '%; background: ' + icolor + ';'
                                })]));
                            }
                            dskNode.appendChild(E('div', {
                                class: 'hw-progress-item',
                                style: 'margin-bottom: 15px;'
                            }, bars));
                        }
                    });
                    var _ovSi = res.sys_info || {};
                    var dskMeta = document.getElementById('dial-meta-dsk');
                    if (dskMeta) {
                        var fmtSize = function(kb) {
                            if (kb >= 1048576) return (kb / 1048576).toFixed(2) + ' GB';
                            return (kb / 1024).toFixed(0) + ' MB';
                        };
                        var _fmtB = function(b) { return b >= 1073741824 ? (b/1073741824).toFixed(2)+' GB' : b >= 1048576 ? (b/1048576).toFixed(1)+' MB' : b >= 1024 ? (b/1024).toFixed(0)+' KB' : b+' B'; };
                        var addMR = function(lbl, val, color) {
                            dskMeta.appendChild(E('div', {class: 'hw-stat-row'}, [
                                E('span', {class: 'hw-stat-label'}, lbl),
                                E('span', {class: 'hw-stat-value', style: color ? 'color:' + color + ';' : ''}, val)
                            ]));
                        };
                        dskMeta.innerHTML = '';
                        if (nandChipTotal > 0) {
                            addMR('Physical NAND Total', fmtSize(nandChipTotal));
                            if (nandRootfsVol > 0 && nandRootfsVol !== nandChipTotal) addMR('rootfs Physical Total', fmtSize(nandRootfsVol));
                            if (_ovSi.overlay_total > 0) {
                                var _ovPctN = Math.round(_ovSi.overlay_used / _ovSi.overlay_total * 100);
                                addMR('Overlay Total', _fmtB(_ovSi.overlay_total));
                                addMR('Overlay Used', _fmtB(_ovSi.overlay_used), getDynColor(_ovPctN));
                                addMR('Overlay Free', _fmtB(_ovSi.overlay_free));
                            }
                        } else if (emmcTotal > 0) {
                            addMR('Physical eMMC Total', fmtSize(emmcTotal));
                            if (totalSpace > 0) { addMR('Usable Total', fmtSize(totalSpace)); addMR('Usable Free', fmtSize(totalSpace - totalUsed)); }
                        } else if (diskTotal > 0) {
                            addMR('Physical Disk Total', fmtSize(diskTotal));
                            if (diskRootfsVol > 0 && diskRootfsVol !== diskTotal) addMR('rootfs Physical Total', fmtSize(diskRootfsVol));
                            if (totalSpace > 0) { addMR('Usable Total', fmtSize(totalSpace)); addMR('Usable Free', fmtSize(totalSpace - totalUsed)); }
                        } else if (totalSpace > 0) {
                            addMR('Usable Total', fmtSize(totalSpace));
                            addMR('Usable Free', fmtSize(totalSpace - totalUsed));
                        }
                        if (res.mtd_count > 0) addMR('MTD Partitions', String(res.mtd_count));
                    }
                    var extCardNode = document.getElementById('hw-ext-card');
                    if (extCardNode) extCardNode.style.display = 'none';
                }

                (function() {
                    var extraNode = document.getElementById('hw-int-storage-extra');
                    if (!extraNode) return;
                    extraNode.innerHTML = '';

                    var makeRow = function(label, val, color) {
                        return E('div', {class: 'hw-stat-row', style: 'margin-bottom: 3px;'}, [
                            E('span', {class: 'hw-stat-label', style: 'font-size: 0.9em;'}, label),
                            E('span', {class: 'hw-stat-value', style: 'font-size: 0.9em;' + (color ? ' color:' + color + ';' : '')}, val)
                        ]);
                    };
                    var makeBar2 = function(label, pct, valStr, color) {
                        var c = color || getDynColor(pct);
                        return E('div', {class: 'hw-progress-item', style: 'margin-bottom: 8px;'}, [
                            E('div', {class: 'hw-progress-header'}, [
                                E('span', {class: 'hw-stat-label', style: 'font-size: 0.9em;'}, label),
                                E('span', {class: 'hw-stat-value', style: 'font-size: 0.9em; color:' + c + ';'}, valStr)
                            ]),
                            E('div', {class: 'hw-bar-bg'}, [
                                E('div', {class: 'hw-bar-fill', style: 'width:' + Math.min(pct, 100) + '%; background:' + c + ';'})
                            ])
                        ]);
                    };
                    var fmtBytesS = function(b) {
                        if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB';
                        if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
                        if (b >= 1024) return (b / 1024).toFixed(0) + ' KB';
                        return b + ' B';
                    };
                    var makeDevBox = function(headerLeft, headerRight) {
                        var box = E('div', {style: 'background: rgba(128,128,128,0.04); border: 1px solid var(--border-color, rgba(128,128,128,0.1)); border-radius: 8px; padding: 10px; margin-bottom: 10px;'});
                        var rightEl = (typeof headerRight === 'string')
                            ? E('span', {style: 'font-size: 0.8em; opacity: 0.7;'}, headerRight)
                            : headerRight;
                        box.appendChild(E('div', {style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid var(--border-color, rgba(128,128,128,0.15));'}, [
                            E('span', {style: 'font-weight: bold; font-size: 0.95em;'}, headerLeft),
                            rightEl
                        ]));
                        return box;
                    };
                    var secH = function(title) {
                        return E('h4', {style: 'margin: 0 0 10px 0; font-size: 0.8em; opacity: 0.6; text-transform: uppercase; letter-spacing: 1px;'}, title);
                    };
                    var hRule = function() {
                        return E('div', {style: 'width:100%;height:1px;background:var(--border-color,rgba(128,128,128,0.15));margin:12px 0;'});
                    };

                    var hasUbi = res.ubi_devs && res.ubi_devs.length > 0;
                    var hasMtd = res.mtd_parts && res.mtd_parts.length > 0;
                    var hasEmmc = !!res.emmc_info;
                    var hasNvme = !!res.nvme_info;
                    var hasF2fs = res.f2fs_info && res.f2fs_info.length > 0;

                    // UBI + MTD side-by-side in a two-column thermals-style row
                    if (hasUbi || hasMtd) {
                        var nandRow = E('div', {id: 'hw-nand-row', class: 'hw-thermals-container'});

                        if (hasUbi) {
                            var ubiCol = E('div', {class: 'hw-thermals-col' + (hasMtd ? ' hw-thermals-col-left' : '')});
                            ubiCol.appendChild(secH('UBI / NAND Flash'));
                            res.ubi_devs.forEach(function(u) {
                                var ratedEc = 3000;
                                var wearPct = u.max_ec > 0 ? Math.min((u.max_ec / ratedEc) * 100, 100) : 0;
                                var eb_kb = u.eb_size > 0 ? (u.eb_size / 1024).toFixed(0) + ' KB' : '';
                                var box = makeDevBox(u.dev.toUpperCase(), 'MTD' + u.mtd_num + (eb_kb ? ' | ' + eb_kb + ' erase blocks' : ''));
                                if (res.nand_chip_id !== undefined) box.appendChild(makeRow('Chip ID', res.nand_chip_id || 'Not Available', res.nand_chip_id && res.nand_chip_id !== 'Not Available' ? null : '#9e9e9e'));
                                box.appendChild(makeBar2('Wear Level (Max EC / ' + ratedEc + ' rated)', wearPct, u.max_ec + ' cycles', getDynColor(wearPct)));
                                if (u.eb_size > 0 && u.total_ebs > 0) {
                                    var allocEbs = u.total_ebs - u.avail_ebs - u.bad_pebs;
                                    var allocBytes = allocEbs * u.eb_size;
                                    var totalUbiBytes = u.total_ebs * u.eb_size;
                                    var capPct = totalUbiBytes > 0 ? (allocBytes / totalUbiBytes) * 100 : 0;
                                    // UBI normally reserves all PEBs upfront; only warn on extreme over-allocation
                                    var capColor = capPct >= 98 ? '#ff5252' : capPct >= 88 ? '#ffb300' : '#00bcd4';
                                    box.appendChild(makeBar2('PEB Utilization', capPct, fmtBytesS(allocBytes) + ' / ' + fmtBytesS(totalUbiBytes), capColor));
                                }
                                box.appendChild(makeRow('PEB Status', 'Total: ' + u.total_ebs + '  Avail: ' + u.avail_ebs + '  Bad: ' + u.bad_pebs, u.bad_pebs > 0 ? '#ffb300' : null));
                                if (u.min_ec > 0) box.appendChild(makeRow('Min / Max Erase Count', u.min_ec + ' / ' + u.max_ec, null));
                                if (u.page_size > 0) {
                                    var geoChip = function(lbl) { return E('span', {style: 'font-size: 0.78em; padding: 2px 7px; border-radius: 4px; background: rgba(128,128,128,0.1); border: 1px solid rgba(128,128,128,0.2); white-space: nowrap;'}, lbl); };
                                    box.appendChild(E('div', {style: 'margin-bottom: 8px;'}, [
                                        E('div', {style: 'font-size: 0.78em; opacity: 0.55; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;'}, 'NAND Geometry'),
                                        E('div', {style: 'display:flex; flex-wrap:wrap; gap: 4px;'}, [
                                            geoChip('Page ' + fmtBytesS(u.page_size)),
                                            geoChip('Block ' + fmtBytesS(u.block_size)),
                                            geoChip('OOB ' + u.oob_size + ' B')
                                        ])
                                    ]));
                                }
                                if (u.volumes && u.volumes.length > 0) {
                                    var vd = E('div', {style: 'margin-top: 8px; padding-top: 6px; border-top: 1px dashed var(--border-color, rgba(128,128,128,0.2));'});
                                    vd.appendChild(E('div', {style: 'font-size: 0.75em; opacity: 0.55; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;'}, 'Volumes'));
                                    u.volumes.forEach(function(vol) {
                                        var reservedBytes = (vol.reserved_ebs || 0) * (vol.eb_size || u.eb_size);
                                        var vsz = vol.data_bytes > 0 ? fmtBytesS(vol.data_bytes) : '0 B';
                                        if (reservedBytes > 0 && reservedBytes !== vol.data_bytes) vsz += ' / ' + fmtBytesS(reservedBytes);
                                        vd.appendChild(E('div', {style: 'display:flex; justify-content:space-between; font-size: 0.85em; padding: 3px 0; border-bottom: 1px solid var(--border-color, rgba(128,128,128,0.07));'}, [
                                            E('span', {style: 'color:#00bcd4;'}, vol.name),
                                            E('span', {style: 'opacity: 0.7;'}, vol.type + ' | ' + vsz)
                                        ]));
                                    });
                                    box.appendChild(vd);
                                }
                                ubiCol.appendChild(box);
                            });
                            nandRow.appendChild(ubiCol);
                        }

                        if (hasUbi && hasMtd) nandRow.appendChild(E('div', {class: 'hw-thermals-divider'}));

                        if (hasMtd) {
                            var mtdCol = E('div', {class: 'hw-thermals-col' + (hasUbi ? ' hw-thermals-col-right' : ''), style: 'min-width: 0;'});
                            mtdCol.appendChild(secH('MTD Partition Table'));
                            var mtdWrap = E('div', {style: 'font-size: 0.82em;'});
                            res.mtd_parts.forEach(function(p) {
                                var sz = fmtBytesS(p.size);
                                var tc = p.type === 'nor' ? '#00bcd4' : p.type === 'nand' ? '#ffea00' : '#9e9e9e';
                                mtdWrap.appendChild(E('div', {style: 'display:flex; justify-content:space-between; align-items:center; padding: 3px 6px; border-bottom: 1px solid var(--border-color, rgba(128,128,128,0.08));'}, [
                                    E('span', {style: 'color:#00bcd4; flex-shrink:0; min-width: 48px;'}, 'mtd' + p.num),
                                    E('span', {style: 'flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding: 0 8px; opacity:0.85;'}, p.name),
                                    E('span', {style: 'flex-shrink:0; opacity:0.7; min-width: 60px; text-align:right;'}, sz),
                                    E('span', {style: 'flex-shrink:0; color:' + tc + '; margin-left: 8px; min-width: 38px; text-align:right;'}, p.type.toUpperCase())
                                ]));
                            });
                            mtdCol.appendChild(mtdWrap);
                            // ECC error alert — only shown when non-zero errors exist
                            var eccParts = res.mtd_parts.filter(function(p) { return p.ecc_fail > 0 || p.ecc_corr > 0; });
                            if (eccParts.length > 0) {
                                var eccDiv = E('div', {style: 'margin-top:10px; padding-top:8px; border-top:1px dashed var(--border-color,rgba(128,128,128,0.2));'});
                                eccDiv.appendChild(E('div', {style: 'font-size:0.75em; opacity:0.5; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;'}, 'ECC Alerts'));
                                eccParts.forEach(function(p) {
                                    var eccRow = E('div', {style: 'display:flex; justify-content:space-between; font-size:0.82em; padding:3px 0;'});
                                    eccRow.appendChild(E('span', {style: 'color:#00bcd4;'}, 'mtd'+p.num+' ('+p.name+')'));
                                    var eccVals = E('span', {});
                                    if (p.ecc_corr > 0) eccVals.appendChild(E('span', {style: 'color:#ffb300; margin-right:8px;'}, p.ecc_corr+' corr'));
                                    if (p.ecc_fail > 0) eccVals.appendChild(E('span', {style: 'color:#ff5252;'}, p.ecc_fail+' fail'));
                                    eccRow.appendChild(eccVals);
                                    eccDiv.appendChild(eccRow);
                                });
                                mtdCol.appendChild(eccDiv);
                            }
                            nandRow.appendChild(mtdCol);
                        }

                        extraNode.appendChild(nandRow);
                    }

                    // eMMC / SD health
                    if (hasEmmc) {
                        if (hasUbi || hasMtd) extraNode.appendChild(hRule());
                        extraNode.appendChild(secH('eMMC / SD Health'));
                        var em = res.emmc_info;
                        var eolLbls = ['Not Defined', 'Normal', 'Warning', 'Urgent'];
                        var eolClrs = ['#9e9e9e', '#00bcd4', '#ffea00', '#ff1744'];
                        var ltLbls = ['N/A', '0–10%', '10–20%', '20–30%', '30–40%', '40–50%', '50–60%', '60–70%', '70–80%', '80–90%', '90–100%', 'Exceeded'];
                        var eolIdx = Math.max(0, Math.min(em.pre_eol || 0, 3));
                        var eolBadge = E('span', {style: 'padding: 2px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; color:' + eolClrs[eolIdx] + '; background:' + eolClrs[eolIdx] + '22;'}, eolLbls[eolIdx]);
                        var emBox = makeDevBox(em.dev.toUpperCase() + (em.name ? ' (' + em.name + ')' : ''), eolBadge);
                        if (em.vendor && em.vendor !== 'Unknown') emBox.appendChild(makeRow('Manufacturer', em.vendor + (em.date ? ' (' + em.date + ')' : ''), null));
                        if (em.fwrev && em.fwrev !== '0x0' && em.fwrev !== '') emBox.appendChild(makeRow('FW Rev / HW Rev', em.fwrev + ' / ' + em.hwrev, null));
                        var la = Math.min(em.life_a || 0, 11), lb = Math.min(em.life_b || 0, 11);
                        if (em.life_a > 0) emBox.appendChild(makeBar2('Lifetime Type A', Math.min(em.life_a * 10, 100), ltLbls[la] || 'Exceeded', getDynColor(em.life_a * 10)));
                        if (em.life_b > 0) emBox.appendChild(makeBar2('Lifetime Type B', Math.min(em.life_b * 10, 100), ltLbls[lb] || 'Exceeded', getDynColor(em.life_b * 10)));
                        if (!em.life_a && !em.life_b) emBox.appendChild(makeRow('Lifetime', 'Not reported by device', '#9e9e9e'));
                        extraNode.appendChild(emBox);
                    }

                    // NVMe
                    if (hasNvme) {
                        if (hasUbi || hasMtd || hasEmmc) extraNode.appendChild(hRule());
                        extraNode.appendChild(secH('NVMe Details'));
                        var nv = res.nvme_info;
                        var nvBox = makeDevBox(nv.dev.toUpperCase() + (nv.model ? ' — ' + nv.model : ''), '');
                        if (nv.serial) nvBox.appendChild(makeRow('Serial', nv.serial, null));
                        if (nv.fw) nvBox.appendChild(makeRow('Firmware', nv.fw, null));
                        if (nv.transport) nvBox.appendChild(makeRow('Transport', nv.transport.toUpperCase(), null));
                        extraNode.appendChild(nvBox);
                    }

                    // f2fs
                    if (hasF2fs) {
                        if (hasUbi || hasMtd || hasEmmc || hasNvme) extraNode.appendChild(hRule());
                        extraNode.appendChild(secH('f2fs Statistics'));
                        res.f2fs_info.forEach(function(f) {
                            var lwStr = fmtBytesS(f.lifetime_write_kb * 1024);
                            var totSegs = (f.valid_segs || 0) + (f.dirty_segs || 0) + (f.free_segs || 0);
                            var f2Box = makeDevBox(f.dev.toUpperCase(), '');
                            if (f.lifetime_write_kb > 0) f2Box.appendChild(makeRow('Lifetime Written', lwStr, null));
                            if (f.utilization > 0) f2Box.appendChild(makeBar2('Utilization', f.utilization, f.utilization + '%', getDynColor(f.utilization)));
                            if (totSegs > 0) f2Box.appendChild(makeRow('Segments (Valid/Dirty/Free)', f.valid_segs + ' / ' + f.dirty_segs + ' / ' + f.free_segs, f.dirty_segs > 0 ? '#ffb300' : null));
                            extraNode.appendChild(f2Box);
                        });
                    }
                })();
                (function() {
                    var extraNode = document.getElementById('hw-int-storage-extra');
                    var horizDiv = document.getElementById('hw-dsk-horiz-divider');
                    if (horizDiv && extraNode) horizDiv.style.display = extraNode.children.length > 0 ? '' : 'none';
                })();

                if (res.block_devs && Array.isArray(res.block_devs)) {
                    var extWrapper = document.getElementById('my-ext-wrapper');
                    var driveGroups = {};
                    var now = Date.now();

                    res.block_devs.forEach(function(bdev) {
                        if (bdev.dev.indexOf('mmcblk') === 0 || bdev.dev.indexOf('mtd') === 0 || bdev.dev.indexOf('ubi') === 0 || bdev.dev.indexOf('loop') === 0 || bdev.dev.indexOf('zram') === 0) return;

                        var parent = bdev.dev.replace(/[0-9]+$/, '');
                        if (bdev.dev.indexOf('nvme') === 0) {
                            parent = bdev.dev.replace(/p[0-9]+$/, '');
                        }

                        if (!driveGroups[parent]) driveGroups[parent] = {
                            main: null,
                            parts: []
                        };

                        if (bdev.dev === parent) {
                            driveGroups[parent].main = bdev;
                        } else {
                            driveGroups[parent].parts.push(bdev);
                        }
                    });

                    var extDrives = [];
                    for (var p in driveGroups) {
                        var grp = driveGroups[p];
                        if (!grp.main && grp.parts.length > 0) {
                            grp.main = grp.parts[0];
                        }
                        if (grp.main) {
                            extDrives.push(grp);
                        }
                    }

                    if (extWrapper) {
                        extWrapper.innerHTML = '';
                        if (extDrives.length > 0) {
                            var formatSpeed = function(bytesSec) {
                                if (bytesSec > 1024 * 1024) return (bytesSec / (1024 * 1024)).toFixed(1) + ' MB/s';
                                if (bytesSec > 1024) return (bytesSec / 1024).toFixed(1) + ' KB/s';
                                return Math.round(bytesSec) + ' B/s';
                            };

                            var getStats = function(devObj) {
                                var devName = devObj.dev;
                                var curRead = parseInt(devObj.read) || 0;
                                var curWrite = parseInt(devObj.write) || 0;
                                var curRIos = parseInt(devObj.read_ios) || 0;
                                var curWIos = parseInt(devObj.write_ios) || 0;
                                var rSpeed = 0,
                                    wSpeed = 0,
                                    rIops = 0,
                                    wIops = 0;

                                if (self.prevDisk[devName]) {
                                    var prev = self.prevDisk[devName];
                                    var tDiff = (now - prev.time) / 1000.0;
                                    if (tDiff > 0) {
                                        rSpeed = Math.max(0, (curRead - prev.read) / tDiff);
                                        wSpeed = Math.max(0, (curWrite - prev.write) / tDiff);
                                        rIops = Math.max(0, (curRIos - prev.rIos) / tDiff);
                                        wIops = Math.max(0, (curWIos - prev.wIos) / tDiff);
                                    }
                                }
                                self.prevDisk[devName] = {
                                    read: curRead,
                                    write: curWrite,
                                    rIos: curRIos,
                                    wIos: curWIos,
                                    time: now
                                };
                                return {
                                    rSpeed: rSpeed,
                                    wSpeed: wSpeed,
                                    rIops: rIops,
                                    wIops: wIops
                                };
                            };

                            // Advanced Layout Engine: Dynamic dial counting!
                            var dialsCount = document.querySelectorAll('.hw-dial').length;
                            var maxColsPerCard = dialsCount > 0 ? dialsCount : 3;

                            var cards = [];
                            var currentCard = {
                                cols: []
                            };
                            var currentCol = {
                                items: [],
                                weight: 0
                            };
                            var maxWeightPerCol = 4;

                            extDrives.forEach(function(grp) {
                                var weight = 1 + grp.parts.length;

                                if (currentCol.items.length > 0 && currentCol.weight + weight > maxWeightPerCol) {
                                    currentCard.cols.push(currentCol);
                                    currentCol = {
                                        items: [],
                                        weight: 0
                                    };
                                }

                                if (currentCard.cols.length >= maxColsPerCard) {
                                    cards.push(currentCard);
                                    currentCard = {
                                        cols: []
                                    };
                                }

                                currentCol.items.push(grp);
                                currentCol.weight += weight;
                            });

                            if (currentCol.items.length > 0) {
                                currentCard.cols.push(currentCol);
                            }
                            if (currentCard.cols.length > 0) {
                                cards.push(currentCard);
                            }

                            cards.forEach(function(cardData, cardIdx) {
                                var colsCount = cardData.cols.length;

                                // Proportional sizing: card grows proportionally to column count
                                var flexStyle = 'flex: ' + colsCount + ' 1 ' + (colsCount * 280) + 'px;';
                                if (colsCount >= maxColsPerCard) {
                                    flexStyle += ' flex-basis: 100%;';
                                }

                                var titleStr = cards.length > 1 ? 'External Storage (' + (cardIdx + 1) + '/' + cards.length + ')' : 'External Storage';

                                var cardContainer = E('div', {
                                    class: 'hw-thermals-container',
                                    style: 'margin-top: 15px;'
                                });
                                var cardNode = E('div', {
                                    class: 'hw-card',
                                    style: 'justify-content: flex-start; overflow: hidden; ' + flexStyle
                                }, [
                                    E('h3', {}, titleStr),
                                    cardContainer
                                ]);

                                var domCols = [];
                                for (var i = 0; i < colsCount; i++) {
                                    // No min-width limit here! It naturally compresses to fit the row!
                                    domCols.push(E('div', {
                                        class: 'hw-thermals-col hw-thermals-col-mid'
                                    }));
                                }
                                if (domCols.length > 0) {
                                    domCols[0].className = 'hw-thermals-col hw-thermals-col-left';
                                    domCols[domCols.length - 1].className = 'hw-thermals-col hw-thermals-col-right';
                                    if (domCols.length === 1) domCols[0].className = 'hw-thermals-col'; // clean if only 1
                                }

                                cardData.cols.forEach(function(colData, colIdx) {
                                    colData.items.forEach(function(grp) {
                                        var main = grp.main;
                                        var sz = main.size ? (parseInt(main.size) / (1024 * 1024 * 1024)).toFixed(2) + ' GB' : 'Unknown';
                                        var isUsb = main.removable === '1' || main.type === 'USB';
                                        var displayType = isUsb ? 'USB' : main.type;
                                        var mStats = getStats(main);

                                        var box = E('div', {
                                            class: 'hw-progress-item',
                                            style: 'background: rgba(128,128,128,0.05); border: 1px solid var(--border-color, rgba(128,128,128,0.1)); border-radius: 8px; padding: 12px; margin-bottom: 12px; overflow: hidden;'
                                        }, [
                                            E('div', {
                                                style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid var(--border-color, rgba(128,128,128,0.2)); padding-bottom: 8px;'
                                            }, [
                                                E('span', {
                                                    style: 'font-weight: bold; font-size: 1.1em;'
                                                }, main.dev.toUpperCase()),
                                                E('span', {
                                                    style: 'color: #ffea00; font-weight: bold;'
                                                }, sz)
                                            ]),
                                            E('div', {
                                                style: 'display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.9em;'
                                            }, [
                                                E('span', {
                                                    style: 'opacity: 0.8;'
                                                }, 'Model:'),
                                                E('span', {
                                                    style: 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; text-align: right;'
                                                }, main.model)
                                            ]),
                                            E('div', {
                                                style: 'display: flex; justify-content: space-between; font-size: 0.9em; margin-bottom: 8px;'
                                            }, [
                                                E('span', {
                                                    style: 'opacity: 0.8;'
                                                }, 'Type:'),
                                                E('span', {}, displayType)
                                            ])
                                        ]);

                                        if (grp.parts.length > 0) {
                                            var partsContainer = E('div', {
                                                style: 'margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border-color, rgba(128,128,128,0.3));'
                                            });
                                            grp.parts.forEach(function(part) {
                                                var psz = part.size ? (parseInt(part.size) / (1024 * 1024 * 1024)).toFixed(2) + ' GB' : '';
                                                var formatStr = (part.fs && part.fs !== 'Unknown') ? part.fs : 'Unmounted';
                                                var pStats = getStats(part);

                                                var pRow = E('div', {
                                                    style: 'margin-bottom: 12px;'
                                                }, [
                                                    E('div', {
                                                        style: 'display: flex; justify-content: space-between; font-size: 0.9em; font-weight: bold;'
                                                    }, [
                                                        E('span', {
                                                            style: 'color: #00bcd4;'
                                                        }, part.dev.toUpperCase()),
                                                        E('span', {}, psz)
                                                    ]),
                                                    E('div', {
                                                        style: 'display: flex; justify-content: space-between; font-size: 0.85em; opacity: 0.8; margin-top: 4px;'
                                                    }, [
                                                        E('span', {}, 'Format:'),
                                                        E('span', {
                                                            style: 'color: #00bcd4;'
                                                        }, formatStr)
                                                    ]),
                                                    E('div', {
                                                        style: 'display: flex; justify-content: space-between; font-size: 0.8em; opacity: 0.7; margin-top: 6px;'
                                                    }, [
                                                        E('span', {}, 'Speed:'),
                                                        E('span', {}, 'R: ' + formatSpeed(pStats.rSpeed) + ' / W: ' + formatSpeed(pStats.wSpeed))
                                                    ]),
                                                    E('div', {
                                                        style: 'display: flex; justify-content: space-between; font-size: 0.8em; opacity: 0.6; margin-top: 2px;'
                                                    }, [
                                                        E('span', {}, 'IOPS:'),
                                                        E('span', {}, 'R: ' + Math.round(pStats.rIops) + ' / W: ' + Math.round(pStats.wIops))
                                                    ])
                                                ]);
                                                partsContainer.appendChild(pRow);
                                            });
                                            box.appendChild(partsContainer);
                                        } else {
                                            var footer = E('div', {
                                                style: 'margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border-color, rgba(128,128,128,0.3));'
                                            }, [
                                                E('div', {
                                                    style: 'display: flex; justify-content: space-between; font-size: 0.8em; opacity: 0.7; margin-top: 4px;'
                                                }, [
                                                    E('span', {}, 'Speed:'),
                                                    E('span', {}, 'R: ' + formatSpeed(mStats.rSpeed) + ' / W: ' + formatSpeed(mStats.wSpeed))
                                                ]),
                                                E('div', {
                                                    style: 'display: flex; justify-content: space-between; font-size: 0.8em; opacity: 0.6; margin-top: 2px;'
                                                }, [
                                                    E('span', {}, 'IOPS:'),
                                                    E('span', {}, 'R: ' + Math.round(mStats.rIops) + ' / W: ' + Math.round(mStats.wIops))
                                                ])
                                            ]);
                                            box.appendChild(footer);
                                        }
                                        domCols[colIdx].appendChild(box);
                                    });
                                });

                                for (var i = 0; i < domCols.length; i++) {
                                    cardContainer.appendChild(domCols[i]);
                                    if (i < domCols.length - 1) {
                                        cardContainer.appendChild(E('div', {
                                            class: 'hw-thermals-divider'
                                        }));
                                    }
                                }

                                extWrapper.appendChild(cardNode);
                            });
                        }
                    }
                }
                if (res.thermals && res.thermals.length > 0) {
                    thermCard.style.display = 'flex';
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
                    var sortedThermals = res.thermals.sort(function(a, b) {
                        return a.type.localeCompare(b.type);
                    });
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
                        if (tempC >= 80) {
                            color = '#ff1744';
                            bgCol = 'rgba(255,23,68,0.1)';
                        } else if (tempC <= 60) {
                            color = '#00bcd4';
                            bgCol = 'rgba(0,188,212,0.1)';
                        }
                        var crit = t.crit && t.crit !== 'null' ? parseInt(t.crit) : null;
                        var pass = t.pass && t.pass !== 'null' ? parseInt(t.pass) : null;
                        if (crit && crit > 1000) crit = crit / 1000;
                        if (pass && pass > 1000) pass = pass / 1000;
                        var lowerName = name.toLowerCase();
                        var targetCol = null;
                        if (lowerName.indexOf('cpu') !== -1 || lowerName.indexOf('soc') !== -1 || lowerName.indexOf('cpu_ss') !== -1 || lowerName.indexOf('top-glue') !== -1) {
                            targetCol = cpuNode;
                        } else if (lowerName.indexOf('wifi') !== -1 || lowerName.indexOf('wlan') !== -1 || lowerName.indexOf('wcss') !== -1 || lowerName.indexOf('phy') !== -1 || lowerName.indexOf('radio') !== -1 || lowerName.indexOf('mt798') !== -1 || lowerName.indexOf('ath') !== -1) {
                            targetCol = wifiNode;
                        } else {
                            targetCol = miscNode;
                        }
                        var tempDisplay = tempC.toFixed(1) + ' °C';
                        if (tempC >= 90) tempDisplay += ' ⚠️';
                        var badgeAttrs = {
                            class: 'hw-temp-badge',
                            style: 'color: ' + color + '; background: ' + bgCol + ';'
                        };
                        var rowContent = [E('div', {
                            class: 'hw-stat-row',
                            style: 'border-bottom: none; padding-bottom: 0;'
                        }, [E('span', {
                            class: 'hw-stat-label'
                        }, name), E('span', badgeAttrs, tempDisplay)])];
                        if (pass || crit) {
                            var tripsDiv = E('div', {
                                style: 'display: flex; justify-content: flex-end; gap: 6px; font-size: 0.75em; padding-top: 6px;'
                            });
                            if (pass) {
                                tripsDiv.appendChild(E('span', {
                                    style: 'color: #ffb300; background: rgba(255,179,0,0.15); padding: 2px 6px; border-radius: 4px; font-weight: 600; letter-spacing: 0.5px;'
                                }, 'PASS ' + pass.toFixed(0) + '°'));
                            }
                            if (crit) {
                                tripsDiv.appendChild(E('span', {
                                    style: 'color: #ff1744; background: rgba(255,23,68,0.15); padding: 2px 6px; border-radius: 4px; font-weight: 600; letter-spacing: 0.5px;'
                                }, 'CRIT ' + crit.toFixed(0) + '°'));
                            }
                            rowContent.push(tripsDiv);
                        }
                        var row = E('div', {
                            style: 'padding: 5px 0; border-bottom: 1px solid var(--border-color, rgba(128,128,128,0.1));'
                        }, rowContent);
                        if (targetCol) targetCol.appendChild(row);
                    });
                    if (cpuNode && cpuNode.lastChild) cpuNode.lastChild.style.borderBottom = 'none';
                    if (wifiNode && wifiNode.lastChild) wifiNode.lastChild.style.borderBottom = 'none';
                    if (miscNode && miscNode.lastChild) miscNode.lastChild.style.borderBottom = 'none';
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
                } else {
                    thermCard.style.display = 'none';
                }
                                if (res.eth_links && res.eth_links.length > 0) {
                    ethCard.style.display = 'flex';
                    var elNode = document.getElementById('hw-eth-links');
                    if (elNode) {
                        elNode.innerHTML = '';
                        res.eth_links.forEach(function(l) {
                            var st = l.speed;
                            var col = '#9e9e9e';
                            if (st.indexOf('10000') >= 0 || st.indexOf('2500') >= 0 || st.indexOf('1000') >= 0) col = '#00bcd4';
                            else if (st.indexOf('100') >= 0 || st.indexOf('10') >= 0) col = '#ffea00';
                            
                            var rxErr = parseInt(l.rx_err) || 0, txErr = parseInt(l.tx_err) || 0;
                            var rxDrop = parseInt(l.rx_drop) || 0, txDrop = parseInt(l.tx_drop) || 0;
                            
                            var box = E('div', { style: 'padding: 10px; background: rgba(128,128,128,0.05); border-radius: 6px; border-left: 4px solid ' + col + '; margin-bottom: 4px;' }, [
                                E('div', { style: 'display: flex; justify-content: space-between; align-items: center;' }, [
                                    E('div', { style: 'display: flex; align-items: center; gap: 8px;' }, [
                                        E('div', { style: 'width: 10px; height: 10px; border-radius: 50%; background-color: ' + col + '; box-shadow: 0 0 5px ' + col + '; flex-shrink: 0;' }),
                                        E('span', { style: 'font-weight: bold;' }, l.iface.toUpperCase())
                                    ]),
                                    E('span', { style: 'color:' + col + ';' }, st === 'Down' ? 'Disconnected' : st + ' Mbps (' + l.duplex + ')')
                                ])
                            ]);
                            
                            if (st !== 'Down') {
                                var errColor = (rxErr > 0 || txErr > 0 || rxDrop > 0 || txDrop > 0) ? '#ff5252' : 'currentColor';
                                box.appendChild(E('div', { style: 'display: flex; justify-content: space-between; font-size: 0.85em; opacity: 0.8; margin-top: 6px; border-top: 1px dashed rgba(128,128,128,0.3); padding-top: 6px;' }, [
                                    E('span', {}, 'Errors/Drops:'),
                                    E('span', { style: 'color:' + errColor + ';' }, 'Rx: ' + rxErr + '/' + rxDrop + ' | Tx: ' + txErr + '/' + txDrop)
                                ]));
                            }
                            elNode.appendChild(box);
                        });
                    }
                } else {
                    ethCard.style.display = 'none';
                }

                var validPcie = [];
                if (res.pcie_devs) {
                    validPcie = res.pcie_devs.filter(function(p){ var n = p.name.toLowerCase(); return p.speed && p.speed !== 'Unknown' && n.indexOf('unknown device')===-1 && n.indexOf('controller')===-1 && n.indexOf('bridge')===-1 && n.indexOf('root')===-1; });
                }
                var usbDevs = (res.usb_devs || []).filter(function(u){ var n = (u.name || '').trim(); return n && n !== 'Unknown' && n !== 'Unknown Device'; });
                // Physical USB port wiring can't be read reliably from the controller:
                // a USB 3.0 controller often exposes a 2.0-only port. So the port spec
                // is hardcoded per known JioRouter board and omitted for everything else.
                var boardId = res.board || '';
                var hwPortStr = '';
                if (/JIDU6[J0-9]11/.test(boardId)) hwPortStr = 'USB 3.0 (1 Physical Port)';
                else if (/JIDU6[J0-9]01/.test(boardId)) hwPortStr = 'USB 2.0 (1 Physical Port)';
                else if (boardId.indexOf('JIDU6700') !== -1) hwPortStr = 'USB 2.0 (1 Physical Port)';
                var hasUsb = hwPortStr !== '' || usbDevs.length > 0;

                if (validPcie.length > 0 || hasUsb) {
                    pcieUsbCard.style.display = 'flex';
                    var puNode = document.getElementById('hw-pcie-usb');
                    if (puNode) {
                        puNode.innerHTML = '';
                        if (validPcie.length > 0) {
                            puNode.appendChild(E('h4', { style: 'margin: 0 0 8px 0; font-size: 0.85em; opacity: 0.7; text-transform: uppercase; letter-spacing: 1px;' }, 'PCI-e Bus'));
                            validPcie.forEach(function(p) {
                                var speedStr = p.speed + ' ' + p.width;
                                if (p.max_speed && p.max_speed !== 'Unknown' && p.speed !== p.max_speed) speedStr += ' (Max: ' + p.max_speed + ')';
                                puNode.appendChild(E('div', { style: 'padding: 10px; background: rgba(128,128,128,0.05); border-radius: 6px; margin-bottom: 6px;' }, [
                                    E('div', { style: 'font-weight: bold; margin-bottom: 4px;' }, p.name),
                                    E('div', { style: 'display: flex; justify-content: space-between; font-size: 0.85em; opacity: 0.8;' }, [
                                        E('span', {}, 'Link Speed:'),
                                        E('span', { style: p.speed !== p.max_speed ? 'color:#ffea00;' : '' }, speedStr)
                                    ])
                                ]));
                            });
                        }
                        if (hasUsb) {
                            puNode.appendChild(E('h4', { style: 'margin: ' + (validPcie.length > 0 ? '8px' : '0') + ' 0 8px 0; font-size: 0.85em; opacity: 0.7; text-transform: uppercase; letter-spacing: 1px;' }, 'USB Bus'));
                            if (hwPortStr) {
                                puNode.appendChild(E('div', { style: 'padding: 10px; background: rgba(128,128,128,0.05); border-radius: 6px; margin-bottom: 6px;' }, [
                                    E('div', { style: 'display: flex; justify-content: space-between; font-size: 0.85em;' }, [
                                        E('span', {}, 'Physical Port:'),
                                        E('span', { style: 'color:#00bcd4; font-weight: bold;' }, hwPortStr)
                                    ])
                                ]));
                            }
                            usbDevs.forEach(function(u) {
                                var spd = parseInt(u.speed) || 0;
                                var col = spd >= 5000 ? '#00bcd4' : spd >= 480 ? '#ffea00' : '#9e9e9e';
                                var spdLabel = spd >= 10000 ? 'USB 3.2 (' + spd + ' Mbps)' : spd >= 5000 ? 'USB 3.0 (' + spd + ' Mbps)' : spd >= 480 ? 'USB 2.0 (' + spd + ' Mbps)' : spd > 0 ? 'USB 1.x (' + spd + ' Mbps)' : '';
                                var rows = [E('div', { style: 'font-weight: bold; margin-bottom: 4px;' }, u.name)];
                                if (spdLabel) rows.push(E('div', { style: 'display: flex; justify-content: space-between; font-size: 0.85em; opacity: 0.8;' }, [E('span', {}, 'Speed:'), E('span', { style: 'color:' + col + ';' }, spdLabel)]));
                                var ver = u.version ? u.version.trim() : '';
                                if (ver) rows.push(E('div', { style: 'display: flex; justify-content: space-between; font-size: 0.85em; opacity: 0.8;' }, [E('span', {}, 'USB Version:'), E('span', {}, ver)]));
                                puNode.appendChild(E('div', { style: 'padding: 10px; background: rgba(128,128,128,0.05); border-radius: 6px; margin-bottom: 6px;' }, rows));
                            });
                        }
                    }
                } else {
                    pcieUsbCard.style.display = 'none';
                }

                if (res.wifi_radios && res.wifi_radios.length > 0) {
                    var wfNode = document.getElementById('hw-wifi-radios');
                    if (wfNode) {
                        wfNode.innerHTML = '';
                        var wifiRendered = 0;
                        res.wifi_radios.forEach(function(w) {
                            if ((!w.band || w.band === 'Unknown') && (!w.hwmode || w.hwmode === 'Unknown')) return;
                            var bKey = w.band.replace(' GHz', 'GHz');
                            var bCap = (w.phycap && w.phycap.bands && w.phycap.bands[bKey]) ? w.phycap.bands[bKey] : null;

                            // Strictly real data from upstream kernel sources only
                            var phycapSp = w.phycap ? parseInt(w.phycap.max_spatial) : 0;
                            var hwMaxSp = phycapSp > 1 ? phycapSp : (parseInt(w.hw_nss) > 1 ? parseInt(w.hw_nss) : 0);
                            var hwMaxCw = (w.phycap && w.phycap.max_cw && parseInt(w.phycap.max_cw) >= 20) ? w.phycap.max_cw : null;
                            var hwMaxCwNum = hwMaxCw ? (parseInt(hwMaxCw.replace(/[^0-9]/g, '')) || 0) : 0;
                            var currCwNum = parseInt(w.curr_width) || 0;
                            var currCwStr = currCwNum > 0 ? currCwNum + ' MHz' : null;
                            var cfgNss = parseInt(w.cfg_nss) || 0;

                            // Chip HW Max: only from iw list phycap — no guessing
                            var chipMaxBr = (hwMaxSp > 0 && hwMaxCw && w.hwmode) ? calcMaxBitrate(w.hwmode, hwMaxCw, hwMaxSp) : null;

                            // Config Max: only shown when software config differs from hw max
                            var cfgMaxBr = null;
                            var cfgMaxLabel = null;
                            if (chipMaxBr) {
                                var cfgSp = cfgNss > 0 ? cfgNss : hwMaxSp;
                                var cfgCw = currCwStr || hwMaxCw;
                                var cfgCwNum = currCwNum > 0 ? currCwNum : hwMaxCwNum;
                                if (cfgSp !== hwMaxSp || cfgCwNum !== hwMaxCwNum) {
                                    cfgMaxBr = calcMaxBitrate(w.hwmode, cfgCw, cfgSp);
                                    cfgMaxLabel = cfgSp + 'x' + cfgSp + ' MIMO @ ' + cfgCw;
                                }
                            }

                            var suppChs = (w.channels && w.channels.length > 0) ? w.channels.split(',') : (bCap ? bCap.enabled : []);
                            var cleanHw = w.hardware ? w.hardware.replace(/^.*\[/, '').replace(/\]$/, '') : '';
                            var chStr = (w.channel && w.channel !== 'Unknown' && w.channel !== 'unknown' && w.channel !== '0') ? w.channel : null;

                            wifiRendered++;
                            wfNode.appendChild(E('div', { style: 'padding: 10px; background: rgba(128,128,128,0.05); border-radius: 6px; margin-bottom: 6px;' }, [
                                E('div', { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid rgba(128,128,128,0.2); padding-bottom: 8px;' }, [
                                    E('span', { style: 'font-weight: bold;' }, w.iface.toUpperCase() + ' (' + w.band + ')'),
                                    chStr ? E('span', { style: 'color:#00bcd4; font-size: 0.9em;' }, 'Ch: ' + chStr) : E('span', {}, '')
                                ]),
                                cleanHw && cleanHw !== 'Unknown' ? E('div', { class: 'hw-wifi-ssid', style: 'font-size: 0.9em; margin-bottom: 4px;' }, cleanHw) : '',
                                w.hwmode && w.hwmode !== 'Unknown' ? E('div', { class: 'hw-wifi-detail' }, 'HW Mode(s): ' + w.hwmode) : '',
                                chipMaxBr ? E('div', { class: 'hw-wifi-detail' }, 'Chip HW Max: ' + chipMaxBr + ' (' + hwMaxSp + 'x' + hwMaxSp + ' MIMO @ ' + hwMaxCw + ')') : '',
                                cfgMaxBr ? E('div', { class: 'hw-wifi-detail', style: 'color: #00bcd4;' }, 'Config Max: ' + cfgMaxBr + ' (' + cfgMaxLabel + ')') : '',
                                chStr ? E('div', { class: 'hw-wifi-detail' }, 'Current Channel: ' + chStr) : '',
                                hwMaxCw ? E('div', { class: 'hw-wifi-detail' }, 'Max Channel Width: ' + hwMaxCw) : '',
                                w.txpower && w.txpower !== 'Unknown' ? E('div', { class: 'hw-wifi-detail' }, 'Max TX Power: ' + w.txpower) : '',
                                suppChs && suppChs.length > 0 ? E('div', { class: 'hw-wifi-detail', style: 'margin-top:4px;' }, 'Supported Channels: ' + groupChannels(w.band, suppChs)) : '',
                                bCap && bCap.disabled && bCap.disabled.length > 0 ? E('div', { class: 'hw-wifi-detail', style: 'color: #ff5252; font-size: 0.85em; padding-left: 8px;' }, 'Disabled (Regdomain): ' + bCap.disabled.join(', ')) : '',
                                bCap && bCap.exceptions && bCap.exceptions.length > 0 ? E('div', { class: 'hw-wifi-detail', style: 'color: #ffb74d; font-size: 0.85em; padding-left: 8px;' }, 'Radar Detection (DFS): ' + bCap.exceptions.join(', ')) : ''
                            ]));
                        });
                        wifiCard.style.display = wifiRendered > 0 ? 'flex' : 'none';
                    }
                } else {
                    wifiCard.style.display = 'none';
                }

                // System Info card
                var sysInfoGrid = document.getElementById('hw-sysinfo-grid');
                if (sysInfoGrid && res.sys_info) {
                    sysInfoGrid.innerHTML = '';
                    var si = res.sys_info;
                    // Header: board name + OS badge
                    var boardName = res.board || si.hostname || 'OpenWrt Device';
                    var siHeader = E('div', {style: 'display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:15px; padding-bottom:12px; border-bottom:1px solid var(--border-color,rgba(128,128,128,0.2));'});
                    var siTitle = E('div', {});
                    siTitle.appendChild(E('div', {style: 'font-size:1.1em; font-weight:600; opacity:0.9;'}, boardName));
                    if (res.model) siTitle.appendChild(E('div', {style: 'font-size:0.8em; opacity:0.55; margin-top:3px;'}, res.model));
                    siHeader.appendChild(siTitle);
                    var osStr = (si.distrib || 'OpenWrt') + (si.release ? ' ' + si.release : '');
                    if (si.revision) osStr += ' (' + si.revision + ')';
                    siHeader.appendChild(E('span', {style: 'font-size:0.85em; padding:4px 10px; border-radius:6px; background:rgba(0,188,212,0.1); border:1px solid rgba(0,188,212,0.3); color:#00bcd4; white-space:nowrap;'}, osStr));
                    sysInfoGrid.appendChild(siHeader);
                    // Info grid — auto-fill columns, wraps gracefully on mobile
                    var siGrid = E('div', {style: 'display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:5px 20px; margin-bottom:12px;'});
                    var addSi = function(lbl, val) {
                        siGrid.appendChild(E('div', {class:'hw-stat-row', style:'margin:0;'}, [
                            E('span', {class:'hw-stat-label', style:'font-size:0.88em;'}, lbl),
                            E('span', {class:'hw-stat-value', style:'font-size:0.88em;'}, val)
                        ]));
                    };
                    if (si.hostname) addSi('Hostname', si.hostname);
                    if (si.kver) addSi('Kernel', si.kver);
                    if (si.arch) addSi('Architecture', si.arch);
                    if (si.soc_family) addSi('SoC Family', si.soc_family);
                    if (si.soc_machine) addSi('Machine', si.soc_machine);
                    if (si.soc_id) addSi('SoC ID', si.soc_id);
                    if (si.soc_revision) addSi('SoC Revision', si.soc_revision);
                    if (si.soc_serial) addSi('SoC Serial', si.soc_serial);
                    var fmtCache = function(b) { return b >= 1048576 ? (b/1048576).toFixed(0)+' MB' : (b/1024).toFixed(0)+' KB'; };
                    if (si.l0 > 0) addSi('L0 Cache', fmtCache(si.l0));
                    if (si.l1d > 0 || si.l1i > 0) {
                        var cArr = [];
                        if (si.l1d > 0) cArr.push('L1d '+fmtCache(si.l1d));
                        if (si.l1i > 0) cArr.push('L1i '+fmtCache(si.l1i));
                        addSi('L1 Cache', cArr.join(' / '));
                    }
                    if (si.l2 > 0) addSi('L2 Cache', fmtCache(si.l2));
                    if (si.l3 > 0) addSi('L3 Cache', fmtCache(si.l3));
                    if (si.l4 > 0) addSi('L4 Cache', fmtCache(si.l4));
                    sysInfoGrid.appendChild(siGrid);
                    // CPU Security vulnerability chips
                    if (si.vulns && typeof si.vulns === 'object' && Object.keys(si.vulns).length > 0) {
                        var vulnDiv = E('div', {style: 'padding-top:10px; border-top:1px solid var(--border-color,rgba(128,128,128,0.15));'});
                        vulnDiv.appendChild(E('div', {style: 'font-size:0.75em; opacity:0.5; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;'}, 'CPU Security'));
                        var chipRow = E('div', {style: 'display:flex; flex-wrap:wrap; gap:6px;'});
                        for (var vn in si.vulns) {
                            var vst = si.vulns[vn];
                            var isOk = vst.indexOf('Not affected') === 0;
                            var isMit = vst.indexOf('Mitigated') === 0;
                            var vc = isOk ? '#00bcd4' : isMit ? '#ffb300' : '#ff5252';
                            var vdn = vn.replace(/_/g, ' ');
                            var vshort = isOk ? 'OK' : isMit ? 'Mitigated' : 'Vulnerable';
                            chipRow.appendChild(E('span', {style: 'font-size:0.75em; padding:3px 8px; border-radius:4px; border:1px solid '+vc+'44; color:'+vc+'; background:'+vc+'18; white-space:nowrap;'}, vdn+': '+vshort));
                        }
                        vulnDiv.appendChild(chipRow);
                        sysInfoGrid.appendChild(vulnDiv);
                    }
                }

            }).catch(function(err) {
                console.error(err);
            });
        }, 3);

        return container;
    },

    handleSaveApply: null,
    handleSave: null,
    handleReset: null
});
