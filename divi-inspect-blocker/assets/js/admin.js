/**
 * Divi Inspect Blocker — Theme Options tab.
 *
 * ePanel draws and saves the fields; this adds what ePanel has no field type
 * for: alpha colour pickers, a visual design picker, fields that show only when
 * they apply, and a live preview that redraws as settings change. The preview
 * is drawn by the same DIBPage renderer the front end uses.
 */
( function ( $ ) {
	'use strict';

	var cfg = window.dibAdmin;

	if ( ! cfg || ! window.DIBPage ) {
		return;
	}

	var fields = cfg.fields;
	var previews = [];
	var thumbs = [];
	var previewState = 'open';
	var lastSig = '';
	var renderTimer = 0;

	function $field( key ) {
		return $( '#' + fields[ key ].id );
	}

	function $box( key ) {
		return $field( key ).closest( '.et-epanel-box' );
	}

	/* ------------------------------------------------------------------
	 * Reading the form — mirrors DIB_Settings::resolve()
	 * ---------------------------------------------------------------- */

	function read() {
		var out = {};

		Object.keys( fields ).forEach( function ( key ) {
			var f = fields[ key ];
			var $el = $field( key );
			var v;

			switch ( f.type ) {
				case 'checkbox':
				case 'checkbox2':
					v = $el.length ? $el.is( ':checked' ) : f.default === 'on';
					break;
				case 'number':
					v = parseInt( $el.val(), 10 );
					v = isNaN( v ) ? f.default : v;
					break;
				case 'color':
					v = String( $el.val() || '' ).trim();
					v = window.DIBPage.parseColor( v ) ? v : f.default;
					break;
				case 'upload':
					v = String( $el.val() || '' ).trim();
					break;
				default:
					v = String( $el.val() == null ? '' : $el.val() ).trim();
					if ( v === '' ) {
						v = f.default;
					}
			}
			out[ key ] = v;
		} );

		if ( ! out.logo ) {
			out.logo = cfg.themeLogo || '';
		}
		return out;
	}

	var vars = { site_name: cfg.siteName, year: cfg.year, home_url: cfg.homeUrl };

	/* ------------------------------------------------------------------
	 * Live preview
	 * ---------------------------------------------------------------- */

	var VIEWS = {
		desktop: { w: 1280, h: 800 },
		mobile: { w: 390, h: 780 },
	};

	function setupPreview( el ) {
		var $wrap = $( el );
		var $stage = $wrap.find( '.dib-preview__stage' );
		var frame = document.createElement( 'iframe' );

		frame.className = 'dib-preview__frame';
		frame.setAttribute( 'title', 'Error page preview' );
		frame.setAttribute( 'tabindex', '-1' );
		frame.srcdoc = '<!DOCTYPE html><html><head></head><body></body></html>';
		$stage.append( frame );

		$wrap.closest( '.et-epanel-box' ).addClass( 'dib-wide dib-preview-box' );

		var p = { $wrap: $wrap, $stage: $stage, frame: frame, view: 'desktop', page: null, ready: false };

		frame.addEventListener( 'load', function () {
			p.ready = true;
			draw( p, read() );
		} );

		$wrap.on( 'click', '[data-dib-view]', function () {
			p.view = $( this ).data( 'dib-view' );
			$wrap.find( '[data-dib-view]' ).removeClass( 'is-active' ).filter( this ).addClass( 'is-active' );
			fit( p );
		} );

		$wrap.on( 'click', '[data-dib-state]', function () {
			previewState = $( this ).data( 'dib-state' );
			$( '[data-dib-state]' ).removeClass( 'is-active' ).filter( '[data-dib-state="' + previewState + '"]' ).addClass( 'is-active' );
			previews.forEach( function ( q ) {
				if ( q.page ) {
					q.page.setState( stateFor( read() ) );
				}
			} );
		} );

		previews.push( p );
	}

	function stateFor( s ) {
		if ( previewState === 'open' && ! s.auto_reload ) {
			return 'manual';
		}
		return previewState;
	}

	function fit( p ) {
		var v = VIEWS[ p.view ];
		var w = p.$stage.width() || 600;
		var maxH = p.view === 'mobile' ? 620 : Infinity;
		var scale = Math.min( 1, w / v.w, maxH / v.h );

		p.frame.style.width = v.w + 'px';
		p.frame.style.height = v.h + 'px';
		p.frame.style.transform = 'scale(' + scale + ')';
		p.frame.style.left = Math.max( 0, ( w - v.w * scale ) / 2 ) + 'px';
		p.$stage.css( 'height', Math.round( v.h * scale ) + 'px' );
		p.$wrap.toggleClass( 'is-mobile', p.view === 'mobile' );
	}

	function draw( p, s ) {
		if ( ! p.ready ) {
			return;
		}
		var doc = p.frame.contentDocument;
		if ( ! doc || ! doc.documentElement ) {
			return;
		}
		p.page = window.DIBPage.mount( doc, s, {
			vars: vars,
			state: stateFor( s ),
			// Only the first draw fades in; redraws while typing must not flicker.
			intro: ! p.drawn,
			onReload: function () {
				// What a visitor sees when they click with DevTools still open.
				p.page.setState( 'still' );
				p.page.shake();
				setTimeout( function () {
					if ( p.page ) {
						p.page.setState( stateFor( read() ) );
					}
				}, 2500 );
			},
		} );
		p.drawn = true;
		fit( p );
	}

	/* ------------------------------------------------------------------
	 * Design picker
	 * ---------------------------------------------------------------- */

	function setupDesignPicker() {
		var $select = $field( 'pattern' );
		if ( ! $select.length ) {
			return;
		}

		var $grid = $( '<div class="dib-designs" role="radiogroup"></div>' ).attr( 'aria-label', cfg.i18n.designs );

		Object.keys( cfg.patterns ).forEach( function ( key ) {
			var $tile = $( '<button type="button" class="dib-design" role="radio"></button>' ).attr( 'data-pattern', key );
			var frame = document.createElement( 'iframe' );
			frame.setAttribute( 'tabindex', '-1' );
			frame.setAttribute( 'aria-hidden', 'true' );
			frame.srcdoc = '<!DOCTYPE html><html><head></head><body></body></html>';

			var $thumb = $( '<span class="dib-design__thumb"></span>' ).append( frame );
			$tile.append( $thumb, $( '<span class="dib-design__name"></span>' ).text( cfg.patterns[ key ] ) );
			$grid.append( $tile );

			var t = { key: key, frame: frame, ready: false };
			frame.addEventListener( 'load', function () {
				t.ready = true;
				drawThumb( t, read() );
			} );
			thumbs.push( t );
		} );

		$select.addClass( 'dib-visually-hidden' ).after( $grid );
		$box( 'pattern' ).addClass( 'dib-wide' );

		$grid.on( 'click', '.dib-design', function () {
			$select.val( $( this ).data( 'pattern' ) ).trigger( 'change' );
			markDesign();
			schedule();
		} );

		markDesign();
	}

	function markDesign() {
		var current = $field( 'pattern' ).val();
		$( '.dib-design' ).each( function () {
			var on = $( this ).data( 'pattern' ) === current;
			$( this ).toggleClass( 'is-active', on ).attr( 'aria-checked', on ? 'true' : 'false' );
		} );
	}

	function drawThumb( t, s ) {
		if ( ! t.ready ) {
			return;
		}
		var doc = t.frame.contentDocument;
		if ( ! doc || ! doc.documentElement ) {
			return;
		}
		var page = window.DIBPage.mount( doc, $.extend( {}, s, { bg_type: 'pattern', pattern: t.key, animate: false } ), { vars: vars } );
		$( page.root ).find( '.dib-main, .dib-footer' ).remove();
	}

	/* ------------------------------------------------------------------
	 * Show only what applies
	 * ---------------------------------------------------------------- */

	function toggleBoxes( s ) {
		var type = s.bg_type;
		var show = {
			pattern: type === 'pattern',
			grain: type !== 'image',
			gradient_start: type === 'gradient',
			gradient_end: type === 'gradient',
			gradient_angle: type === 'gradient',
			bg_image: type === 'image',
			overlay: type === 'image',
			image_blur: type === 'image',
			logo: s.show_logo,
			logo_width: s.show_logo,
			footer_text: s.show_footer,
			badge: s.show_badge,
			waiting_text: s.show_status && s.auto_reload,
			manual_text: s.show_status && ! s.auto_reload,
			reloading_text: s.show_status,
			still_open_text: s.show_status,
		};
		Object.keys( show ).forEach( function ( key ) {
			$box( key ).toggleClass( 'dib-hidden', ! show[ key ] );
		} );
	}

	/* ------------------------------------------------------------------
	 * Change tracking
	 *
	 * ePanel's uploader, its Reset links and the yes/no toggles change values
	 * without firing events, so a cheap signature check catches everything.
	 * ---------------------------------------------------------------- */

	function render() {
		var s = read();
		toggleBoxes( s );
		markDesign();
		previews.forEach( function ( p ) {
			draw( p, s );
		} );
	}

	function renderThumbs() {
		var s = read();
		thumbs.forEach( function ( t ) {
			drawThumb( t, s );
		} );
	}

	function schedule() {
		clearTimeout( renderTimer );
		renderTimer = setTimeout( check, 90 );
	}

	var lastColors = '';

	function check() {
		var s = read();
		var sig = JSON.stringify( s );
		if ( sig === lastSig ) {
			return;
		}
		lastSig = sig;
		render();

		var colors = [ s.bg_color, s.accent, s.accent2, s.tone, s.grain ].join( '|' );
		if ( colors !== lastColors ) {
			lastColors = colors;
			renderThumbs();
		}
	}

	function setupColors() {
		Object.keys( fields ).forEach( function ( key ) {
			if ( fields[ key ].type !== 'color' ) {
				return;
			}
			var $el = $field( key );
			if ( ! $el.length || ! $.fn.wpColorPicker ) {
				return;
			}
			$el.attr( { 'data-alpha': 'true', 'data-alpha-enabled': 'true', 'data-alpha-color-type': 'hex' } )
				.addClass( 'dib-color' )
				.wpColorPicker( {
					defaultColor: fields[ key ].default,
					change: schedule,
					clear: schedule,
				} );
			$box( key ).addClass( 'dib-color-box' );
		} );
	}

	$( function () {
		if ( ! $( '#wrap-dib' ).length ) {
			return;
		}

		setupColors();
		setupDesignPicker();
		$( '[data-dib-preview]' ).each( function () {
			setupPreview( this );
		} );

		$( '#wrap-dib' ).on( 'input change', 'input, select, textarea', schedule );
		$( '#wrap-dib' ).on( 'click', '.et_pb_yes_no_button, .et-upload-image-reset', function () {
			setTimeout( schedule, 0 );
		} );

		// Catches the media library, Reset to Defaults and anything else.
		setInterval( function () {
			if ( $( '#wrap-dib' ).is( ':visible' ) ) {
				check();
				thumbs.forEach( function ( t ) {
					var w = t.frame.parentNode.clientWidth;
					if ( w && w !== t.lastW ) {
						t.lastW = w;
						t.frame.style.transform = 'scale(' + w / 800 + ')';
					}
				} );
				previews.forEach( function ( p ) {
					if ( p.$stage.is( ':visible' ) && Math.abs( p.$stage.width() - ( p.lastW || 0 ) ) > 1 ) {
						p.lastW = p.$stage.width();
						fit( p );
					}
				} );
			}
		}, 400 );

		$( window ).on( 'resize', function () {
			previews.forEach( fit );
		} );

		check();
	} );
} )( jQuery );
