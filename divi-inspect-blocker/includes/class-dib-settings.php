<?php
/**
 * Settings registry: what the options are, their defaults, and how a stored
 * value is turned back into something safe to use.
 *
 * The values themselves are stored by Divi's ePanel, in the theme's one-row
 * option (`et_divi` for Divi), under ids prefixed `dib_`. Nothing here writes
 * to the database — ePanel's own Save, Reset and Portability handle that.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class DIB_Settings {

	const PREFIX = 'dib_';

	/** Tags allowed in the footer text, on save and again on output. */
	const FOOTER_TAGS = array(
		'a'      => array(
			'href'   => true,
			'title'  => true,
			'target' => true,
			'rel'    => true,
		),
		'strong' => array(),
		'b'      => array(),
		'em'     => array(),
		'i'      => array(),
		'br'     => array(),
		'span'   => array(),
	);

	/** @var array|null */
	private static $fields = null;

	/**
	 * Every option, in display order.
	 *
	 * Keys are unprefixed; the ePanel id is PREFIX . key. 'tab' is the ePanel
	 * sub-tab the field sits in.
	 *
	 * @return array<string,array>
	 */
	public static function fields() {
		if ( null !== self::$fields ) {
			return self::$fields;
		}

		$opacity = array();
		for ( $i = 0; $i <= 90; $i += 10 ) {
			/* translators: %d: overlay opacity percentage */
			$opacity[ (string) $i ] = sprintf( __( '%d%%', 'divi-inspect-blocker' ), $i );
		}

		self::$fields = array(

			/* ---------------------------------------------------------- General */

			'enabled'           => array(
				'tab'     => 'general',
				'type'    => 'checkbox',
				'default' => 'on',
				'name'    => __( 'Enable Inspect Blocker', 'divi-inspect-blocker' ),
				'desc'    => __( 'Watches for the browser\'s developer tools (Inspect). While they are open the page is wiped and replaced by the error page designed in the other tabs. Independent of the right-click and shortcut options below.', 'divi-inspect-blocker' ),
			),
			'auto_reload'       => array(
				'tab'     => 'general',
				'type'    => 'checkbox2',
				'default' => 'on',
				'name'    => __( 'Reload automatically when closed', 'divi-inspect-blocker' ),
				'desc'    => __( 'Keeps checking after the page is wiped, and reloads it on its own as soon as developer tools are closed. The Reload button still works either way.', 'divi-inspect-blocker' ),
			),
			'block_contextmenu' => array(
				'tab'     => 'general',
				'type'    => 'checkbox',
				'default' => 'off',
				'name'    => __( 'Disable right-click menu', 'divi-inspect-blocker' ),
				'desc'    => __( 'Turns off the browser\'s right-click menu, which is where "Inspect" lives. Works on its own, with or without Inspect Blocker enabled. Form fields keep it, so copy and paste still work there.', 'divi-inspect-blocker' ),
			),
			'block_shortcuts'   => array(
				'tab'     => 'general',
				'type'    => 'checkbox2',
				'default' => 'off',
				'name'    => __( 'Block developer tools shortcuts', 'divi-inspect-blocker' ),
				'desc'    => __( 'Swallows F12, Ctrl+Shift+I / J / C, Ctrl+U and their Mac equivalents. Works on its own too. Browsers do not let every shortcut be blocked, and the browser menu still opens DevTools — detection covers that.', 'divi-inspect-blocker' ),
			),
			'exempt'            => array(
				'tab'     => 'general',
				'type'    => 'select',
				'default' => 'logged_in',
				'options' => array(
					'logged_in' => __( 'All logged-in users (only visitors are checked)', 'divi-inspect-blocker' ),
					'admins'    => __( 'Administrators only (can edit theme options)', 'divi-inspect-blocker' ),
					'none'      => __( 'Nobody — apply to everyone', 'divi-inspect-blocker' ),
				),
				'name'    => __( 'Never apply to', 'divi-inspect-blocker' ),
				'desc'    => __( 'Who is left alone by everything on this tab — detection, the right-click block and the shortcut block. By default only visitors who are not logged in are checked. To see it as a visitor does, use a private window, or the full-screen preview below.', 'divi-inspect-blocker' ),
			),
			'exclude'           => array(
				'tab'     => 'general',
				'type'    => 'textarea',
				'default' => '',
				'plain'   => true,
				'allow_empty' => true,
				'name'    => __( 'Pages to leave alone', 'divi-inspect-blocker' ),
				'desc'    => __( 'One path per line, e.g. /checkout/. End a line with * to match everything under it, e.g. /docs/*. Full URLs work too; only the path is compared.', 'divi-inspect-blocker' ),
			),

			/* ---------------------------------------------------------- Content */

			'page_title'        => array(
				'tab'     => 'content',
				'type'    => 'text',
				'default' => __( 'Content unavailable', 'divi-inspect-blocker' ),
				'name'    => __( 'Browser tab title', 'divi-inspect-blocker' ),
				'desc'    => __( 'Replaces the page title while the error page is showing.', 'divi-inspect-blocker' ),
			),
			'show_badge'        => array(
				'tab'     => 'content',
				'type'    => 'checkbox',
				'default' => 'on',
				'name'    => __( 'Show badge', 'divi-inspect-blocker' ),
				'desc'    => __( 'The small label above the heading.', 'divi-inspect-blocker' ),
			),
			'show_status'       => array(
				'tab'     => 'content',
				'type'    => 'checkbox2',
				'default' => 'on',
				'name'    => __( 'Show live status', 'divi-inspect-blocker' ),
				'desc'    => __( 'The line under the button that says whether developer tools are still open and when the page is about to reload.', 'divi-inspect-blocker' ),
			),
			'badge'             => array(
				'tab'     => 'content',
				'type'    => 'text',
				'default' => __( 'Developer tools detected', 'divi-inspect-blocker' ),
				'name'    => __( 'Badge text', 'divi-inspect-blocker' ),
				'desc'    => __( 'Short — two to four words reads best. Placeholders: {site_name}, {year}.', 'divi-inspect-blocker' ),
			),
			'heading'           => array(
				'tab'     => 'content',
				'type'    => 'text',
				'default' => __( 'Please close developer tools', 'divi-inspect-blocker' ),
				'name'    => __( 'Heading', 'divi-inspect-blocker' ),
				'desc'    => __( 'Placeholders: {site_name}, {year}.', 'divi-inspect-blocker' ),
			),
			'message'           => array(
				'tab'     => 'content',
				'type'    => 'textarea',
				'default' => __( "To protect this site's content, the page is hidden while your browser's developer tools are open.\nClose them and everything will be right back.", 'divi-inspect-blocker' ),
				'plain'   => true,
				'name'    => __( 'Message', 'divi-inspect-blocker' ),
				'desc'    => __( 'Each line becomes its own paragraph. Placeholders: {site_name}, {year}.', 'divi-inspect-blocker' ),
			),
			'button_text'       => array(
				'tab'     => 'content',
				'type'    => 'text',
				'default' => __( 'Reload page', 'divi-inspect-blocker' ),
				'name'    => __( 'Button text', 'divi-inspect-blocker' ),
				'desc'    => __( 'The Reload button checks first; if developer tools are still open it says so instead of reloading.', 'divi-inspect-blocker' ),
			),
			'waiting_text'      => array(
				'tab'     => 'content',
				'type'    => 'text',
				'default' => __( 'Waiting for developer tools to close…', 'divi-inspect-blocker' ),
				'name'    => __( 'Status: waiting', 'divi-inspect-blocker' ),
				'desc'    => __( 'Shown while developer tools are open and automatic reload is on.', 'divi-inspect-blocker' ),
			),
			'manual_text'       => array(
				'tab'     => 'content',
				'type'    => 'text',
				'default' => __( 'Close developer tools, then reload the page.', 'divi-inspect-blocker' ),
				'name'    => __( 'Status: manual reload', 'divi-inspect-blocker' ),
				'desc'    => __( 'Shown instead of the waiting text when automatic reload is off.', 'divi-inspect-blocker' ),
			),
			'reloading_text'    => array(
				'tab'     => 'content',
				'type'    => 'text',
				'default' => __( 'Developer tools closed — bringing the page back…', 'divi-inspect-blocker' ),
				'name'    => __( 'Status: reloading', 'divi-inspect-blocker' ),
				'desc'    => __( 'Shown for a moment just before the page reloads.', 'divi-inspect-blocker' ),
			),
			'still_open_text'   => array(
				'tab'     => 'content',
				'type'    => 'text',
				'default' => __( 'Developer tools are still open. Close them first, then try again.', 'divi-inspect-blocker' ),
				'name'    => __( 'Status: still open', 'divi-inspect-blocker' ),
				'desc'    => __( 'Shown when the Reload button is clicked while developer tools are still open.', 'divi-inspect-blocker' ),
			),

			/* --------------------------------------------------------- Branding */

			'show_logo'         => array(
				'tab'     => 'branding',
				'type'    => 'checkbox',
				'default' => 'off',
				'name'    => __( 'Show logo', 'divi-inspect-blocker' ),
				'desc'    => __( 'Shows the logo below at the top of the card.', 'divi-inspect-blocker' ),
			),
			'show_footer'       => array(
				'tab'     => 'branding',
				'type'    => 'checkbox2',
				'default' => 'on',
				'name'    => __( 'Show footer', 'divi-inspect-blocker' ),
				'desc'    => __( 'A small line of text along the bottom of the page.', 'divi-inspect-blocker' ),
			),
			'logo'              => array(
				'tab'     => 'branding',
				'type'    => 'upload',
				'default' => '',
				'name'    => __( 'Logo', 'divi-inspect-blocker' ),
				'desc'    => __( 'PNG, SVG or WebP with a transparent background works best. Leave empty to use the logo from Theme Options > General.', 'divi-inspect-blocker' ),
			),
			'logo_width'        => array(
				'tab'     => 'branding',
				'type'    => 'number',
				'default' => 140,
				'min'     => 40,
				'max'     => 400,
				'name'    => __( 'Logo width (px)', 'divi-inspect-blocker' ),
				'desc'    => __( 'Maximum width, 40–400. The logo never grows past its own size or the card.', 'divi-inspect-blocker' ),
			),
			'footer_text'       => array(
				'tab'     => 'branding',
				'type'    => 'textarea',
				'default' => __( '© {year} {site_name}. All rights reserved.', 'divi-inspect-blocker' ),
				'html'    => true,
				'name'    => __( 'Footer text', 'divi-inspect-blocker' ),
				'desc'    => __( 'Links, bold and italics are allowed. Placeholders: {site_name}, {year}, {home_url}.', 'divi-inspect-blocker' ),
			),

			/* ----------------------------------------------------------- Design */

			'bg_type'           => array(
				'tab'     => 'design',
				'type'    => 'select',
				'default' => 'pattern',
				'options' => array(
					'pattern'  => __( 'Designed background', 'divi-inspect-blocker' ),
					'solid'    => __( 'Solid colour', 'divi-inspect-blocker' ),
					'gradient' => __( 'Gradient', 'divi-inspect-blocker' ),
					'image'    => __( 'Uploaded photo', 'divi-inspect-blocker' ),
				),
				'name'    => __( 'Background', 'divi-inspect-blocker' ),
				'desc'    => __( 'Designed backgrounds are drawn in the browser from the colours below, so they stay sharp at any size and add no image download.', 'divi-inspect-blocker' ),
			),
			'pattern'           => array(
				'tab'     => 'design',
				'type'    => 'select',
				'default' => 'aurora',
				'options' => self::patterns(),
				'name'    => __( 'Design', 'divi-inspect-blocker' ),
				'desc'    => __( 'Every design is tinted with the base and accent colours.', 'divi-inspect-blocker' ),
			),
			'animate'           => array(
				'tab'     => 'design',
				'type'    => 'checkbox',
				'default' => 'on',
				'name'    => __( 'Animate', 'divi-inspect-blocker' ),
				'desc'    => __( 'Slow, subtle motion in the background and icon. Always off for visitors who ask their system for reduced motion.', 'divi-inspect-blocker' ),
			),
			'grain'             => array(
				'tab'     => 'design',
				'type'    => 'checkbox2',
				'default' => 'on',
				'name'    => __( 'Film grain', 'divi-inspect-blocker' ),
				'desc'    => __( 'A faint noise texture over the background that stops smooth gradients from banding.', 'divi-inspect-blocker' ),
			),
			'bg_color'          => array(
				'tab'     => 'design',
				'type'    => 'color',
				'default' => '#0b1020',
				'name'    => __( 'Base colour', 'divi-inspect-blocker' ),
				'desc'    => __( 'The page background, and the colour designed backgrounds are drawn on.', 'divi-inspect-blocker' ),
			),
			'accent'            => array(
				'tab'     => 'design',
				'type'    => 'color',
				'default' => '#7c5cff',
				'name'    => __( 'Accent colour', 'divi-inspect-blocker' ),
				'desc'    => __( 'Button, icon and the main colour of designed backgrounds.', 'divi-inspect-blocker' ),
			),
			'accent2'           => array(
				'tab'     => 'design',
				'type'    => 'color',
				'default' => '#22d3ee',
				'name'    => __( 'Second accent colour', 'divi-inspect-blocker' ),
				'desc'    => __( 'Blended with the accent colour in designed backgrounds and highlights.', 'divi-inspect-blocker' ),
			),
			'gradient_start'    => array(
				'tab'     => 'design',
				'type'    => 'color',
				'default' => '#312e81',
				'name'    => __( 'Gradient start', 'divi-inspect-blocker' ),
				'desc'    => '',
			),
			'gradient_end'      => array(
				'tab'     => 'design',
				'type'    => 'color',
				'default' => '#be185d',
				'name'    => __( 'Gradient end', 'divi-inspect-blocker' ),
				'desc'    => '',
			),
			'gradient_angle'    => array(
				'tab'     => 'design',
				'type'    => 'number',
				'default' => 135,
				'min'     => 0,
				'max'     => 360,
				'name'    => __( 'Gradient angle (°)', 'divi-inspect-blocker' ),
				'desc'    => __( '0 runs bottom to top, 90 left to right, 135 top-left to bottom-right.', 'divi-inspect-blocker' ),
			),
			'bg_image'          => array(
				'tab'     => 'design',
				'type'    => 'upload',
				'default' => '',
				'name'    => __( 'Background photo', 'divi-inspect-blocker' ),
				'desc'    => __( 'Covers the whole screen, centred. Around 2000px wide is plenty.', 'divi-inspect-blocker' ),
			),
			'overlay'           => array(
				'tab'     => 'design',
				'type'    => 'select',
				'default' => '50',
				'options' => $opacity,
				'name'    => __( 'Photo overlay', 'divi-inspect-blocker' ),
				'desc'    => __( 'Tints the photo with the base colour so the text stays readable.', 'divi-inspect-blocker' ),
			),
			'image_blur'        => array(
				'tab'     => 'design',
				'type'    => 'select',
				'default' => '0',
				'options' => array(
					'0'  => __( 'None', 'divi-inspect-blocker' ),
					'4'  => __( 'Soft', 'divi-inspect-blocker' ),
					'10' => __( 'Medium', 'divi-inspect-blocker' ),
					'24' => __( 'Strong', 'divi-inspect-blocker' ),
				),
				'name'    => __( 'Photo blur', 'divi-inspect-blocker' ),
				'desc'    => '',
			),
			'tone'              => array(
				'tab'     => 'design',
				'type'    => 'select',
				'default' => 'auto',
				'options' => array(
					'auto'  => __( 'Automatic', 'divi-inspect-blocker' ),
					'dark'  => __( 'Light text (for dark backgrounds)', 'divi-inspect-blocker' ),
					'light' => __( 'Dark text (for light backgrounds)', 'divi-inspect-blocker' ),
				),
				'name'    => __( 'Text colour', 'divi-inspect-blocker' ),
				'desc'    => __( 'Automatic picks whichever reads better on the background.', 'divi-inspect-blocker' ),
			),
			'card'              => array(
				'tab'     => 'design',
				'type'    => 'select',
				'default' => 'glass',
				'options' => array(
					'glass'   => __( 'Frosted glass', 'divi-inspect-blocker' ),
					'solid'   => __( 'Solid card', 'divi-inspect-blocker' ),
					'minimal' => __( 'No card', 'divi-inspect-blocker' ),
				),
				'name'    => __( 'Card style', 'divi-inspect-blocker' ),
				'desc'    => '',
			),
			'icon'              => array(
				'tab'     => 'design',
				'type'    => 'select',
				'default' => 'shield',
				'options' => array(
					'shield' => __( 'Shield', 'divi-inspect-blocker' ),
					'eye'    => __( 'Crossed-out eye', 'divi-inspect-blocker' ),
					'lock'   => __( 'Padlock', 'divi-inspect-blocker' ),
					'code'   => __( 'Code brackets', 'divi-inspect-blocker' ),
					'none'   => __( 'No icon', 'divi-inspect-blocker' ),
				),
				'name'    => __( 'Icon', 'divi-inspect-blocker' ),
				'desc'    => '',
			),
			'font'              => array(
				'tab'     => 'design',
				'type'    => 'select',
				'default' => 'modern',
				'options' => array(
					'modern'  => __( 'Modern sans-serif', 'divi-inspect-blocker' ),
					'rounded' => __( 'Rounded', 'divi-inspect-blocker' ),
					'serif'   => __( 'Elegant serif', 'divi-inspect-blocker' ),
					'mono'    => __( 'Monospace', 'divi-inspect-blocker' ),
				),
				'name'    => __( 'Font', 'divi-inspect-blocker' ),
				'desc'    => __( 'System fonts only, so nothing extra is downloaded while the site is hidden.', 'divi-inspect-blocker' ),
			),
		);

		return self::$fields;
	}

	/** @return array<string,string> */
	public static function patterns() {
		return array(
			'aurora'        => __( 'Aurora', 'divi-inspect-blocker' ),
			'radar'         => __( 'Radar sweep', 'divi-inspect-blocker' ),
			'waves'         => __( 'Waves', 'divi-inspect-blocker' ),
			'grid'          => __( 'Glowing grid', 'divi-inspect-blocker' ),
			'topography'    => __( 'Topography', 'divi-inspect-blocker' ),
			'constellation' => __( 'Constellation', 'divi-inspect-blocker' ),
			'lowpoly'       => __( 'Low poly', 'divi-inspect-blocker' ),
			'blobs'         => __( 'Liquid blobs', 'divi-inspect-blocker' ),
		);
	}

	/** True when Divi (or Extra) is providing ePanel, so there is somewhere to store settings. */
	public static function available() {
		return function_exists( 'et_get_option' );
	}

	/** The raw stored value for a key, or null when it was never saved. */
	private static function raw( $key ) {
		if ( ! self::available() ) {
			return null;
		}

		$value = et_get_option( self::PREFIX . $key );

		return false === $value ? null : $value;
	}

	/**
	 * Every setting, resolved and sanitised.
	 *
	 * @return array<string,mixed>
	 */
	public static function get() {
		$out = array();

		foreach ( self::fields() as $key => $field ) {
			$out[ $key ] = self::resolve( $field, self::raw( $key ) );
		}

		/**
		 * Filters the resolved settings before they are used.
		 *
		 * @param array $settings
		 */
		return apply_filters( 'dib_settings', $out );
	}

	/**
	 * Turn one stored value into a safe one, falling back to the default.
	 *
	 * Empty text falls back too: ePanel shows the default in an empty field, so
	 * honouring the empty value would make the page disagree with the screen.
	 *
	 * @param array $field
	 * @param mixed $raw
	 * @return mixed
	 */
	public static function resolve( array $field, $raw ) {
		$default = $field['default'];

		switch ( $field['type'] ) {
			case 'checkbox':
			case 'checkbox2':
				if ( null === $raw || '' === $raw ) {
					return 'on' === $default;
				}
				return 'on' === $raw;

			case 'select':
				$raw = is_scalar( $raw ) ? (string) $raw : '';
				if ( isset( $field['options'][ $raw ] ) ) {
					return $raw;
				}
				// Reset to Defaults stores ePanel's 'std', which for selects is
				// the label rather than the key.
				$key = array_search( $raw, $field['options'], true );
				return false !== $key ? (string) $key : $default;

			case 'number':
				if ( null === $raw || '' === $raw || ! is_numeric( $raw ) ) {
					return $default;
				}
				return max( $field['min'], min( $field['max'], (int) $raw ) );

			case 'color':
				$color = self::color( $raw );
				return '' === $color ? $default : $color;

			case 'upload':
				return is_string( $raw ) ? esc_url_raw( $raw ) : '';

			case 'textarea':
				$raw = is_string( $raw ) ? trim( $raw ) : '';
				if ( ! empty( $field['html'] ) ) {
					$raw = wp_kses( $raw, self::FOOTER_TAGS );
				} else {
					$raw = sanitize_textarea_field( $raw );
				}
				if ( '' === $raw ) {
					return empty( $field['allow_empty'] ) ? $default : '';
				}
				return $raw;

			case 'text':
			default:
				$raw = is_string( $raw ) ? sanitize_text_field( $raw ) : '';
				return '' === $raw ? $default : $raw;
		}
	}

	/**
	 * A CSS colour, or '' when it is not one this plugin accepts.
	 *
	 * Hex (with or without the #, which Divi's older colour picker drops) and
	 * rgb()/rgba(), the two formats the alpha colour picker produces.
	 *
	 * @param mixed $value
	 * @return string
	 */
	public static function color( $value ) {
		if ( ! is_string( $value ) ) {
			return '';
		}

		$value = strtolower( trim( $value ) );

		if ( preg_match( '/^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/', $value, $m ) ) {
			return '#' . $m[1];
		}

		if ( preg_match( '/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+|1\.0+)\s*)?\)$/', $value, $m ) ) {
			if ( $m[1] > 255 || $m[2] > 255 || $m[3] > 255 ) {
				return '';
			}
			return isset( $m[4] ) && '' !== $m[4]
				? sprintf( 'rgba(%d,%d,%d,%s)', $m[1], $m[2], $m[3], $m[4] )
				: sprintf( 'rgb(%d,%d,%d)', $m[1], $m[2], $m[3] );
		}

		return '';
	}

	/**
	 * Fill {site_name}, {year} and {home_url} in.
	 *
	 * @param string $text
	 * @param bool   $html Whether $text is HTML, so the values need escaping.
	 * @return string
	 */
	public static function placeholders( $text, $html = false ) {
		$name = wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES );
		$home = home_url( '/' );

		return strtr(
			$text,
			array(
				'{site_name}' => $html ? esc_html( $name ) : $name,
				'{year}'      => gmdate( 'Y' ),
				'{home_url}'  => $html ? esc_url( $home ) : $home,
			)
		);
	}
}
