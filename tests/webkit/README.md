# WebKit tests

Runs the plugin's front-end scripts in WebKitGTK, the same engine and Web
Inspector frontend Safari uses, and opens and closes the real inspector while
watching the page. Not a substitute for a final check in Safari on a Mac.

```sh
sudo apt-get install xvfb xauth dbus-x11 xdotool php-cli python3-gi \
  gir1.2-webkit2-4.1 gir1.2-gtk-3.0
tests/webkit/run-all.sh        # PYTHON=/usr/bin/python3.12 if python3 lacks gi
```

| Check | |
|---|---|
| Shortcut matrix | Keydown events shaped like Safari, Chrome and Firefox send them: which are blocked, which are let through (copy, select all, AltGr typing) |
| Right-click | A real right-click no longer opens WebKit's context menu |
| A | Inspector closed throughout: the page is never hidden |
| B | Inspector opened after load: the error page appears; closing it reloads the page |
| C | Reloading with the inspector open: the content never renders; the Reload button reports "still open" |
| D | Inspector in a separate window: detected the same way |

`probe.html` prints the raw `console.log` / `console.table` timings the detector uses:
`python3 drive.py http://127.0.0.1:8765/probe.html '[[5,"open"],[15,"close"]]' 20 'samples.slice(-1)'`
under `xvfb-run` while serving this folder.
