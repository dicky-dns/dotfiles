// GNOME 46, ESModules
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

const WM = global.workspaceManager;

export default class Extension {
  enable() {
    this._signals = [];

    // Widget utama (tanpa menu dropdown)
    this._indicator = new PanelMenu.Button(0.0, 'workspace-pills', false);
    this._box = new St.BoxLayout({
      style_class: 'wpills-container',
      x_expand: false,
      y_expand: true,
      y_align: Clutter.ActorAlign.CENTER,
      reactive: true,
      track_hover: true,
    });
    this._indicator.add_child(this._box);

    // Scroll untuk pindah workspace
    this._box.connect('scroll-event', (_, event) => {
      const dir = event.get_scroll_direction();
      const cur = WM.get_active_workspace_index();
      const last = WM.n_workspaces - 1;
      if (dir === Clutter.ScrollDirection.UP) {
        const next = Math.max(0, cur - 1);
        if (next !== cur) WM.get_workspace_by_index(next).activate(global.get_current_time());
      } else if (dir === Clutter.ScrollDirection.DOWN) {
        const next = Math.min(last, cur + 1);
        if (next !== cur) WM.get_workspace_by_index(next).activate(global.get_current_time());
      }
      return Clutter.EVENT_STOP;
    });

    // Klik titik untuk lompat workspace
    this._box.connect('button-press-event', () => Clutter.EVENT_STOP);

    // Tambahkan ke panel (kiri biar estetik; ganti 'right' kalau mau di kanan)
    Main.panel.addToStatusArea('workspace-pills', this._indicator, 1, 'left');

    // Render awal & hook sinyal
    this._rebuild();
    this._signals.push(WM.connect('workspace-switched', () => this._syncActive()));
    this._signals.push(WM.connect('notify::n-workspaces', () => this._rebuild()));
  }

  disable() {
    this._signals?.forEach(s => s && WM.disconnect(s));
    this._signals = [];
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
      this._box = null;
    }
  }

  _rebuild() {
    // Bersihkan isi box
    this._box.destroy_all_children();

    const n = WM.n_workspaces;
    for (let i = 0; i < n; i++) {
      const isActive = i === WM.get_active_workspace_index();
      const dot = new St.Button({
        style_class: isActive ? 'wpill-active' : 'wpill-dot',
        reactive: true,
        can_focus: false,
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
      });

      // Klik = pindah
      dot.connect('clicked', () => {
        WM.get_workspace_by_index(i).activate(global.get_current_time());
      });

      this._box.add_child(dot);

      // Spasi antar titik
      if (i < n - 1) {
        this._box.add_child(new St.Widget({ width: 8 })); // jarak
      }
    }
  }

  _syncActive() {
    // Update style tanpa rebuild total
    const children = this._box?.get_children() || [];
    const cur = WM.get_active_workspace_index();

    // children berisi: [dot, spacer, dot, spacer, ...]
    let dotIndex = 0;
    for (let i = 0; i < children.length; i += 2) {
      const actor = children[i];
      const isActive = (dotIndex === cur);
      actor.set_style_class_name(isActive ? 'wpill-active' : 'wpill-dot');
      dotIndex++;
    }
  }
}
