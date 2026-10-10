/**
 * Divi Inspect Blocker — the error page.
 *
 * Draws the whole page from a settings object into a document. Shared by the
 * front end (which draws it over the wiped site) and the Theme Options live
 * preview (which draws it into iframes), so what the admin sees is exactly what
 * a visitor gets.
 *
 * Backgrounds are generated here rather than shipped as images: they cost no
 * download, take the configured colours, and stay sharp at any size. Every
 * value that reaches innerHTML is a number or a colour this file rebuilt from
 * parsed channels; visitor-facing text only ever goes in through textContent,
 * and the footer through a tag whitelist.
 */
( function ( root ) {
	'use strict';

	var VB_W = 1600;
	var VB_H = 1000;

	/* ------------------------------------------------------------------
	 * Colour
	 * ---------------------------------------------------------------- */

	function parseColor( str ) {
		if ( typeof str !== 'string' ) {
			return null;
		}
		var s = str.trim().toLowerCase();
		var m = /^#?([0-9a-f]{3,8})$/.exec( s );

		if ( m && [ 3, 4, 6, 8 ].indexOf( m[ 1 ].length ) !== -1 ) {
			var h = m[ 1 ];
			if ( h.length < 6 ) {
				h = h.split( '' ).map( function ( c ) {
					return c + c;
				} ).join( '' );
			}
			return {
				r: parseInt( h.slice( 0, 2 ), 16 ),
				g: parseInt( h.slice( 2, 4 ), 16 ),
				b: parseInt( h.slice( 4, 6 ), 16 ),
				a: h.length === 8 ? parseInt( h.slice( 6, 8 ), 16 ) / 255 : 1,
			};
		}

		m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/.exec( s );
		if ( m ) {
			return {
				r: Math.min( 255, +m[ 1 ] ),
				g: Math.min( 255, +m[ 2 ] ),
				b: Math.min( 255, +m[ 3 ] ),
				a: m[ 4 ] === undefined ? 1 : Math.max( 0, Math.min( 1, +m[ 4 ] ) ),
			};
		}
		return null;
	}

	function css( c, alpha ) {
		var a = alpha === undefined ? c.a : alpha * c.a;
		return 'rgba(' + Math.round( c.r ) + ',' + Math.round( c.g ) + ',' + Math.round( c.b ) + ',' + +a.toFixed( 3 ) + ')';
	}

	function mix( c1, c2, t ) {
		return {
			r: c1.r + ( c2.r - c1.r ) * t,
			g: c1.g + ( c2.g - c1.g ) * t,
			b: c1.b + ( c2.b - c1.b ) * t,
			a: c1.a + ( c2.a - c1.a ) * t,
		};
	}

	function luminance( c ) {
		var ch = [ c.r, c.g, c.b ].map( function ( v ) {
			v /= 255;
			return v <= 0.03928 ? v / 12.92 : Math.pow( ( v + 0.055 ) / 1.055, 2.4 );
		} );
		return 0.2126 * ch[ 0 ] + 0.7152 * ch[ 1 ] + 0.0722 * ch[ 2 ];
	}

	/** Whether white text reads better than near-black on this colour. */
	function prefersLightText( c ) {
		var l = luminance( c );
		return ( 1.05 / ( l + 0.05 ) ) >= ( ( l + 0.05 ) / 0.05 ) * 0.62;
	}

	var WHITE = { r: 255, g: 255, b: 255, a: 1 };
	var INK = { r: 11, g: 15, b: 25, a: 1 };

	/* ------------------------------------------------------------------
	 * Small helpers
	 * ---------------------------------------------------------------- */

	/** Seeded PRNG (mulberry32): the same design looks the same every time. */
	function rng( seed ) {
		var t = seed >>> 0;
		return function () {
			t += 0x6d2b79f5;
			var x = Math.imul( t ^ ( t >>> 15 ), 1 | t );
			x ^= x + Math.imul( x ^ ( x >>> 7 ), 61 | x );
			return ( ( x ^ ( x >>> 14 ) ) >>> 0 ) / 4294967296;
		};
	}

	function r1( n ) {
		return Math.round( n * 10 ) / 10;
	}

	function svgOpen( extra ) {
		return '<svg class="dib-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + VB_W + ' ' + VB_H + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"' + ( extra || '' ) + '>';
	}

	/** Closed Catmull-Rom spline through points, as cubic Béziers. */
	function smoothClosed( pts ) {
		var n = pts.length;
		var d = 'M' + r1( pts[ 0 ][ 0 ] ) + ' ' + r1( pts[ 0 ][ 1 ] );
		for ( var i = 0; i < n; i++ ) {
			var p0 = pts[ ( i - 1 + n ) % n ];
			var p1 = pts[ i ];
			var p2 = pts[ ( i + 1 ) % n ];
			var p3 = pts[ ( i + 2 ) % n ];
			d += 'C' + r1( p1[ 0 ] + ( p2[ 0 ] - p0[ 0 ] ) / 6 ) + ' ' + r1( p1[ 1 ] + ( p2[ 1 ] - p0[ 1 ] ) / 6 ) +
				' ' + r1( p2[ 0 ] - ( p3[ 0 ] - p1[ 0 ] ) / 6 ) + ' ' + r1( p2[ 1 ] - ( p3[ 1 ] - p1[ 1 ] ) / 6 ) +
				' ' + r1( p2[ 0 ] ) + ' ' + r1( p2[ 1 ] );
		}
		return d + 'Z';
	}

	function blobPoints( cx, cy, r, count, wobble, rand ) {
		var pts = [];
		for ( var i = 0; i < count; i++ ) {
			var a = ( i / count ) * Math.PI * 2;
			var rr = r * ( 1 - wobble / 2 + rand() * wobble );
			pts.push( [ cx + Math.cos( a ) * rr, cy + Math.sin( a ) * rr ] );
		}
		return pts;
	}

	/** 2D value noise with smooth interpolation, several octaves. */
	function makeNoise( rand ) {
		var size = 256;
		var perm = [];
		var vals = [];
		var i;
		for ( i = 0; i < size; i++ ) {
			perm[ i ] = i;
			vals[ i ] = rand();
		}
		for ( i = size - 1; i > 0; i-- ) {
			var j = Math.floor( rand() * ( i + 1 ) );
			var t = perm[ i ];
			perm[ i ] = perm[ j ];
			perm[ j ] = t;
		}
		function lattice( x, y ) {
			return vals[ perm[ ( perm[ x & 255 ] + y ) & 255 ] ];
		}
		function smooth( t ) {
			return t * t * ( 3 - 2 * t );
		}
		function noise( x, y ) {
			var xi = Math.floor( x );
			var yi = Math.floor( y );
			var sx = smooth( x - xi );
			var sy = smooth( y - yi );
			var a = lattice( xi, yi );
			var b = lattice( xi + 1, yi );
			var c = lattice( xi, yi + 1 );
			var d = lattice( xi + 1, yi + 1 );
			return ( a + ( b - a ) * sx ) + ( ( c + ( d - c ) * sx ) - ( a + ( b - a ) * sx ) ) * sy;
		}
		return function ( x, y ) {
			return noise( x, y ) * 0.6 + noise( x * 2.1 + 17, y * 2.1 + 9 ) * 0.28 + noise( x * 4.3 + 41, y * 4.3 + 3 ) * 0.12;
		};
	}

	/* ------------------------------------------------------------------
	 * Designed backgrounds
	 *
	 * Each returns markup for the background layer. c = { bg, a1, a2, light }
	 * where light is true when the background is light.
	 * ---------------------------------------------------------------- */

	var patterns = {};

	patterns.aurora = function ( c ) {
		var mid = mix( c.a1, c.a2, 0.5 );
		var k = c.light ? 0.7 : 1;
		var blobs = [
			[ 16, 18, 78, c.a1, 0.62, 23, 0 ],
			[ 86, 24, 66, c.a2, 0.5, 29, -7 ],
			[ 58, 92, 84, mid, 0.46, 31, -13 ],
			[ 34, 64, 46, c.a2, 0.3, 19, -5 ],
		];
		return '<div class="dib-p-aurora">' + blobs.map( function ( b ) {
			return '<i style="left:' + b[ 0 ] + '%;top:' + b[ 1 ] + '%;width:' + b[ 2 ] + 'vmax;height:' + b[ 2 ] + 'vmax;' +
				'background:radial-gradient(closest-side,' + css( b[ 3 ], b[ 4 ] * k ) + ',' + css( b[ 3 ], 0 ) + ');' +
				'animation-duration:' + b[ 5 ] + 's;animation-delay:' + b[ 6 ] + 's"></i>';
		} ).join( '' ) + '</div>';
	};

	patterns.radar = function ( c, rand ) {
		var cx = VB_W / 2;
		var cy = VB_H / 2;
		var line = c.light ? 0.75 : 1;
		var out = svgOpen() +
			'<defs><radialGradient id="dib-rg" cx="50%" cy="50%" r="50%">' +
			'<stop offset="0" stop-color="' + css( c.a1, 0.28 * line ) + '"/><stop offset="1" stop-color="' + css( c.a1, 0 ) + '"/>' +
			'</radialGradient></defs>' +
			'<circle cx="' + cx + '" cy="' + cy + '" r="620" fill="url(#dib-rg)"/>';

		for ( var i = 1; i <= 10; i++ ) {
			var op = ( 0.42 - i * 0.033 ) * line;
			out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + i * 92 + '" fill="none" stroke="' + css( c.a1, op ) + '" stroke-width="' + ( i % 3 === 0 ? 1.6 : 1 ) + '"' + ( i % 2 ? '' : ' stroke-dasharray="2 9"' ) + '/>';
		}

		var axis = css( c.a1, 0.16 * line );
		out += '<path d="M0 ' + cy + 'H' + VB_W + 'M' + cx + ' 0V' + VB_H + '" stroke="' + axis + '" stroke-width="1"/>';
		out += '<path d="M' + ( cx - 700 ) + ' ' + ( cy - 700 ) + 'L' + ( cx + 700 ) + ' ' + ( cy + 700 ) + 'M' + ( cx + 700 ) + ' ' + ( cy - 700 ) + 'L' + ( cx - 700 ) + ' ' + ( cy + 700 ) + '" stroke="' + css( c.a1, 0.07 * line ) + '" stroke-width="1"/>';

		for ( var b = 0; b < 7; b++ ) {
			var ang = rand() * Math.PI * 2;
			var dist = 200 + rand() * 520;
			var x = r1( cx + Math.cos( ang ) * dist );
			var y = r1( cy + Math.sin( ang ) * dist * 0.85 );
			var delay = -( rand() * 4 ).toFixed( 2 );
			out += '<circle class="dib-blip-ring" cx="' + x + '" cy="' + y + '" r="16" fill="none" stroke="' + css( c.a2, 0.7 ) + '" stroke-width="1.5" style="animation-delay:' + delay + 's"/>' +
				'<circle class="dib-blip" cx="' + x + '" cy="' + y + '" r="4" fill="' + css( c.a2, 0.95 ) + '" style="animation-delay:' + delay + 's"/>';
		}
		out += '</svg>';

		out += '<div class="dib-p-sweep" style="background:conic-gradient(from 0deg,' + css( c.a1, 0 ) + ' 0deg,' + css( c.a1, 0 ) + ' 230deg,' + css( c.a1, 0.2 * line ) + ' 357deg,' + css( c.a2, 0.42 * line ) + ' 360deg)"></div>';
		return out;
	};

	patterns.waves = function ( c ) {
		var layers = [
			{ y: 520, amp: 70, period: 1600, op: 0.14, dur: 46 },
			{ y: 610, amp: 54, period: 800, op: 0.2, dur: 26 },
			{ y: 700, amp: 78, period: 1600, op: 0.28, dur: 34 },
			{ y: 790, amp: 46, period: 800, op: 0.4, dur: 20 },
			{ y: 880, amp: 36, period: 800, op: 0.62, dur: 15 },
		];
		var k = c.light ? 0.8 : 1;
		var out = svgOpen() +
			'<defs>' +
			'<linearGradient id="dib-wg" x1="0" y1="0" x2="1" y2="0">' +
			'<stop offset="0" stop-color="' + css( c.a1 ) + '"/><stop offset=".5" stop-color="' + css( c.a2 ) + '"/><stop offset="1" stop-color="' + css( c.a1 ) + '"/>' +
			'</linearGradient>' +
			'<radialGradient id="dib-wglow" cx="78%" cy="8%" r="60%"><stop offset="0" stop-color="' + css( c.a2, 0.3 * k ) + '"/><stop offset="1" stop-color="' + css( c.a2, 0 ) + '"/></radialGradient>' +
			'</defs>' +
			'<rect width="' + VB_W + '" height="' + VB_H + '" fill="url(#dib-wglow)"/>';

		layers.forEach( function ( l, idx ) {
			// One period wider than the view, so shifting by exactly one period
			// loops seamlessly (reversed layers start one period to the left).
			var q = l.period / 4;
			var x0 = idx % 2 ? -l.period : 0;
			var d = 'M' + x0 + ' ' + l.y + 'Q' + ( x0 + q ) + ' ' + ( l.y - l.amp ) + ' ' + ( x0 + q * 2 ) + ' ' + l.y;
			for ( var x = x0 + q * 2; x < VB_W + l.period; x += q * 2 ) {
				d += 'T' + ( x + q * 2 ) + ' ' + l.y;
			}
			d += 'V' + VB_H + 'H' + x0 + 'Z';
			var crest = d.slice( 0, d.indexOf( 'V' ) );
			var anim = 'animation-name:dib-wave' + l.period + ';animation-duration:' + l.dur + 's;animation-direction:' + ( idx % 2 ? 'reverse' : 'normal' );
			out += '<g class="dib-wave" style="' + anim + '">' +
				'<path d="' + d + '" fill="url(#dib-wg)" fill-opacity="' + ( l.op * k ) + '"/>' +
				'<path d="' + crest + '" fill="none" stroke="' + css( mix( c.a2, WHITE, 0.3 ), ( 0.1 + l.op * 0.35 ) * k ) + '" stroke-width="1.5"/>' +
				'</g>';
		} );

		return out + '</svg>';
	};

	patterns.grid = function ( c ) {
		var k = c.light ? 0.85 : 1;
		var line = css( c.a1, 0.2 * k );
		var dot = css( c.a2, 0.7 * k );
		return '<div class="dib-p-grid" style="background-image:' +
			'radial-gradient(' + dot + ' 1.4px,transparent 1.9px),' +
			'linear-gradient(' + line + ' 1px,transparent 1px),' +
			'linear-gradient(90deg,' + line + ' 1px,transparent 1px)"></div>' +
			'<div class="dib-p-glow" style="background:radial-gradient(closest-side,' + css( c.a1, 0.42 * k ) + ',' + css( c.a1, 0 ) + ')"></div>' +
			'<div class="dib-p-glow dib-p-glow--2" style="background:radial-gradient(closest-side,' + css( c.a2, 0.3 * k ) + ',' + css( c.a2, 0 ) + ')"></div>' +
			'<div class="dib-p-scan" style="background:linear-gradient(180deg,' + css( c.a2, 0 ) + ',' + css( c.a2, 0.08 * k ) + ',' + css( c.a2, 0 ) + ')"></div>';
	};

	patterns.topography = function ( c, rand ) {
		var noise = makeNoise( rand );
		var cols = 100;
		var rows = 64;
		var cw = VB_W / cols;
		var ch = VB_H / rows;
		var field = [];
		var x;
		var y;

		for ( y = 0; y <= rows; y++ ) {
			field[ y ] = [];
			for ( x = 0; x <= cols; x++ ) {
				field[ y ][ x ] = noise( x / 22, y / 22 );
			}
		}

		var levels = 18;
		var minor = '';
		var major = '';

		// Marching squares: for each level, the segment(s) where the contour
		// crosses each cell, interpolated along the cell's edges.
		for ( var li = 1; li < levels; li++ ) {
			var lv = 0.12 + ( li / levels ) * 0.76;
			var d = '';
			for ( y = 0; y < rows; y++ ) {
				for ( x = 0; x < cols; x++ ) {
					var v0 = field[ y ][ x ];
					var v1 = field[ y ][ x + 1 ];
					var v2 = field[ y + 1 ][ x + 1 ];
					var v3 = field[ y + 1 ][ x ];
					var idx = ( v0 > lv ? 8 : 0 ) | ( v1 > lv ? 4 : 0 ) | ( v2 > lv ? 2 : 0 ) | ( v3 > lv ? 1 : 0 );
					if ( idx === 0 || idx === 15 ) {
						continue;
					}
					var px = x * cw;
					var py = y * ch;
					var top = [ px + cw * ( lv - v0 ) / ( v1 - v0 ), py ];
					var right = [ px + cw, py + ch * ( lv - v1 ) / ( v2 - v1 ) ];
					var bottom = [ px + cw * ( lv - v3 ) / ( v2 - v3 ), py + ch ];
					var left = [ px, py + ch * ( lv - v0 ) / ( v3 - v0 ) ];
					var segs;
					switch ( idx ) {
						case 1: case 14: segs = [ [ left, bottom ] ]; break;
						case 2: case 13: segs = [ [ bottom, right ] ]; break;
						case 3: case 12: segs = [ [ left, right ] ]; break;
						case 4: case 11: segs = [ [ top, right ] ]; break;
						case 5: segs = [ [ left, top ], [ bottom, right ] ]; break;
						case 6: case 9: segs = [ [ top, bottom ] ]; break;
						case 7: case 8: segs = [ [ left, top ] ]; break;
						case 10: segs = [ [ top, right ], [ left, bottom ] ]; break;
					}
					for ( var s = 0; s < segs.length; s++ ) {
						d += 'M' + r1( segs[ s ][ 0 ][ 0 ] ) + ' ' + r1( segs[ s ][ 0 ][ 1 ] ) + 'L' + r1( segs[ s ][ 1 ][ 0 ] ) + ' ' + r1( segs[ s ][ 1 ][ 1 ] );
					}
				}
			}
			if ( li % 4 === 0 ) {
				major += d;
			} else {
				minor += d;
			}
		}

		var k = c.light ? 0.85 : 1;
		return svgOpen() +
			'<defs><radialGradient id="dib-tg" cx="50%" cy="45%" r="65%"><stop offset="0" stop-color="' + css( c.a1, 0.22 * k ) + '"/><stop offset="1" stop-color="' + css( c.a1, 0 ) + '"/></radialGradient></defs>' +
			'<rect width="' + VB_W + '" height="' + VB_H + '" fill="url(#dib-tg)"/>' +
			'<g fill="none" stroke-linecap="round" stroke-linejoin="round">' +
			'<path d="' + minor + '" stroke="' + css( c.a1, 0.3 * k ) + '" stroke-width="1"/>' +
			'<path d="' + major + '" stroke="' + css( c.a2, 0.5 * k ) + '" stroke-width="1.6"/>' +
			'</g></svg>';
	};

	patterns.constellation = function ( c, rand ) {
		var pts = [];
		var i;
		var j;
		for ( i = 0; i < 86; i++ ) {
			pts.push( [ rand() * VB_W, rand() * VB_H, 0.9 + rand() * 2.2 ] );
		}
		var k = c.light ? 0.85 : 1;
		var lines = '';
		var maxD = 175;
		for ( i = 0; i < pts.length; i++ ) {
			for ( j = i + 1; j < pts.length; j++ ) {
				var dx = pts[ i ][ 0 ] - pts[ j ][ 0 ];
				var dy = pts[ i ][ 1 ] - pts[ j ][ 1 ];
				var dist = Math.sqrt( dx * dx + dy * dy );
				if ( dist < maxD ) {
					lines += '<line x1="' + r1( pts[ i ][ 0 ] ) + '" y1="' + r1( pts[ i ][ 1 ] ) + '" x2="' + r1( pts[ j ][ 0 ] ) + '" y2="' + r1( pts[ j ][ 1 ] ) + '" stroke-opacity="' + ( ( 1 - dist / maxD ) * 0.5 * k ).toFixed( 3 ) + '"/>';
				}
			}
		}
		var nodes = pts.map( function ( p, n ) {
			var tw = n % 6 === 0;
			return '<circle' + ( tw ? ' class="dib-twinkle" style="animation-delay:-' + ( ( n % 7 ) * 0.7 ).toFixed( 1 ) + 's"' : '' ) +
				' cx="' + r1( p[ 0 ] ) + '" cy="' + r1( p[ 1 ] ) + '" r="' + r1( tw ? p[ 2 ] + 1 : p[ 2 ] ) + '"/>';
		} ).join( '' );

		return svgOpen() +
			'<defs><radialGradient id="dib-cg" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="' + css( c.a1, 0.24 * k ) + '"/><stop offset="1" stop-color="' + css( c.a1, 0 ) + '"/></radialGradient></defs>' +
			'<rect width="' + VB_W + '" height="' + VB_H + '" fill="url(#dib-cg)"/>' +
			'<g stroke="' + css( c.a1 ) + '" stroke-width="1">' + lines + '</g>' +
			'<g fill="' + css( c.a2, 0.9 ) + '">' + nodes + '</g></svg>';
	};

	patterns.lowpoly = function ( c, rand ) {
		var cols = 12;
		var rows = 8;
		var pad = 120;
		var cw = ( VB_W + pad * 2 ) / cols;
		var ch = ( VB_H + pad * 2 ) / rows;
		var grid = [];
		var x;
		var y;
		for ( y = 0; y <= rows; y++ ) {
			grid[ y ] = [];
			for ( x = 0; x <= cols; x++ ) {
				var jx = x > 0 && x < cols ? ( rand() - 0.5 ) * cw * 0.7 : 0;
				var jy = y > 0 && y < rows ? ( rand() - 0.5 ) * ch * 0.7 : 0;
				grid[ y ][ x ] = [ x * cw - pad + jx, y * ch - pad + jy ];
			}
		}

		var strength = c.light ? 0.3 : 0.34;
		var out = svgOpen( ' shape-rendering="geometricPrecision"' );

		function tri( a, b, d ) {
			var cx = ( a[ 0 ] + b[ 0 ] + d[ 0 ] ) / 3;
			var cy = ( a[ 1 ] + b[ 1 ] + d[ 1 ] ) / 3;
			var t = Math.max( 0, Math.min( 1, ( cx / VB_W ) * 0.75 + ( cy / VB_H ) * 0.25 ) );
			var tint = mix( c.a1, c.a2, t );
			// Brighter towards the middle, where the card sits.
			var dx = ( cx - VB_W / 2 ) / VB_W;
			var dy = ( cy - VB_H / 2 ) / VB_H;
			var centre = 1 - Math.min( 1, Math.sqrt( dx * dx + dy * dy ) * 1.6 );
			var fill = css( mix( c.bg, tint, strength * ( 0.35 + rand() * 0.55 + centre * 0.45 ) ), 1 );
			out += '<path d="M' + r1( a[ 0 ] ) + ' ' + r1( a[ 1 ] ) + 'L' + r1( b[ 0 ] ) + ' ' + r1( b[ 1 ] ) + 'L' + r1( d[ 0 ] ) + ' ' + r1( d[ 1 ] ) + 'Z" fill="' + fill + '" stroke="' + fill + '" stroke-width=".8"/>';
		}

		for ( y = 0; y < rows; y++ ) {
			for ( x = 0; x < cols; x++ ) {
				var p00 = grid[ y ][ x ];
				var p10 = grid[ y ][ x + 1 ];
				var p01 = grid[ y + 1 ][ x ];
				var p11 = grid[ y + 1 ][ x + 1 ];
				if ( ( x + y ) % 2 ) {
					tri( p00, p10, p11 );
					tri( p00, p11, p01 );
				} else {
					tri( p00, p10, p01 );
					tri( p10, p11, p01 );
				}
			}
		}
		return out + '</svg>';
	};

	patterns.blobs = function ( c, rand ) {
		var shapes = [
			{ x: 250, y: 170, r: 400, o: 0.9, g: 0, dur: 70 },
			{ x: 1390, y: 870, r: 440, o: 0.8, g: 1, dur: 85 },
			{ x: 1300, y: 170, r: 150, o: 0.75, g: 2, dur: 55 },
			{ x: 380, y: 900, r: 120, o: 0.6, g: 1, dur: 60 },
		];
		var k = c.light ? 0.75 : 1;
		var out = svgOpen() + '<defs>' +
			'<linearGradient id="dib-bg0" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + css( c.a1 ) + '"/><stop offset="1" stop-color="' + css( c.a2 ) + '"/></linearGradient>' +
			'<linearGradient id="dib-bg1" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + css( c.a2 ) + '"/><stop offset="1" stop-color="' + css( c.a1 ) + '"/></linearGradient>' +
			'<linearGradient id="dib-bg2" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="' + css( mix( c.a1, c.a2, 0.5 ) ) + '"/><stop offset="1" stop-color="' + css( c.a2 ) + '"/></linearGradient>' +
			'<radialGradient id="dib-bglow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="' + css( mix( c.a1, c.a2, 0.5 ), 0.3 * k ) + '"/><stop offset="1" stop-color="' + css( c.a1, 0 ) + '"/></radialGradient>' +
			'</defs>' +
			'<ellipse cx="800" cy="500" rx="700" ry="460" fill="url(#dib-bglow)"/>';

		shapes.forEach( function ( s, i ) {
			out += '<path class="dib-blob" d="' + smoothClosed( blobPoints( s.x, s.y, s.r, 7, 0.5, rand ) ) + '" fill="url(#dib-bg' + s.g + ')" fill-opacity="' + ( s.o * k ) + '" style="animation-duration:' + s.dur + 's;animation-direction:' + ( i % 2 ? 'reverse' : 'normal' ) + '"/>';
		} );
		return out + '</svg>';
	};

	/* ------------------------------------------------------------------
	 * Icons (24×24, stroked)
	 * ---------------------------------------------------------------- */

	var ICONS = {
		shield: '<path d="M12 2.8l7.2 2.9v5.6c0 4.6-3 8.6-7.2 10-4.2-1.4-7.2-5.4-7.2-10V5.7L12 2.8z"/><path d="M12 8.2v4.6"/><path d="M12 16.1v.1"/>',
		eye: '<path d="M10.6 5.1A10 10 0 0 1 12 5c6.2 0 9.6 7 9.6 7a16.8 16.8 0 0 1-2.4 3.2"/><path d="M6.6 6.6A16.6 16.6 0 0 0 2.4 12s3.4 7 9.6 7a9.4 9.4 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3 3l18 18"/>',
		lock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.6"/><path d="M8 10.5V7.4a4 4 0 0 1 8 0v3.1"/><path d="M12 14.6v2.3"/>',
		code: '<path d="M8.2 7.2L3.4 12l4.8 4.8"/><path d="M15.8 7.2l4.8 4.8-4.8 4.8"/><path d="M13.6 4.6l-3.2 14.8"/>',
	};

	var RELOAD_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20.5 11.5a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 3.5v5h-5"/></svg>';

	/* ------------------------------------------------------------------
	 * Stylesheet (scoped to .dib; colours arrive as custom properties)
	 * ---------------------------------------------------------------- */

	var GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

	var STYLES = [
		'html,body{margin:0;padding:0;height:100%;background:var(--dib-bg-solid,#0b1020)}',
		'.dib,.dib *,.dib *::before,.dib *::after{box-sizing:border-box}',
		'.dib{position:fixed;inset:0;z-index:2147483646;display:flex;flex-direction:column;overflow-x:hidden;overflow-y:auto;color:var(--dib-text);font-family:var(--dib-font);font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;background:var(--dib-bg-solid)}',
		'.dib[data-font="modern"]{--dib-font:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}',
		'.dib[data-font="rounded"]{--dib-font:ui-rounded,"SF Pro Rounded","Nunito","Varela Round","Segoe UI",system-ui,sans-serif}',
		'.dib[data-font="serif"]{--dib-font:ui-serif,"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif}',
		'.dib[data-font="mono"]{--dib-font:ui-monospace,"SF Mono","Cascadia Code","JetBrains Mono",Menlo,Consolas,monospace}',

		/* Background layer */
		'.dib-bg{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;background:var(--dib-bg-fill)}',
		'.dib-svg{position:absolute;inset:0;width:100%;height:100%;display:block}',
		'.dib-grain{position:absolute;inset:-50%;background-image:' + GRAIN + ';background-size:180px;opacity:var(--dib-grain-op);mix-blend-mode:overlay}',
		'.dib-vignette{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,transparent 40%,var(--dib-vignette) 100%)}',
		'.dib-photo{position:absolute;inset:0;background-position:center;background-size:cover;background-repeat:no-repeat}',
		'.dib-photo-tint{position:absolute;inset:0}',

		'.dib-p-aurora{position:absolute;inset:0}',
		'.dib-p-aurora i{position:absolute;display:block;border-radius:50%;transform:translate(-50%,-50%);animation:dib-drift 24s ease-in-out infinite alternate;will-change:transform}',
		'.dib-p-aurora i:nth-child(2n){animation-name:dib-drift2}',
		'@keyframes dib-drift{0%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-42%,-56%) scale(1.12)}100%{transform:translate(-56%,-46%) scale(.94)}}',
		'@keyframes dib-drift2{0%{transform:translate(-50%,-50%) scale(1.05)}50%{transform:translate(-58%,-44%) scale(.92)}100%{transform:translate(-44%,-54%) scale(1.14)}}',

		'.dib-p-sweep{position:absolute;left:50%;top:50%;width:150vmax;height:150vmax;margin:-75vmax 0 0 -75vmax;border-radius:50%;animation:dib-spin 7s linear infinite;-webkit-mask:radial-gradient(closest-side,#000 0,#000 55%,transparent 100%);mask:radial-gradient(closest-side,#000 0,#000 55%,transparent 100%)}',
		'.dib-blip,.dib-blip-ring{transform-box:fill-box;transform-origin:center}',
		'.dib-blip{animation:dib-blip 4s ease-out infinite}',
		'.dib-blip-ring{animation:dib-ping 4s ease-out infinite}',
		'@keyframes dib-blip{0%,100%{opacity:.25}8%{opacity:1}60%{opacity:.35}}',
		'@keyframes dib-ping{0%{transform:scale(.2);opacity:0}8%{opacity:.9}60%,100%{transform:scale(2.4);opacity:0}}',

		'.dib-wave{animation:dib-wave1600 30s linear infinite}',
		'@keyframes dib-wave1600{from{transform:translateX(0)}to{transform:translateX(-1600px)}}',
		'@keyframes dib-wave800{from{transform:translateX(0)}to{transform:translateX(-800px)}}',

		'.dib-p-grid{position:absolute;inset:-56px;background-size:56px 56px;background-position:0 0,0 0,0 0;-webkit-mask:radial-gradient(ellipse 70% 65% at 50% 45%,#000 0%,rgba(0,0,0,.55) 45%,transparent 80%);mask:radial-gradient(ellipse 70% 65% at 50% 45%,#000 0%,rgba(0,0,0,.55) 45%,transparent 80%);animation:dib-pan 14s linear infinite}',
		'@keyframes dib-pan{from{transform:translate(0,0)}to{transform:translate(56px,56px)}}',
		'.dib-p-glow{position:absolute;left:50%;top:44%;width:80vmax;height:60vmax;transform:translate(-50%,-50%);animation:dib-breathe 9s ease-in-out infinite}',
		'.dib-p-glow--2{left:70%;top:70%;width:60vmax;height:45vmax;animation-delay:-4s}',
		'@keyframes dib-breathe{0%,100%{opacity:.75}50%{opacity:1}}',
		'.dib-p-scan{position:absolute;left:0;right:0;height:22vh;top:-22vh;animation:dib-scan 9s linear infinite}',
		'@keyframes dib-scan{from{transform:translateY(0)}to{transform:translateY(144vh)}}',

		'.dib-twinkle{animation:dib-twinkle 4.2s ease-in-out infinite}',
		'@keyframes dib-twinkle{0%,100%{opacity:.35}50%{opacity:1}}',

		'.dib-blob{transform-box:fill-box;transform-origin:center;animation:dib-spin 70s linear infinite}',
		'@keyframes dib-spin{to{transform:rotate(360deg)}}',

		/* Layout */
		'.dib-main{position:relative;z-index:1;flex:1 0 auto;display:flex;align-items:center;justify-content:center;padding:clamp(28px,6vh,72px) 16px}',
		'.dib-card{position:relative;width:100%;max-width:580px;text-align:center;padding:clamp(30px,5vw,52px) clamp(22px,5vw,52px);border-radius:28px;animation:dib-in .7s cubic-bezier(.2,.8,.2,1) both}',
		'@keyframes dib-in{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}',
		'.dib--no-intro .dib-card{animation:none}',
		'.dib[data-card="glass"] .dib-card{background:var(--dib-card-glass);border:1px solid var(--dib-card-border);box-shadow:0 1px 0 var(--dib-card-hi) inset,0 30px 80px -24px var(--dib-shadow);-webkit-backdrop-filter:blur(22px) saturate(150%);backdrop-filter:blur(22px) saturate(150%)}',
		'.dib[data-card="glass"] .dib-card::before{content:"";position:absolute;inset:-1px;border-radius:inherit;padding:1px;background:linear-gradient(140deg,var(--dib-a1-60),transparent 38%,transparent 62%,var(--dib-a2-60));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);pointer-events:none}',
		'.dib[data-card="solid"] .dib-card{background:var(--dib-card-solid);border:1px solid var(--dib-card-border);box-shadow:0 30px 80px -24px var(--dib-shadow)}',
		'.dib[data-card="minimal"] .dib-card{padding-top:8px;padding-bottom:8px}',
		'.dib[data-card="minimal"] .dib-title,.dib[data-card="minimal"] .dib-msg{text-shadow:0 1px 18px var(--dib-shadow)}',

		'.dib-logo{display:block;margin:0 auto 26px;height:auto;max-height:96px;max-width:min(100%,var(--dib-logo-w));object-fit:contain}',

		'.dib-icon{position:relative;width:76px;height:76px;margin:0 auto 26px;display:grid;place-items:center;border-radius:24px;background:linear-gradient(140deg,var(--dib-a1-22),var(--dib-a2-18));border:1px solid var(--dib-a1-40);box-shadow:0 12px 34px -12px var(--dib-a1-60)}',
		'.dib-icon svg{width:36px;height:36px;position:relative;z-index:1}',
		'.dib-icon::before,.dib-icon::after{content:"";position:absolute;inset:0;border-radius:inherit;border:1.5px solid var(--dib-a1-60);opacity:0;animation:dib-ring 3.2s cubic-bezier(.2,.6,.3,1) infinite}',
		'.dib-icon::after{animation-delay:1.6s}',
		'@keyframes dib-ring{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.75);opacity:0}}',

		'.dib-badge{display:inline-flex;align-items:center;gap:8px;margin:0 0 18px;padding:6px 13px 6px 11px;border-radius:999px;font-size:12px;font-weight:650;letter-spacing:.08em;text-transform:uppercase;line-height:1.3;color:var(--dib-badge-text);background:var(--dib-a1-14);border:1px solid var(--dib-a1-30)}',
		'.dib-badge-dot{width:7px;height:7px;border-radius:50%;background:#f43f5e;box-shadow:0 0 0 0 rgba(244,63,94,.6);animation:dib-dot 1.8s ease-out infinite;flex:none}',
		'@keyframes dib-dot{0%{box-shadow:0 0 0 0 rgba(244,63,94,.55)}80%,100%{box-shadow:0 0 0 7px rgba(244,63,94,0)}}',

		'.dib-title{margin:0 0 14px;font-size:clamp(26px,4.2vw,38px);line-height:1.15;font-weight:750;letter-spacing:-.022em;color:var(--dib-text);text-wrap:balance}',
		'.dib[data-font="serif"] .dib-title{font-weight:600;letter-spacing:-.01em}',
		'.dib[data-font="mono"] .dib-title{letter-spacing:-.04em;font-size:clamp(23px,3.6vw,32px)}',
		'.dib-msg{margin:0 auto 30px;max-width:46ch;color:var(--dib-muted);font-size:clamp(15px,1.6vw,17px);line-height:1.65;text-wrap:pretty}',
		'.dib-msg p{margin:0}',
		'.dib-msg p+p{margin-top:.7em}',

		'.dib-btn{-webkit-appearance:none;appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:50px;padding:0 28px;border:0;border-radius:999px;font:inherit;font-size:15.5px;font-weight:650;letter-spacing:.005em;cursor:pointer;color:var(--dib-btn-text);background:linear-gradient(135deg,var(--dib-a1),var(--dib-a1-mix));box-shadow:0 1px 0 rgba(255,255,255,.25) inset,0 14px 32px -12px var(--dib-a1-70);transition:transform .18s ease,box-shadow .18s ease,filter .18s ease}',
		'.dib-btn:hover{transform:translateY(-1px);filter:brightness(1.06) saturate(1.05);box-shadow:0 1px 0 rgba(255,255,255,.25) inset,0 18px 38px -12px var(--dib-a1-80)}',
		'.dib-btn:active{transform:translateY(0) scale(.98)}',
		'.dib-btn:focus-visible{outline:3px solid var(--dib-a2-60);outline-offset:3px}',
		'.dib-btn svg{transition:transform .5s cubic-bezier(.3,.7,.3,1)}',
		'.dib-btn:hover svg{transform:rotate(180deg)}',
		'.dib-btn.is-shaking{animation:dib-shake .45s cubic-bezier(.36,.07,.19,.97) both}',
		'@keyframes dib-shake{10%,90%{transform:translateX(-1px)}20%,80%{transform:translateX(2px)}30%,50%,70%{transform:translateX(-5px)}40%,60%{transform:translateX(5px)}}',

		'.dib-status{display:flex;align-items:center;justify-content:center;gap:10px;margin:22px 0 0;min-height:22px;font-size:13.5px;line-height:1.4;color:var(--dib-muted)}',
		'.dib-ind{position:relative;flex:none;width:14px;height:14px}',
		'.dib-status[data-state="open"] .dib-ind{border-radius:50%;border:2px solid var(--dib-a1-30);border-top-color:var(--dib-a1-hi);animation:dib-spin .9s linear infinite}',
		'.dib-status[data-state="manual"] .dib-ind::before,.dib-status[data-state="still"] .dib-ind::before,.dib-status[data-state="closed"] .dib-ind::before{content:"";position:absolute;inset:3px;border-radius:50%;background:currentColor}',
		'.dib-status[data-state="manual"] .dib-ind{color:var(--dib-a1-hi)}',
		'.dib-status[data-state="still"]{color:var(--dib-warn)}',
		'.dib-status[data-state="still"] .dib-ind{color:var(--dib-warn)}',
		'.dib-status[data-state="closed"]{color:var(--dib-ok)}',
		'.dib-status[data-state="closed"] .dib-ind{color:var(--dib-ok)}',
		'.dib-status[data-state="closed"] .dib-ind::after{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid currentColor;animation:dib-ring 1.2s ease-out infinite}',
		'.dib-status-text{transition:opacity .2s ease}',

		'.dib-footer{position:relative;z-index:1;flex:none;padding:0 16px 24px;text-align:center;font-size:13px;line-height:1.5;color:var(--dib-faint)}',
		'.dib-footer a{color:inherit;text-decoration:underline;text-decoration-color:var(--dib-faint-line);text-underline-offset:3px}',
		'.dib-footer a:hover{color:var(--dib-text)}',

		'.dib[data-anim="off"] *,.dib[data-anim="off"] *::before,.dib[data-anim="off"] *::after{animation-play-state:paused!important}',
		'.dib[data-anim="off"] .dib-card,.dib[data-anim="off"] .dib-status .dib-ind,.dib[data-anim="off"] .dib-btn{animation-play-state:running!important}',
		'.dib[data-anim="off"] .dib-icon::before,.dib[data-anim="off"] .dib-icon::after{animation:none}',
		'@media (prefers-reduced-motion:reduce){.dib *,.dib *::before,.dib *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition:none!important}.dib-p-sweep,.dib-icon::before,.dib-icon::after{display:none}}',

		'@media (max-width:520px){.dib-card{border-radius:22px}.dib-icon{width:64px;height:64px;border-radius:20px;margin-bottom:22px}.dib-icon svg{width:30px;height:30px}.dib-btn{width:100%}}',

		/* Embedded copies in Theme Options: confined to their box. */
		'.dib--embed,.dib--embed .dib-bg{position:absolute}',
	].join( '\n' );

	/* ------------------------------------------------------------------
	 * Text helpers
	 * ---------------------------------------------------------------- */

	function fill( text, vars ) {
		return String( text == null ? '' : text ).replace( /\{(site_name|year|home_url)\}/g, function ( m, k ) {
			return vars && vars[ k ] != null ? String( vars[ k ] ) : m;
		} );
	}

	var FOOTER_TAGS = { A: 1, STRONG: 1, B: 1, EM: 1, I: 1, BR: 1, SPAN: 1 };

	/** Copy only whitelisted tags and attributes from untrusted markup. */
	function safeFooter( doc, html, vars ) {
		var frag = doc.createDocumentFragment();
		var tpl = doc.createElement( 'template' );
		tpl.innerHTML = String( html || '' );

		( function walk( from, to ) {
			Array.prototype.forEach.call( from.childNodes, function ( n ) {
				if ( n.nodeType === 3 ) {
					to.appendChild( doc.createTextNode( fill( n.nodeValue, vars ) ) );
					return;
				}
				if ( n.nodeType !== 1 ) {
					return;
				}
				if ( ! FOOTER_TAGS[ n.tagName ] ) {
					// Keep the text of unknown tags, but nothing from code.
					if ( ! /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|IFRAME|OBJECT|SVG|MATH)$/i.test( n.tagName ) ) {
						walk( n, to );
					}
					return;
				}
				var el = doc.createElement( n.tagName.toLowerCase() );
				if ( n.tagName === 'A' ) {
					var href = fill( n.getAttribute( 'href' ) || '', vars ).trim();
					if ( /^(https?:|mailto:|tel:|\/|#)/i.test( href ) ) {
						el.setAttribute( 'href', href );
					}
					if ( n.getAttribute( 'title' ) ) {
						el.setAttribute( 'title', n.getAttribute( 'title' ) );
					}
					if ( n.getAttribute( 'target' ) === '_blank' ) {
						el.setAttribute( 'target', '_blank' );
						el.setAttribute( 'rel', 'noopener noreferrer' );
					}
				}
				to.appendChild( el );
				walk( n, el );
			} );
		} )( tpl.content, frag );

		return frag;
	}

	function textEl( doc, tag, cls, text ) {
		var el = doc.createElement( tag );
		if ( cls ) {
			el.className = cls;
		}
		if ( text != null ) {
			el.textContent = text;
		}
		return el;
	}

	/* ------------------------------------------------------------------
	 * Theme: settings → colours and custom properties
	 * ---------------------------------------------------------------- */

	var DEFAULTS = {
		bg_color: '#0b1020',
		accent: '#7c5cff',
		accent2: '#22d3ee',
		gradient_start: '#312e81',
		gradient_end: '#be185d',
	};

	function colorOf( s, key ) {
		return parseColor( s[ key ] ) || parseColor( DEFAULTS[ key ] );
	}

	function theme( s ) {
		var bg = colorOf( s, 'bg_color' );
		var a1 = colorOf( s, 'accent' );
		var a2 = colorOf( s, 'accent2' );
		var g1 = colorOf( s, 'gradient_start' );
		var g2 = colorOf( s, 'gradient_end' );
		var type = s.bg_type || 'pattern';

		// Opaque version of the base colour, which is what the eye actually sees.
		var bgOpaque = { r: bg.r, g: bg.g, b: bg.b, a: 1 };

		// What the text actually sits on, for the automatic text colour.
		var seen = bgOpaque;
		if ( type === 'gradient' ) {
			seen = mix( g1, g2, 0.5 );
		} else if ( type === 'image' ) {
			var overlay = Math.max( 0, Math.min( 90, parseInt( s.overlay, 10 ) || 0 ) ) / 100;
			seen = mix( { r: 70, g: 70, b: 72, a: 1 }, bgOpaque, overlay );
		} else if ( type === 'pattern' && ( s.pattern === 'aurora' || s.pattern === 'blobs' ) ) {
			seen = mix( bgOpaque, mix( a1, a2, 0.5 ), 0.25 );
		}

		var tone = s.tone === 'light' || s.tone === 'dark' ? s.tone : ( prefersLightText( seen ) ? 'dark' : 'light' );
		var dark = tone === 'dark';

		var text = dark ? { r: 248, g: 250, b: 252, a: 1 } : { r: 15, g: 18, b: 32, a: 1 };
		var btnFill = mix( a1, mix( a1, a2, 0.45 ), 0.5 );
		var btnText = prefersLightText( btnFill ) ? WHITE : INK;

		var vars = {
			'--dib-bg-solid': css( bgOpaque ),
			'--dib-text': css( text ),
			'--dib-muted': css( text, dark ? 0.74 : 0.7 ),
			'--dib-faint': css( text, dark ? 0.56 : 0.58 ),
			'--dib-faint-line': css( text, 0.3 ),
			'--dib-a1': css( a1, 1 ),
			'--dib-a1-mix': css( mix( a1, a2, 0.45 ), 1 ),
			'--dib-a1-hi': css( dark ? mix( a1, WHITE, 0.25 ) : a1, 1 ),
			'--dib-a1-14': css( a1, 0.14 ),
			'--dib-a1-22': css( a1, 0.22 ),
			'--dib-a1-30': css( a1, 0.3 ),
			'--dib-a1-40': css( a1, 0.4 ),
			'--dib-a1-60': css( a1, 0.6 ),
			'--dib-a1-70': css( a1, 0.7 ),
			'--dib-a1-80': css( a1, 0.8 ),
			'--dib-a2-18': css( a2, 0.18 ),
			'--dib-a2-60': css( a2, 0.6 ),
			'--dib-btn-text': css( btnText ),
			'--dib-badge-text': css( dark ? mix( a1, WHITE, 0.62 ) : mix( a1, INK, 0.35 ), 1 ),
			'--dib-card-glass': dark ? css( mix( bgOpaque, WHITE, 0.07 ), 0.55 ) : 'rgba(255,255,255,.62)',
			'--dib-card-solid': dark ? css( mix( bgOpaque, WHITE, 0.07 ), 1 ) : '#ffffff',
			'--dib-card-border': dark ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.85)',
			'--dib-card-hi': dark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.9)',
			'--dib-shadow': dark ? 'rgba(0,0,0,.55)' : css( mix( bgOpaque, INK, 0.6 ), 0.28 ),
			'--dib-vignette': dark ? 'rgba(0,0,0,.45)' : css( mix( bgOpaque, INK, 0.25 ), 0.18 ),
			'--dib-grain-op': dark ? '.09' : '.07',
			'--dib-warn': dark ? '#fbbf24' : '#b45309',
			'--dib-ok': dark ? '#34d399' : '#047857',
			'--dib-logo-w': ( Math.max( 40, Math.min( 400, parseInt( s.logo_width, 10 ) || 140 ) ) ) + 'px',
		};

		var fillBg = css( bgOpaque );
		if ( type === 'gradient' ) {
			var angle = Math.max( 0, Math.min( 360, parseInt( s.gradient_angle, 10 ) || 0 ) );
			fillBg = 'linear-gradient(' + angle + 'deg,' + css( g1, 1 ) + ',' + css( g2, 1 ) + ')';
			vars[ '--dib-bg-solid' ] = css( mix( g1, g2, 0.5 ), 1 );
		}
		vars[ '--dib-bg-fill' ] = fillBg;

		return {
			vars: vars,
			tone: tone,
			colors: { bg: bgOpaque, a1: a1, a2: a2, light: ! dark },
			iconGrad: [ css( dark ? mix( a1, WHITE, 0.35 ) : a1, 1 ), css( dark ? mix( a2, WHITE, 0.2 ) : mix( a2, INK, 0.2 ), 1 ) ],
		};
	}

	/* ------------------------------------------------------------------
	 * Building
	 * ---------------------------------------------------------------- */

	function backgroundMarkup( s, t ) {
		var type = s.bg_type || 'pattern';
		var out = '';

		if ( type === 'pattern' ) {
			var name = patterns[ s.pattern ] ? s.pattern : 'aurora';
			out += patterns[ name ]( t.colors, rng( 0x5eed + name.length * 7919 ) );
			out += '<div class="dib-vignette"></div>';
		} else if ( type === 'image' && s.bg_image ) {
			var url = String( s.bg_image ).replace( /["\\\n\r]/g, '' );
			var blur = Math.max( 0, Math.min( 40, parseInt( s.image_blur, 10 ) || 0 ) );
			var overlay = Math.max( 0, Math.min( 90, parseInt( s.overlay, 10 ) || 0 ) ) / 100;
			out += '<div class="dib-photo" style="background-image:url(&quot;' + encodeURI( decodeURI( url ) ).replace( /&/g, '&amp;' ) + '&quot;)' +
				( blur ? ';filter:blur(' + blur + 'px);transform:scale(1.08)' : '' ) + '"></div>' +
				'<div class="dib-photo-tint" style="background:' + css( t.colors.bg, overlay ) + '"></div>';
		} else if ( type === 'gradient' ) {
			out += '<div class="dib-vignette" style="opacity:.6"></div>';
		}

		if ( s.grain && type !== 'image' ) {
			out += '<div class="dib-grain"></div>';
		}
		return out;
	}

	function iconMarkup( name, grad ) {
		if ( ! ICONS[ name ] ) {
			return '';
		}
		return '<svg viewBox="0 0 24 24" fill="none" stroke="url(#dib-ig)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
			'<defs><linearGradient id="dib-ig" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + grad[ 0 ] + '"/><stop offset="1" stop-color="' + grad[ 1 ] + '"/></linearGradient></defs>' +
			ICONS[ name ] + '</svg>';
	}

	/**
	 * Build the page's root element.
	 *
	 * @param {Document} doc
	 * @param {Object}   s     Settings (see DIB_Settings::fields()).
	 * @param {Object}   opts  { vars, state, embed, onReload }
	 * @return {{ root: Element, setState: Function, shake: Function }}
	 */
	function build( doc, s, opts ) {
		opts = opts || {};
		var vars = opts.vars || {};
		var t = theme( s );

		var root = doc.createElement( 'div' );
		root.className = 'dib' + ( opts.embed ? ' dib--embed' : '' ) + ( opts.intro === false ? ' dib--no-intro' : '' );
		root.setAttribute( 'data-tone', t.tone );
		root.setAttribute( 'data-card', { glass: 1, solid: 1, minimal: 1 }[ s.card ] ? s.card : 'glass' );
		root.setAttribute( 'data-font', { modern: 1, rounded: 1, serif: 1, mono: 1 }[ s.font ] ? s.font : 'modern' );
		root.setAttribute( 'data-anim', s.animate ? 'on' : 'off' );
		Object.keys( t.vars ).forEach( function ( k ) {
			root.style.setProperty( k, t.vars[ k ] );
		} );

		var bg = doc.createElement( 'div' );
		bg.className = 'dib-bg';
		bg.setAttribute( 'aria-hidden', 'true' );
		bg.innerHTML = backgroundMarkup( s, t );
		root.appendChild( bg );

		var main = doc.createElement( 'main' );
		main.className = 'dib-main';
		var card = doc.createElement( 'div' );
		card.className = 'dib-card';
		card.setAttribute( 'role', 'alertdialog' );
		card.setAttribute( 'aria-labelledby', 'dib-title' );
		card.setAttribute( 'aria-describedby', 'dib-msg' );

		if ( s.show_logo && s.logo ) {
			var logo = doc.createElement( 'img' );
			logo.className = 'dib-logo';
			logo.src = s.logo;
			logo.alt = vars.site_name || '';
			logo.decoding = 'async';
			card.appendChild( logo );
		}

		if ( s.icon && s.icon !== 'none' && ICONS[ s.icon ] ) {
			var icon = doc.createElement( 'div' );
			icon.className = 'dib-icon';
			icon.innerHTML = iconMarkup( s.icon, t.iconGrad );
			card.appendChild( icon );
		}

		if ( s.show_badge ) {
			var badgeWrap = doc.createElement( 'div' );
			var badge = textEl( doc, 'span', 'dib-badge' );
			badge.appendChild( textEl( doc, 'span', 'dib-badge-dot' ) );
			badge.appendChild( doc.createTextNode( fill( s.badge, vars ) ) );
			badgeWrap.appendChild( badge );
			card.appendChild( badgeWrap );
		}

		var title = textEl( doc, 'h1', 'dib-title', fill( s.heading, vars ) );
		title.id = 'dib-title';
		card.appendChild( title );

		var msg = textEl( doc, 'div', 'dib-msg' );
		msg.id = 'dib-msg';
		String( fill( s.message, vars ) ).split( /\n+/ ).forEach( function ( line ) {
			if ( line.trim() ) {
				msg.appendChild( textEl( doc, 'p', null, line.trim() ) );
			}
		} );
		card.appendChild( msg );

		var btn = doc.createElement( 'button' );
		btn.type = 'button';
		btn.className = 'dib-btn';
		btn.innerHTML = RELOAD_ICON;
		btn.appendChild( textEl( doc, 'span', null, fill( s.button_text, vars ) ) );
		btn.addEventListener( 'click', function ( e ) {
			e.preventDefault();
			if ( opts.onReload ) {
				opts.onReload();
			}
		} );
		var actions = textEl( doc, 'div', 'dib-actions' );
		actions.appendChild( btn );
		card.appendChild( actions );

		var status = textEl( doc, 'p', 'dib-status' );
		status.setAttribute( 'role', 'status' );
		status.setAttribute( 'aria-live', 'polite' );
		status.appendChild( textEl( doc, 'span', 'dib-ind' ) ).setAttribute( 'aria-hidden', 'true' );
		var statusText = status.appendChild( textEl( doc, 'span', 'dib-status-text' ) );
		if ( ! s.show_status ) {
			status.style.display = 'none';
		}
		card.appendChild( status );

		main.appendChild( card );
		root.appendChild( main );

		if ( s.show_footer && String( s.footer_text || '' ).trim() ) {
			var footer = doc.createElement( 'footer' );
			footer.className = 'dib-footer';
			footer.appendChild( safeFooter( doc, s.footer_text, vars ) );
			root.appendChild( footer );
		}

		var texts = {
			open: s.waiting_text,
			manual: s.manual_text,
			still: s.still_open_text,
			closed: s.reloading_text,
		};

		function setState( state ) {
			if ( ! texts[ state ] ) {
				state = 'open';
			}
			// "Still open" is an answer to a click; screen readers should hear
			// it even though the visible status keeps its place.
			status.setAttribute( 'data-state', state );
			statusText.textContent = fill( texts[ state ], vars );
		}

		function shake() {
			btn.classList.remove( 'is-shaking' );
			void btn.offsetWidth; // Restart the animation.
			btn.classList.add( 'is-shaking' );
		}

		setState( opts.state || 'open' );

		return { root: root, setState: setState, shake: shake, button: btn };
	}

	/**
	 * Replace a document's entire contents with the page.
	 *
	 * Removes <head> and <body> outright, so the site's styles, scripts' DOM and
	 * content are gone from the Elements panel rather than merely hidden.
	 */
	function mount( doc, s, opts ) {
		opts = opts || {};
		var html = doc.documentElement;

		while ( html.firstChild ) {
			html.removeChild( html.firstChild );
		}
		Array.prototype.slice.call( html.attributes ).forEach( function ( a ) {
			if ( a.name !== 'lang' && a.name !== 'dir' ) {
				html.removeAttribute( a.name );
			}
		} );
		if ( opts.lang ) {
			html.setAttribute( 'lang', opts.lang );
		}
		if ( opts.rtl ) {
			html.setAttribute( 'dir', 'rtl' );
		}

		var head = doc.createElement( 'head' );
		var meta = doc.createElement( 'meta' );
		meta.setAttribute( 'charset', 'utf-8' );
		head.appendChild( meta );
		meta = doc.createElement( 'meta' );
		meta.name = 'viewport';
		meta.content = 'width=device-width,initial-scale=1';
		head.appendChild( meta );
		meta = doc.createElement( 'meta' );
		meta.name = 'robots';
		meta.content = 'noindex';
		head.appendChild( meta );
		head.appendChild( textEl( doc, 'title', null, fill( s.page_title, opts.vars ) ) );
		head.appendChild( textEl( doc, 'style', null, STYLES ) );
		html.appendChild( head );

		var body = doc.createElement( 'body' );
		var page = build( doc, s, opts );
		body.appendChild( page.root );
		html.appendChild( body );

		try {
			doc.adoptedStyleSheets = [];
		} catch ( e ) {}

		page.head = head;
		page.body = body;
		return page;
	}

	root.DIBPage = {
		styles: STYLES,
		build: build,
		mount: mount,
		patterns: Object.keys( patterns ),
		parseColor: parseColor,
	};
} )( window );
