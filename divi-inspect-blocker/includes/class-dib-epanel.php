<?php
/**
 * The "Inspect Blocker" tab in Divi > Theme Options.
 *
 * Built from ePanel's own field types through its two filters, so Save Changes,
 * Reset to Defaults, Portability export/import and the Theme Options library
 * all include these settings with no extra code. admin.js then layers on what
 * ePanel has no field type for: colour pickers, the design picker, show/hide
 * by background type, and the live preview.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class DIB_Epanel {

	const TAB = 'dib';

	public static function init() {
		add_filter( 'et_epanel_tab_names', array( __CLASS__, 'tab_names' ) );
		add_filter( 'et_epanel_layout_data', array( __CLASS__, 'layout_data' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
		add_action( 'admin_notices', array( __CLASS__, 'missing_theme_notice' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( DIB_FILE ), array( __CLASS__, 'action_links' ) );
	}

	/** The Theme Options page slug for the active theme: et_divi_options, et_extra_options… */
	private static function page_slug() {
		$short = isset( $GLOBALS['shortname'] ) && is_string( $GLOBALS['shortname'] ) ? $GLOBALS['shortname'] : 'divi';
		return 'et_' . $short . '_options';
	}

	public static function settings_url() {
		return admin_url( 'admin.php?page=' . self::page_slug() . '#wrap-' . self::TAB );
	}

	/** The front page, opened with the error page showing — saved settings, admins only. */
	public static function fullscreen_preview_url() {
		return add_query_arg( 'dib_preview', '1', home_url( '/' ) );
	}

	/**
	 * @param string[] $tabs
	 * @return string[]
	 */
	public static function tab_names( $tabs ) {
		$label = __( 'Inspect Blocker', 'divi-inspect-blocker' );
		$out   = array();

		// Before Updates, the way a feature tab sits among Divi's own.
		foreach ( $tabs as $slug => $name ) {
			if ( 'updates' === $slug ) {
				$out[ self::TAB ] = $label;
			}
			$out[ $slug ] = $name;
		}

		if ( ! isset( $out[ self::TAB ] ) ) {
			$out[ self::TAB ] = $label;
		}

		return $out;
	}

	/**
	 * Append the tab's fields to ePanel's options array.
	 *
	 * Runs both when the page is drawn and when it is saved, which is what lets
	 * ePanel save these fields.
	 *
	 * @param array $options
	 * @return array
	 */
	public static function layout_data( $options ) {
		if ( ! is_array( $options ) ) {
			$options = array();
		}

		$subtabs = array(
			'general'  => __( 'General', 'divi-inspect-blocker' ),
			'content'  => __( 'Wording', 'divi-inspect-blocker' ),
			'branding' => __( 'Logo & Footer', 'divi-inspect-blocker' ),
			'design'   => __( 'Design', 'divi-inspect-blocker' ),
		);

		$options[] = array(
			'name' => 'wrap-' . self::TAB,
			'type' => 'contenttab-wrapstart',
		);
		$options[] = array( 'type' => 'subnavtab-start' );
		foreach ( $subtabs as $slug => $label ) {
			$options[] = array(
				'name' => self::TAB . '-' . $slug,
				'type' => 'subnav-tab',
				'desc' => $label,
			);
		}
		$options[] = array( 'type' => 'subnavtab-end' );

		$fields = DIB_Settings::fields();

		foreach ( array_keys( $subtabs ) as $slug ) {
			$options[] = array(
				'name' => self::TAB . '-' . $slug,
				'type' => 'subcontent-start',
			);

			if ( 'general' === $slug ) {
				$options[] = array(
					'name'          => __( 'See it in action', 'divi-inspect-blocker' ),
					'type'          => 'callback_function',
					'function_name' => array( __CLASS__, 'render_tools' ),
					'desc'          => __( 'Opens your home page with the error page showing, using the saved settings. Only you see it.', 'divi-inspect-blocker' ),
				);
			} else {
				$options[] = array(
					'name'          => __( 'Live preview', 'divi-inspect-blocker' ),
					'type'          => 'callback_function',
					'function_name' => array( __CLASS__, 'render_preview' ),
					'desc'          => __( 'Follows your changes as you make them. Click Save Changes to put them live.', 'divi-inspect-blocker' ),
				);
			}

			foreach ( $fields as $key => $field ) {
				if ( $field['tab'] === $slug ) {
					$options[] = self::epanel_field( $key, $field );
				}
			}

			$options[] = array(
				'name' => self::TAB . '-' . $slug,
				'type' => 'subcontent-end',
			);
		}

		$options[] = array(
			'name' => 'wrap-' . self::TAB,
			'type' => 'contenttab-wrapend',
		);

		return $options;
	}

	/** One of our field definitions as an ePanel field. */
	private static function epanel_field( $key, array $field ) {
		$out = array(
			'name' => $field['name'],
			'id'   => DIB_Settings::PREFIX . $key,
			'desc' => $field['desc'],
		);

		switch ( $field['type'] ) {
			case 'checkbox':
			case 'checkbox2':
				$out['type'] = $field['type'];
				$out['std']  = $field['default'];
				break;

			case 'select':
				$out['type']           = 'select';
				$out['options']        = $field['options'];
				$out['et_save_values'] = true;
				// ePanel pre-selects the option whose LABEL equals std.
				$out['std'] = $field['options'][ $field['default'] ];
				break;

			case 'number':
				$out['type']            = 'text';
				$out['std']             = (string) $field['default'];
				$out['validation_type'] = 'number';
				break;

			case 'color':
				// A plain text field that admin.js turns into the alpha colour
				// picker ePanel already loads; ePanel's own 'colorpopup' drops
				// the # and has no alpha.
				$out['type']            = 'text';
				$out['std']             = $field['default'];
				$out['validation_type'] = 'nohtml';
				break;

			case 'upload':
				$out['type']        = 'upload';
				$out['button_text'] = __( 'Use this image', 'divi-inspect-blocker' );
				break;

			case 'textarea':
				$out['type'] = 'textarea';
				$out['std']  = $field['default'];
				if ( empty( $field['html'] ) ) {
					$out['validation_type'] = 'nohtml';
				}
				break;

			case 'text':
			default:
				$out['type']            = 'text';
				$out['std']             = $field['default'];
				$out['validation_type'] = 'nohtml';
				break;
		}

		return $out;
	}

	public static function render_preview() {
		?>
		<div class="dib-preview" data-dib-preview>
			<div class="dib-preview__bar">
				<span class="dib-preview__dots" aria-hidden="true"><i></i><i></i><i></i></span>
				<span class="dib-preview__url"><?php echo esc_html( preg_replace( '#^https?://#', '', home_url( '/' ) ) ); ?></span>
				<span class="dib-preview__views" role="group" aria-label="<?php esc_attr_e( 'Preview size', 'divi-inspect-blocker' ); ?>">
					<button type="button" class="is-active" data-dib-view="desktop"><?php esc_html_e( 'Desktop', 'divi-inspect-blocker' ); ?></button>
					<button type="button" data-dib-view="mobile"><?php esc_html_e( 'Mobile', 'divi-inspect-blocker' ); ?></button>
				</span>
				<span class="dib-preview__states" role="group" aria-label="<?php esc_attr_e( 'Status shown', 'divi-inspect-blocker' ); ?>">
					<button type="button" class="is-active" data-dib-state="open"><?php esc_html_e( 'Waiting', 'divi-inspect-blocker' ); ?></button>
					<button type="button" data-dib-state="still"><?php esc_html_e( 'Still open', 'divi-inspect-blocker' ); ?></button>
					<button type="button" data-dib-state="closed"><?php esc_html_e( 'Reloading', 'divi-inspect-blocker' ); ?></button>
				</span>
			</div>
			<div class="dib-preview__stage"></div>
		</div>
		<?php
	}

	public static function render_tools() {
		?>
		<div class="dib-tools">
			<a class="dib-tools__btn" href="<?php echo esc_url( self::fullscreen_preview_url() ); ?>" target="_blank" rel="noopener">
				<?php esc_html_e( 'Open full-screen preview', 'divi-inspect-blocker' ); ?>
				<span aria-hidden="true">↗</span>
			</a>
			<p class="dib-tools__note">
				<?php esc_html_e( 'Save Changes first — the full-screen preview uses saved settings. To test the real detection, open the site in a private window (or while logged out) and press F12.', 'divi-inspect-blocker' ); ?>
			</p>
		</div>
		<?php
	}

	public static function enqueue( $hook ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only page check.
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';

		if ( self::page_slug() !== $page ) {
			return;
		}

		wp_enqueue_style( 'wp-color-picker' );
		wp_enqueue_style( 'dib-admin', DIB_URL . 'assets/css/admin.css', array(), DIB_VERSION );

		wp_enqueue_script( 'dib-page', DIB_URL . 'assets/js/dib-page.js', array(), DIB_VERSION, true );
		wp_enqueue_script( 'dib-admin', DIB_URL . 'assets/js/admin.js', array( 'jquery', 'wp-color-picker', 'dib-page' ), DIB_VERSION, true );

		$ids = array();
		foreach ( DIB_Settings::fields() as $key => $field ) {
			$ids[ $key ] = array(
				'id'      => DIB_Settings::PREFIX . $key,
				'type'    => $field['type'],
				'default' => $field['default'],
			);
		}

		wp_localize_script(
			'dib-admin',
			'dibAdmin',
			array(
				'fields'    => $ids,
				'patterns'  => DIB_Settings::patterns(),
				'siteName'  => wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ),
				'homeUrl'   => home_url( '/' ),
				'year'      => gmdate( 'Y' ),
				'themeLogo' => DIB_Frontend::theme_logo(),
				'i18n'      => array(
					'designs' => __( 'Pick a design', 'divi-inspect-blocker' ),
				),
			)
		);
	}

	public static function missing_theme_notice() {
		if ( DIB_Settings::available() || ! current_user_can( 'activate_plugins' ) ) {
			return;
		}

		printf(
			'<div class="notice notice-warning"><p>%s</p></div>',
			esc_html__( 'Divi Inspect Blocker needs the Divi theme (or a Divi child theme): its settings live in Divi > Theme Options, and it stays switched off until they are available.', 'divi-inspect-blocker' )
		);
	}

	/**
	 * @param string[] $links
	 * @return string[]
	 */
	public static function action_links( $links ) {
		if ( DIB_Settings::available() ) {
			array_unshift(
				$links,
				sprintf( '<a href="%s">%s</a>', esc_url( self::settings_url() ), esc_html__( 'Settings', 'divi-inspect-blocker' ) )
			);
		}
		return $links;
	}
}
