<?php
/**
 * Front end: decides whether this request is guarded, and loads the detector.
 *
 * The detector runs in <head>, before the body is parsed, so DevTools that are
 * already open when the page loads never see the content render at all.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class DIB_Frontend {

	const HANDLES = array( 'dib-page', 'dib-inspect-blocker' );

	public static function init() {
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ), 1 );
		add_filter( 'script_loader_tag', array( __CLASS__, 'script_tag' ), 10, 2 );

		// Optimisers that defer or delay JavaScript would start the check late.
		add_filter( 'rocket_delay_js_exclusions', array( __CLASS__, 'optimizer_exclusions' ) );
		add_filter( 'rocket_exclude_defer_js', array( __CLASS__, 'optimizer_exclusions' ) );
		add_filter( 'rocket_exclude_js', array( __CLASS__, 'optimizer_exclusions' ) );
	}

	/**
	 * 'guard' to protect this request, 'preview' to show the error page right
	 * away (an admin's full-screen preview), or '' to do nothing.
	 *
	 * @return string
	 */
	public static function mode() {
		if ( ! DIB_Settings::available() ) {
			return '';
		}

		if ( is_admin() || wp_doing_ajax() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) || is_feed() || is_robots() || is_embed() ) {
			return '';
		}

		// Divi's Visual Builder, the Customizer and Divi's own previews.
		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- read-only checks.
		if ( is_customize_preview() || isset( $_GET['et_fb'] ) || isset( $_GET['et_pb_preview'] ) ) {
			return '';
		}
		if ( function_exists( 'et_core_is_fb_enabled' ) && et_core_is_fb_enabled() ) {
			return '';
		}

		if ( isset( $_GET['dib_preview'] ) && current_user_can( 'edit_theme_options' ) ) {
			return 'preview';
		}
		// phpcs:enable

		$s = DIB_Settings::get();

		// Detection and the right-click / shortcut blocks are separate
		// switches; any one of them is reason enough to load the script.
		if ( ! $s['enabled'] && ! $s['block_contextmenu'] && ! $s['block_shortcuts'] ) {
			return '';
		}

		if ( self::is_exempt_user( $s['exempt'] ) || self::is_excluded_path( $s['exclude'] ) ) {
			return '';
		}

		/**
		 * Whether the current request is guarded.
		 *
		 * @param bool $guard
		 */
		return apply_filters( 'dib_should_guard', true ) ? 'guard' : '';
	}

	private static function is_exempt_user( $exempt ) {
		if ( 'logged_in' === $exempt ) {
			return is_user_logged_in();
		}
		if ( 'admins' === $exempt ) {
			return current_user_can( 'edit_theme_options' );
		}
		return false;
	}

	/** Normalised path for comparison: no home sub-directory, no trailing slash, lower case. */
	private static function normalize_path( $url ) {
		$path = wp_parse_url( $url, PHP_URL_PATH );
		$path = is_string( $path ) ? $path : '';

		$home = wp_parse_url( home_url( '/' ), PHP_URL_PATH );
		$home = is_string( $home ) ? rtrim( $home, '/' ) : '';

		if ( '' !== $home && 0 === strpos( $path, $home ) ) {
			$path = substr( $path, strlen( $home ) );
		}

		return strtolower( '/' . trim( rawurldecode( $path ), '/' ) );
	}

	private static function is_excluded_path( $list ) {
		if ( '' === trim( (string) $list ) ) {
			return false;
		}

		$uri     = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '/'; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- only compared.
		$current = self::normalize_path( $uri );

		foreach ( preg_split( '/[\r\n]+/', $list ) as $line ) {
			$line = trim( $line );
			if ( '' === $line ) {
				continue;
			}

			$wild = '*' === substr( $line, -1 );
			$rule = self::normalize_path( rtrim( $line, '*' ) );

			if ( $wild ) {
				if ( '/' === $rule || $current === $rule || 0 === strpos( $current, $rule . '/' ) ) {
					return true;
				}
			} elseif ( $current === $rule ) {
				return true;
			}
		}

		return false;
	}

	/** The logo from Theme Options > General, if one was set. */
	public static function theme_logo() {
		if ( ! DIB_Settings::available() ) {
			return '';
		}

		$short = isset( $GLOBALS['shortname'] ) && is_string( $GLOBALS['shortname'] ) ? $GLOBALS['shortname'] : 'divi';
		$logo  = et_get_option( $short . '_logo' );

		return is_string( $logo ) ? esc_url_raw( $logo ) : '';
	}

	public static function enqueue() {
		$mode = self::mode();

		if ( '' === $mode ) {
			return;
		}

		$s = DIB_Settings::get();

		if ( '' === $s['logo'] ) {
			$s['logo'] = self::theme_logo();
		}

		$s['footer_text'] = wp_kses( $s['footer_text'], DIB_Settings::FOOTER_TAGS );

		// Server-side only; no reason to publish them in every page.
		unset( $s['exempt'], $s['exclude'] );

		// The page settings are only needed when the page can be shown.
		$detect = 'preview' === $mode || $s['enabled'];

		$config = array(
			'mode'     => $mode,
			'detect'   => $detect,
			'settings' => $detect ? $s : array(
				'block_contextmenu' => $s['block_contextmenu'],
				'block_shortcuts'   => $s['block_shortcuts'],
			),
			'vars'     => array(
				'site_name' => wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ),
				'year'      => gmdate( 'Y' ),
				'home_url'  => home_url( '/' ),
			),
			'lang'     => get_bloginfo( 'language' ),
			'rtl'      => is_rtl(),
		);

		// In <head>, not deferred: the check has to run before the body exists.
		// The page renderer is skipped when only right-click / shortcuts are blocked.
		$deps = array();
		if ( $detect ) {
			wp_enqueue_script( 'dib-page', DIB_URL . 'assets/js/dib-page.js', array(), DIB_VERSION, false );
			$deps[] = 'dib-page';
		}
		wp_enqueue_script( 'dib-inspect-blocker', DIB_URL . 'assets/js/inspect-blocker.js', $deps, DIB_VERSION, false );
		wp_add_inline_script(
			'dib-inspect-blocker',
			'window.dibConfig = ' . wp_json_encode( $config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES ) . ';',
			'before'
		);
	}

	/**
	 * Ask the common optimisers (Cloudflare Rocket Loader, LiteSpeed, Autoptimize,
	 * SiteGround, PageSpeed) to leave these scripts where they are.
	 */
	public static function script_tag( $tag, $handle ) {
		if ( ! in_array( $handle, self::HANDLES, true ) ) {
			return $tag;
		}

		return str_replace(
			'<script ',
			'<script data-cfasync="false" data-no-optimize="1" data-no-defer="1" data-noptimize="1" data-pagespeed-no-defer ',
			$tag
		);
	}

	/**
	 * @param string[] $list
	 * @return string[]
	 */
	public static function optimizer_exclusions( $list ) {
		$list   = is_array( $list ) ? $list : array();
		$list[] = '/divi-inspect-blocker/assets/js/(.*).js';
		$list[] = 'dibConfig';
		return $list;
	}
}
