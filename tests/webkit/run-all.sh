#!/bin/bash
# Tests the plugin in WebKit (the engine behind Safari) with the real Web Inspector.
# Needs: php, xvfb, dbus, python3 with gi + WebKit2 4.1. See README.md.
set -u
here="$(cd "$(dirname "$0")" && pwd)"
plugin="$(cd "$here/../../divi-inspect-blocker" && pwd)"
py="${PYTHON:-/usr/bin/python3}"
port="${PORT:-8765}"
work="$(mktemp -d)"
trap 'kill $server 2>/dev/null; rm -rf "$work"' EXIT

ln -s "$plugin" "$work/plugin"
cp "$here/probe.html" "$work/"
config="$(php "$here/config.php" "$plugin")" || exit 1
cat > "$work/index.html" <<HTML
<!doctype html><html><head><meta charset="utf-8"><title>Secret page</title>
<script>window.dibConfig = $config;</script>
<script src="plugin/assets/js/dib-page.js"></script>
<script src="plugin/assets/js/inspect-blocker.js"></script>
</head><body><h1 id="secret">SECRET CONTENT</h1><input id="field">
<script>sessionStorage.bodyRuns=(+sessionStorage.bodyRuns||0)+1;</script></body></html>
HTML
( cd "$work" && exec "$py" -m http.server "$port" --bind 127.0.0.1 >/dev/null 2>&1 ) &
server=$!
sleep 1
url="http://127.0.0.1:$port"
noise='dbus-daemon|dbind-WARNING|libEGL|NeedDebuggerBreak|^$'
fail=0

drive() { # drive NAME PLAN SECONDS
	timeout $(( $3 + 30 )) xvfb-run -a -s "-screen 0 1280x900x24" dbus-run-session -- \
		"$py" "$here/drive.py" "$url/index.html?run=$1" "$2" "$3" "$(cat "$here/state.js")" 2>&1 | grep -Ev "$noise"
}
expect() { # expect NAME OUTPUT REGEX DESCRIPTION
	if grep -Eq "$3" <<< "$2"; then echo "  ok    $4"; else echo "  FAIL  $4"; fail=1; fi
}
reject() {
	if grep -Eq "$3" <<< "$2"; then echo "  FAIL  $4"; fail=1; else echo "  ok    $4"; fi
}
summary() { "$py" "$here/summ.py" <<< "$1" | sed 's/^/      /'; }

echo "Shortcut matrix"
out="$(timeout 60 xvfb-run -a dbus-run-session -- "$py" "$here/drive_keys.py" "$url/index.html?run=keys" "$here/keys.js" 2>&1 | grep -Ev "$noise")"
sed 's/^ok  /  ok  /; s/^FAIL/  FAIL/' <<< "$out"
grep -q '^FAIL' <<< "$out" && fail=1

echo "Right-click"
out="$(drive ctx '[[2,"xdo:mousemove 300 300"],[2.5,"xdo:click 3"]]' 4)"
reject ctx "$out" 'context-menu shown' 'context menu suppressed'

echo "A. Inspector closed throughout"
out="$(drive a '[]' 12)"; summary "$out"
reject a "$out" '"secret":false' 'content never hidden (no false positive)'

echo "B. Inspector opened after load, then closed"
out="$(drive b '[[4,"open"],[12,"close"]]' 20)"; summary "$out"
expect b "$out" '"state":"open"' 'error page shown'
expect b "$out" '"bodyRuns":2.*"secret":true|"secret":true.*"bodyRuns":2' 'page reloaded with content back'

echo "C. Reload with inspector open, Reload button, then close"
out="$(drive c '[[1,"open"],[6,"reload"],[9,"key:document.querySelector(\".dib-btn\").click()"],[11,"close"]]' 20)"; summary "$out"
expect c "$out" '"state":"still"' 'Reload button says still open'
still="$(grep '"state":"still"' <<< "$out" | head -1)"
expect c "$still" '"bodyRuns":1' 'content never rendered while open at load'
expect c "$out" '"bodyRuns":2' 'page reloaded once closed'

echo "D. Detached inspector window"
out="$(drive d '[[3,"open-detached"],[9,"close"]]' 16)"; summary "$out"
expect d "$out" '"state":"open"' 'error page shown'
expect d "$out" '"bodyRuns":2' 'page reloaded once closed'

[ $fail = 0 ] && echo "All passed." || echo "Some checks failed."
exit $fail
