<?php
/**
 * Plugin Name: Divi Inspect Blocker
 * Plugin URI:  https://divi.help/
 * Description: Hides the site while a visitor has the browser's developer tools (Inspect) open, and shows a customisable error page instead — then brings the page back by itself once they close. Settings live in Divi > Theme Options > Inspect Blocker.
 * Version:     1.0.0
 * Requires PHP: 7.4
 * Requires at least: 5.8
 * Author:      Divi.Help
 * Author URI:  https://divi.help/
 * License:     GPL-2.0-or-later
 * Text Domain: divi-inspect-blocker
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'DIB_VERSION', '1.0.0' );
define( 'DIB_FILE', __FILE__ );
define( 'DIB_DIR', plugin_dir_path( __FILE__ ) );
define( 'DIB_URL', plugin_dir_url( __FILE__ ) );

require_once DIB_DIR . 'includes/class-dib-settings.php';
require_once DIB_DIR . 'includes/class-dib-epanel.php';
require_once DIB_DIR . 'includes/class-dib-frontend.php';

DIB_Epanel::init();
DIB_Frontend::init();
