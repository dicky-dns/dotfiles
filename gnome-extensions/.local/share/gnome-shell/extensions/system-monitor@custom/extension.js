// System Monitor (Custom) – SVG icons, NET globe single item, widths via CSS (GNOME 46, no GSettings)

import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

// ---------- tiny prefs (KeyFile di ~/.config/system-monitor-custom/settings.ini)
const CFG_DIR  = GLib.build_filenamev([GLib.get_user_config_dir(), 'system-monitor-custom']);
const CFG_PATH = GLib.build_filenamev([CFG_DIR, 'settings.ini']);
const CFG_GROUP = 'settings';

function loadPrefs() {
  const kf = new GLib.KeyFile();
  try { kf.load_from_file(CFG_PATH, GLib.KeyFileFlags.NONE); } catch {}
  const b = (k, d) => { try { return kf.get_boolean(CFG_GROUP, k); } catch { return d; } };
  const u = (k, d) => { try { return kf.get_integer(CFG_GROUP, k); } catch { return d; } };
  return {
    show_cpu:  b('show_cpu',  true),
    show_mem:  b('show_mem',  true),
    show_swap: b('show_swap', true),
    show_temp: b('show_temp', true),
    show_net:  b('show_net',  true), // globe single item
    refresh:   Math.max(1, u('refresh', 1)),
  };
}
function savePrefs(p) {
  try { GLib.mkdir_with_parents(CFG_DIR, 0o755); } catch {}
  const kf = new GLib.KeyFile();
  kf.set_boolean(CFG_GROUP, 'show_cpu',  !!p.show_cpu);
  kf.set_boolean(CFG_GROUP, 'show_mem',  !!p.show_mem);
  kf.set_boolean(CFG_GROUP, 'show_swap', !!p.show_swap);
  kf.set_boolean(CFG_GROUP, 'show_temp', !!p.show_temp);
  kf.set_boolean(CFG_GROUP, 'show_net',  !!p.show_net);
  kf.set_integer(CFG_GROUP, 'refresh',   p.refresh|0);
  GLib.file_set_contents(CFG_PATH, kf.to_data()[0]);
}

// ---------- utils
function readFile(path) {
  try {
    const [ok, bytes] = GLib.file_get_contents(path);
    if (!ok) return null;
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    try {
      const f = Gio.File.new_for_path(path);
      const [ok, bytes] = f.load_contents(null);
      if (!ok) return null;
      return new TextDecoder('utf-8').decode(bytes);
    } catch { return null; }
  }
}

const pct = v => (v == null || isNaN(v) ? '--%' : `${Math.max(0, Math.min(100, Math.round(v)))}%`);

// Format NET, minimal unit = kB (tidak ada "B"). 2 digit angka: <10 satu desimal, ≥10 bulat.
function fmtRateKB(bps) {
  if (bps == null || isNaN(bps)) return '0.0 KB';
  let v = Math.max(0, bps) / 1024; // start in KB
  const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let i = 0;
  while (v >= 100 && i < units.length - 1) { v /= 1024; i++; }
  let n;
  if (v < 10) {
    n = v.toFixed(1);
    if (n === '10.0') n = '10';
  } else {
    n = Math.round(v).toString();
  }
  return `${n} ${units[i]}`;
}

// ---------- icons (SVG di folder icons/)
const ICON_DIRS = [
  GLib.build_filenamev([GLib.get_home_dir(), '.local/share/gnome-shell/extensions/system-monitor@custom/icons']),
  '/usr/share/gnome-shell/extensions/system-monitor@custom/icons',
  GLib.build_filenamev([GLib.get_user_data_dir(), 'gnome-shell/extensions/system-monitor@custom/icons']),
];
function iconFile(name) {
  for (const dir of ICON_DIRS) {
    try {
      const f = Gio.File.new_for_path(GLib.build_filenamev([dir, name]));
      if (f.query_exists(null)) return f;
    } catch {}
  }
  return null;
}
function iconWidget(name, fallbackText) {
  const f = iconFile(name);
  if (f) return new St.Icon({ gicon: new Gio.FileIcon({ file: f }), icon_size: 16, style_class: 'sm-icon' });
  return new St.Label({ text: fallbackText, style_class: 'sm-fallback' });
}

// item: ICON + VALUE (value dilebarin via CSS; di sini cuma kasih style-class)
function makeSvgItem(iconName, fallbackText, valueClass) {
  const box = new St.BoxLayout({ style_class: 'sm-item' });
  const icn = iconWidget(iconName, fallbackText);
  const val = new St.Label({ text: '', style_class: 'sm-value' });
  if (valueClass) val.add_style_class_name(valueClass);
  val.set_x_align(Clutter.ActorAlign.END);     // rata kanan
  box.add_child(icn);
  box.add_child(val);
  return { box, val, icn };
}

function setTooltip(actor, text) {
  if (!actor) return;
  const t = text ?? '';
  try {
    if (typeof actor.set_tooltip_text === 'function') {
      actor.set_tooltip_text(t);
    } else if ('tooltip_text' in actor) {
      actor.tooltip_text = t;
    }
    if (typeof actor.set_accessible_name === 'function') {
      actor.set_accessible_name(t);
    } else if ('accessible_name' in actor) {
      actor.accessible_name = t;
    }
  } catch {}
}

// ---------- indicator
const Monitor = GObject.registerClass(
class Monitor extends PanelMenu.Button {
  _init() {
    super._init(0.0, 'System Monitor (Custom)');
    this._prefs = loadPrefs();

    this._wrap = new St.BoxLayout({ style_class: 'sm-container' });
    this.add_child(this._wrap);

    // SVG icons (fallback teks kalau file tidak ada)
    this._cpu  = makeSvgItem('cpu.svg',   'CPU', 'sm-val-cpu');  // ex: "100%"
    this._mem  = makeSvgItem('ram.svg',   'RAM', 'sm-val-mem');
    this._swap = makeSvgItem('swap.svg',  'SWP', 'sm-val-swp');
    this._temp = makeSvgItem('temp.svg',  '°C',  'sm-val-temp'); // ex: "100°C"
    // Network: single globe + "down | up"
    this._net  = makeSvgItem('globe.svg', '🌐',  'sm-val-net');

    for (const it of [this._cpu, this._mem, this._swap, this._temp, this._net])
      this._wrap.add_child(it.box);

    this._buildMenu();

    this._prevCpu = null;
    this._prevNet = null;
    this._tempSensors = null;

    this._applyVisibility();
    this._start();
  }

  _buildMenu() {
    const title = new PopupMenu.PopupMenuItem('Show in panel', { reactive: false });
    title.actor.add_style_class_name('sm-title');
    this.menu.addMenuItem(title);

    const toggle = (label, key) => {
      const mi = new PopupMenu.PopupSwitchMenuItem(label, !!this._prefs[key]);
      mi.connect('toggled', (_i, state) => { this._prefs[key] = state; savePrefs(this._prefs); this._applyVisibility(); });
      this.menu.addMenuItem(mi);
      return mi;
    };

    this._swCpu  = toggle('CPU',            'show_cpu');
    this._swMem  = toggle('Memory',         'show_mem');
    this._swSwap = toggle('Swap',           'show_swap');
    this._swTemp = toggle('Temperature', 'show_temp');
    this._swNet  = toggle('Network ↓ ↑','show_net');

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    const openMon = new PopupMenu.PopupMenuItem('Open System Monitor');
    openMon.connect('activate', () => {
      try { Gio.Subprocess.new(['gnome-system-monitor'], Gio.SubprocessFlags.NONE); } catch (e) { logError(e); }
    });
    this.menu.addMenuItem(openMon);
  }

  _applyVisibility() {
    this._cpu.box.visible  = !!this._prefs.show_cpu;
    this._mem.box.visible  = !!this._prefs.show_mem;
    this._swap.box.visible = !!this._prefs.show_swap;
    this._temp.box.visible = !!this._prefs.show_temp;
    this._net.box.visible  = !!this._prefs.show_net;
  }

  _start() {
    const sec = Math.max(1, this._prefs.refresh|0);
    this._refresh();
    this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, sec, () => { this._refresh(); return true; });
  }
  _stop() { if (this._timer) { GLib.source_remove(this._timer); this._timer = 0; } }

  _refresh() {
    this._updCPU();
    this._updMemSwap();
    this._updTemp();
    this._updNet();
  }

  // ---- CPU
  _updCPU() {
    const line = (readFile('/proc/stat') || '').split('\n')[0] || '';
    const parts = line.trim().split(/\s+/);
    if (parts[0] !== 'cpu') return;

    const v = parts.slice(1).map(n => parseInt(n, 10));
    const idle = (v[3] || 0) + (v[4] || 0);
       const total = v.reduce((a,b)=>a+b,0);

    if (this._prevCpu) {
      const dt = total - this._prevCpu.total;
      const di = idle  - this._prevCpu.idle;
      const usage = dt > 0 ? 100 * (dt - di) / dt : 0;
      this._cpu.val.text = pct(usage);
    } else {
      this._cpu.val.text = '0%';
    }
    this._prevCpu = { total, idle };
  }

  // ---- Memory & Swap
  _updMemSwap() {
    const s = readFile('/proc/meminfo') || '';
    const map = {};
    for (const ln of s.split('\n')) {
      const m = ln.match(/^(\w+):\s+(\d+)/);
      if (m) map[m[1]] = parseInt(m[2], 10);
    }
    const memTotal = map['MemTotal'] || 0;
    const memAvail = map['MemAvailable'] || 0;
    const memUsed  = Math.max(0, memTotal - memAvail);
    const memPct   = memTotal ? (100 * memUsed / memTotal) : 0;
    this._mem.val.text = pct(memPct);

    const swapTotal = map['SwapTotal'] || 0;
    const swapFree  = map['SwapFree']  || 0;
    const swapUsed  = Math.max(0, swapTotal - swapFree);
    const swapPct   = swapTotal ? (100 * swapUsed / swapTotal) : 0;
    this._swap.val.text = pct(swapPct);
  }

  // ---- Temperature
  _scoreTempLabel(label) {
    if (!label) return 0;
    const l = label.toLowerCase();
    const scores = [
      { re: /(tctl|tdie)/, weight: 120 },
      { re: /(package|cpu package|coretemp|zenpower|k10temp)/, weight: 110 },
      { re: /(cpu|core|junction)/, weight: 100 },
      { re: /(soc|chipset|pch)/, weight: 80 },
      { re: /(gpu|graphics)/, weight: 60 },
      { re: /(thermal|board|acpi)/, weight: 20 },
    ];
    for (const { re, weight } of scores) {
      if (re.test(l)) return weight;
    }
    return 10;
  }
  _findTempSensors() {
    const sensors = [];
    let idx = 0;
    const addSensor = (path, label) => {
      sensors.push({ path, label, score: this._scoreTempLabel(label), index: idx++ });
    };

    const readTrimmed = file => {
      const s = readFile(file);
      return s ? s.trim() : '';
    };

    try {
      const hwmon = Gio.File.new_for_path('/sys/class/hwmon');
      const devices = hwmon.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);
      let devInfo;
      while ((devInfo = devices.next_file(null)) !== null) {
        const base = hwmon.get_child(devInfo.get_name());
        const name = readTrimmed(base.get_child('name').get_path());
        const entries = base.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);
        let entryInfo;
        while ((entryInfo = entries.next_file(null)) !== null) {
          const fname = entryInfo.get_name();
          if (!fname.startsWith('temp') || !fname.endsWith('_input')) continue;
          const baseName = fname.slice(0, -6);
          let label = '';
          try {
            const labelPath = base.get_child(`${baseName}_label`);
            label = readTrimmed(labelPath.get_path());
          } catch {}
          if (!label) label = name || baseName || fname;
          addSensor(base.get_child(fname).get_path(), label);
        }
      }
    } catch {}

    try {
      const thermal = Gio.File.new_for_path('/sys/class/thermal');
      const zones = thermal.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);
      let zInfo;
      while ((zInfo = zones.next_file(null)) !== null) {
        const zname = zInfo.get_name();
        if (!zname.startsWith('thermal_zone')) continue;
        const zone = thermal.get_child(zname);
        const tempPath = zone.get_child('temp');
        let type = '';
        try { type = readTrimmed(zone.get_child('type').get_path()); } catch {}
        addSensor(tempPath.get_path(), type || zname);
      }
    } catch {}

    sensors.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    });
    return sensors;
  }
  _updTemp() {
    if (!this._tempSensors) this._tempSensors = this._findTempSensors();
    let best = null;

    for (const sensor of this._tempSensors) {
      const raw = readFile(sensor.path);
      if (!raw) continue;
      const value = parseInt(raw, 10);
      if (isNaN(value) || value <= 0) continue;
      const celsius = value >= 1000 ? value / 1000 : value;
      if (!isFinite(celsius)) continue;

      if (!best || sensor.score > best.sensor.score ||
        (sensor.score === best.sensor.score && celsius > best.celsius)) {
        best = { sensor, celsius };
      }
    }

    if (!best) {
      this._temp.val.text = '--°C';
      setTooltip(this._temp.box, 'No temperature sensors');
      this._tempSensors = null; // rescan next time
      return;
    }

    this._temp.val.text = `${Math.round(best.celsius)}°C`;
    setTooltip(this._temp.box, `${best.sensor.label} (${best.celsius.toFixed(1)}°C)`);
  }

  // ---- Network (single globe: "down | up", min unit kB)
  _ifaces() {
    const dev = readFile('/proc/net/dev') || '';
    return dev.split('\n').slice(2).map(l => l.trim()).filter(Boolean)
      .map(l => l.split(':')[0].trim()).filter(n => n && n !== 'lo');
  }
  _netTotals() {
    const dev = readFile('/proc/net/dev');
    if (!dev) return null;
    const want = new Set(this._ifaces());
    let rx = 0, tx = 0;
    for (const line of dev.split('\n').slice(2)) {
      if (!line.includes(':')) continue;
      const [ifraw, rest] = line.trim().split(':');
      const name = ifraw.trim();
      if (!name || name === 'lo' || (want.size && !want.has(name))) continue;
      const cols = rest.trim().split(/\s+/).map(x => parseInt(x, 10));
      if (cols.length >= 16) { rx += cols[0]; tx += cols[8]; }
    }
    return { rx, tx, t: GLib.get_monotonic_time() / 1_000_000 };
  }
  _updNet() {
    const now = this._netTotals();
    if (!now) { this._net.val.text = '0.0 kB | 0.0 kB'; return; }
    if (!this._prevNet) { this._prevNet = now; this._net.val.text = '0.0 kB | 0.0 kB'; return; }

    const dt  = now.t  - this._prevNet.t;
    const dRx = now.rx - this._prevNet.rx;
    const dTx = now.tx - this._prevNet.tx;
    this._prevNet = now;

    const down = dt > 0 ? dRx / dt : 0; // bytes/s
    const up   = dt > 0 ? dTx / dt : 0; // bytes/s
    this._net.val.text = `${fmtRateKB(down)} | ${fmtRateKB(up)}`;
  }

  destroy() { this._stop(); super.destroy(); }
});

export default class Extension {
  enable() {
    this._indicator = new Monitor();
    Main.panel.addToStatusArea('system-monitor-custom', this._indicator, 1, 'right');
  }
  disable() {
    if (this._indicator) this._indicator.destroy();
    this._indicator = null;
  }
}
