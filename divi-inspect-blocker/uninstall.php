<?php
/**
 * Remove this plugin's settings from the theme's option row.
 *
 * They live inside Divi's (or Extra's) one-row ePanel option, so only our own
 * `dib_` keys are taken out and everything else is left exactly as it was.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

foreach ( array( 'et_divi', 'et_extra' ) as $dib_option ) {
	$dib_values = get_option( $dib_option );

	if ( ! is_array( $dib_values ) ) {
		continue;
	}

	$dib_changed = false;
	foreach ( array_keys( $dib_values ) as $dib_key ) {
		if ( 0 === strpos( (string) $dib_key, 'dib_' ) ) {
			unset( $dib_values[ $dib_key ] );
			$dib_changed = true;
		}
	}

	if ( $dib_changed ) {
		update_option( $dib_option, $dib_values );
	}
}
