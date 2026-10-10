import sys, gi  # drive_keys.py URL SCRIPT: run SCRIPT in the loaded page, print its result.
gi.require_version('Gtk','3.0'); gi.require_version('WebKit2','4.1')
from gi.repository import Gtk, WebKit2, GLib
wv=WebKit2.WebView(); w=Gtk.Window(); w.add(wv); w.show_all()
def go():
    def cb(v,res): print(v.evaluate_javascript_finish(res).to_string()); Gtk.main_quit()
    wv.evaluate_javascript(open(sys.argv[2]).read(),-1,None,None,None,cb); return False
wv.connect('load-changed', lambda v,e: GLib.timeout_add(500,go) if e.value_nick=='finished' else None)
wv.load_uri(sys.argv[1]); Gtk.main()
