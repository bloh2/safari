/**
 * Divi Inspect Blocker — front end.
 *
 * Loaded in <head>. Watches for the browser's developer tools; when they are
 * open the whole document is replaced by the error page (DIBPage), and — when
 * automatic reload is on — keeps watching until they close, then reloads.
 *
 * A deterrent, not protection: the HTML has already been sent to the browser,
 * and anyone determined can still read it (view-source, the Network panel, a
 * proxy, or simply disabling JavaScript).
 *
 * The test (the same one Divi SuperApp's preview uses): with DevTools
 * attached, console.table() of a large array has to serialise every row for
 * the inspector and takes 60–260ms; detached it costs under 3ms. A sample
 * counts only when the table takes at least 25ms AND 10× the faster of two
 * console.log() calls around it, and it takes two in a row — no window-size
 * or `debugger` checks, which misfire on zoom, side panels and slow machines.
 * It measures the console of the window it runs in, so it works the same on a
 * normal page as inside an iframe: DevTools is attached per tab.
 */
( function () {
	'use strict';

	var cfg = window.dibConfig;

	if ( ! cfg || window.dibStarted ) {
		return;
	}
	window.dibStarted = true;

	var s = cfg.settings || {};

	/* ------------------------------------------------------------------
	 * Right-click and shortcuts — independent of detection
	 * ---------------------------------------------------------------- */

	function isEditable( el ) {
		while ( el && el.nodeType === 1 ) {
			if ( el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test( el.tagName ) ) {
				return true;
			}
			el = el.parentNode;
		}
		return false;
	}

	if ( s.block_contextmenu ) {
		document.addEventListener(
			'contextmenu',
			function ( e ) {
				if ( ! isEditable( e.target ) ) {
					e.preventDefault();
				}
			},
			true
		);
	}

	if ( s.block_shortcuts ) {
		window.addEventListener(
			'keydown',
			function ( e ) {
				// e.code, not e.key: with Option held a Mac reports "ˆ" for I.
				// Safari before 10.1 has no e.code; keyCode is still the letter.
				var key = ( e.code || '' ).replace( /^Key/, '' ).toLowerCase();
				if ( ! key ) {
					key = e.keyCode >= 65 && e.keyCode <= 90 ? String.fromCharCode( e.keyCode ).toLowerCase() : String( e.key || '' ).toLowerCase();
				}
				// Ctrl and Cmd are kept apart: Windows reports AltGr as Ctrl+Alt,
				// so treating Ctrl+Alt like Cmd+Opt would swallow ć, € and the like.
				var ctrl = e.ctrlKey && ! e.metaKey && ! e.altKey;
				var cmd = e.metaKey && ! e.ctrlKey;
				var devtools =
					key === 'f12' || e.keyCode === 123 ||
					// Ctrl+Shift+I/J/C (Windows, Linux), Firefox's Ctrl+Shift+K.
					( ctrl && e.shiftKey && /^[ijck]$/.test( key ) ) ||
					// Cmd+Opt+I/J/C (Mac), Cmd+Shift+C (element picker), Firefox's Cmd+Opt+K.
					( cmd && ( e.shiftKey || e.altKey ) && /^[ijck]$/.test( key ) ) ||
					// Safari: Cmd+Opt+A (Page Resources), Cmd+Opt+Shift+T (Timeline).
					( cmd && e.altKey && ( key === 'a' || ( e.shiftKey && key === 't' ) ) ) ||
					// View source: Ctrl+U, Cmd+U (Firefox), Cmd+Opt+U (Chrome, Safari).
					( ( ctrl || cmd ) && ! e.shiftKey && key === 'u' );

				if ( devtools ) {
					e.preventDefault();
					e.stopPropagation();
				}
			},
			true
		);
	}

	if ( ! cfg.detect || ! window.DIBPage ) {
		return;
	}

	/* ------------------------------------------------------------------
	 * Detection
	 * ---------------------------------------------------------------- */

	var CHECK_MS = 1000;
	var TABLE_FLOOR_MS = 25;
	var RATIO = 10;
	var CONFIRM = 2;

	var probe = null;
	var con = window.console;

	function now() {
		return window.performance && performance.now ? performance.now() : Date.now();
	}

	/** One sample: is console.table() far slower than console.log()? */
	function sample() {
		if ( ! con || ! con.table || ! con.log ) {
			return false;
		}
		if ( ! probe ) {
			// The same array every time, so the console never retains more
			// than one copy of it.
			probe = [];
			for ( var i = 0; i < 50; i++ ) {
				var row = {};
				for ( var k = 0; k < 500; k++ ) {
					row[ k ] = k;
				}
				probe.push( row );
			}
		}

		var t0 = now();
		con.log( probe );
		var log1 = now() - t0;

		t0 = now();
		con.table( probe );
		var table = now() - t0;

		t0 = now();
		con.log( probe );
		var log2 = now() - t0;

		if ( con.clear ) {
			con.clear();
		}

		return table >= TABLE_FLOOR_MS && table >= RATIO * Math.min( log1, log2 );
	}

	/** Immediate verdict: CONFIRM open samples in a row. */
	function openNow() {
		for ( var i = 0; i < CONFIRM; i++ ) {
			if ( ! sample() ) {
				return false;
			}
		}
		return true;
	}

	/* ------------------------------------------------------------------
	 * Blocking
	 * ---------------------------------------------------------------- */

	var page = null;
	var guardTimer = 0;
	var watchTimer = 0;
	var stillTimer = 0;
	var reloading = false;

	function idleState() {
		return s.auto_reload && cfg.mode !== 'preview' ? 'open' : 'manual';
	}

	function reload() {
		if ( reloading ) {
			return;
		}
		reloading = true;
		clearTimeout( watchTimer );
		if ( page ) {
			page.setState( 'closed' );
		}
		// A moment to read "bringing the page back…" rather than a flash.
		setTimeout( function () {
			window.location.reload();
		}, 650 );
	}

	function onReloadClick() {
		if ( cfg.mode === 'preview' ) {
			// Leave the preview for the same page without the flag.
			var url = window.location.href.replace( /([?&])dib_preview=1(&|$)/, function ( m, a, b ) {
				return b ? a : '';
			} );
			window.location.href = url;
			return;
		}

		if ( openNow() ) {
			page.setState( 'still' );
			page.shake();
			clearTimeout( stillTimer );
			stillTimer = setTimeout( function () {
				if ( ! reloading ) {
					page.setState( idleState() );
				}
			}, 4000 );
			return;
		}
		reload();
	}

	/**
	 * Keep anything other scripts add later — chat widgets, pop-ups, lazy
	 * sections — out of the wiped document.
	 */
	function keepClean() {
		if ( ! window.MutationObserver ) {
			return;
		}
		var html = document.documentElement;
		new MutationObserver( function ( list ) {
			list.forEach( function ( m ) {
				var t = m.target;
				if ( t !== html && t !== page.head && t !== page.body ) {
					return;
				}
				Array.prototype.forEach.call( m.addedNodes, function ( n ) {
					if ( n !== page.head && n !== page.body && n !== page.root && n.parentNode ) {
						n.parentNode.removeChild( n );
					}
				} );
			} );
		} ).observe( html, { childList: true, subtree: true } );
	}

	/** After the page is wiped: reload once DevTools have been closed for two checks. */
	function watchForClose() {
		var closed = 0;

		( function tick() {
			watchTimer = setTimeout( function () {
				if ( reloading ) {
					return;
				}
				closed = sample() ? 0 : closed + 1;
				if ( closed >= CONFIRM ) {
					reload();
					return;
				}
				tick();
			}, CHECK_MS );
		} )();
	}

	function block() {
		if ( page ) {
			return;
		}
		clearTimeout( guardTimer );

		// Deliberately no window.stop(): called while the page is still being
		// parsed it aborts the load before Chrome's first paint, and Chrome
		// then never paints at all — a blank screen instead of this page.
		// When DevTools were already open at load, this runs from <head>; the
		// <body> the parser goes on to create is removed by keepClean() the
		// moment it is attached, and the parser keeps filling that detached
		// element, so the content never reaches the DOM and its scripts —
		// which only run when connected — never run.
		page = window.DIBPage.mount( document, s, {
			vars: cfg.vars,
			lang: cfg.lang,
			rtl: cfg.rtl,
			state: idleState(),
			onReload: onReloadClick,
		} );

		keepClean();

		if ( s.auto_reload && cfg.mode !== 'preview' ) {
			watchForClose();
		}
	}

	function startGuard() {
		var hits = 0;

		( function tick() {
			guardTimer = setTimeout( function () {
				hits = sample() ? hits + 1 : 0;
				if ( hits >= CONFIRM ) {
					block();
					return;
				}
				tick();
			}, CHECK_MS );
		} )();
	}

	// Coming back through the back/forward cache with the page still wiped.
	window.addEventListener( 'pageshow', function ( e ) {
		if ( e.persisted && page && ! reloading && cfg.mode !== 'preview' && ! openNow() ) {
			reload();
		}
	} );

	if ( cfg.mode === 'preview' ) {
		block();
	} else if ( openNow() ) {
		// Already open: never let the page render at all.
		block();
	} else {
		startGuard();
	}
} )();
