# Drive WebKitGTK: load URL, open/close the real Web Inspector on a schedule, print page state.
import sys, json, gi
gi.require_version('Gtk','3.0'); gi.require_version('WebKit2','4.1')
from gi.repository import Gtk, WebKit2, GLib
url=sys.argv[1]; plan=json.loads(sys.argv[2]); total=float(sys.argv[3]); expr=sys.argv[4]
win=Gtk.Window(); win.set_default_size(1200,800)
wv=WebKit2.WebView(); st=wv.get_settings(); st.set_enable_developer_extras(True)
win.add(wv); win.show_all()
insp=wv.get_inspector()
t0=GLib.get_monotonic_time()
def el(): return (GLib.get_monotonic_time()-t0)/1e6
def log(*a): print('[%5.1fs]'%el(),*a,flush=True)
insp.connect('attach', lambda *a: (log('SIGNAL inspector attach'),False)[1])
insp.connect('open-window', lambda *a: (log('SIGNAL inspector open-window'),False)[1])
wv.connect('context-menu', lambda *a: (log('SIGNAL context-menu shown'),True)[1])
win.connect('key-press-event', lambda w,e: (log('GTK key', e.keyval),False)[1])
for at,act in plan:
    def do(act=act):
        if act=='open': insp.show(); log('INSPECTOR OPEN')
        elif act=='open-detached': insp.detach(); insp.show(); log('INSPECTOR OPEN (detached)')
        elif act=='close': insp.close(); log('INSPECTOR CLOSED')
        elif act=='reload': wv.reload(); log('RELOAD')
        elif act.startswith('shot:'):
            import subprocess; subprocess.run(['import','-window','root',act[5:]]); log('SHOT',act[5:])
        elif act.startswith('xdo:'):
            import subprocess; subprocess.run(['xdotool']+act[4:].split()); log('XDO',act[4:])
        elif act.startswith('key:'):
            wv.evaluate_javascript(act[4:],-1,None,None,None,None); log('JS',act[4:][:60])
        return False
    GLib.timeout_add(int(at*1000),do)
def poll():
    def cb(w,res):
        try: v=w.evaluate_javascript_finish(res).to_json(0)
        except Exception as e: v='ERR %s'%e
        log(v)
    wv.evaluate_javascript(expr,-1,None,None,None,cb); return True
GLib.timeout_add(1000,poll)
wv.connect('load-changed', lambda w,e: log('load',e.value_nick) if e.value_nick in ('started','finished') else None)
GLib.timeout_add(int(total*1000), lambda: (Gtk.main_quit(),False)[1])
wv.load_uri(url); Gtk.main()
