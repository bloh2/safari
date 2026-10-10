# Divi Inspect Blocker

Hides the site while a visitor has the browser's developer tools (Inspect) open,
and shows a customisable error page instead. When developer tools are closed, the
page reloads by itself.

Settings: **Divi > Theme Options > Inspect Blocker**. They are ordinary ePanel
fields, so Save Changes, Reset to Defaults, Portability export/import and the
Theme Options library all include them.

Requires the Divi theme (or a child theme). Without it the plugin shows an admin
notice and does nothing. PHP 7.4+.

## What it does

| | |
|---|---|
| **Detection** | Every second, times `console.table()` against `console.log()` on a large array. With DevTools attached the table takes 60–260ms; detached, under 3ms. A sample counts only if the table takes ≥ 25ms **and** ≥ 10× the faster log, and it takes two in a row. This is the same test Divi SuperApp's preview guard uses. |
| **Already open at load** | Checked once in `<head>` before the body exists. The page is replaced immediately, so the content never reaches the DOM. |
| **Wipe** | `<head>` and `<body>` are removed outright, along with the site's styles, content and attributes, and the error page is built in their place. A MutationObserver removes anything other scripts add later. |
| **Reload button** | Checks first. If DevTools are still open it says so and shakes, instead of reloading. |
| **Automatic reload** | Keeps checking after the wipe, and reloads two seconds after DevTools close. |
| **Right-click / shortcuts** | Separate switches that work with or without detection. Right-click is kept in form fields so copy and paste still work. Shortcuts: F12, Ctrl+Shift+I/J/C/K, Ctrl+U and the Mac equivalents (Cmd+Opt+I/J/C/U, Cmd+Shift+C, Cmd+U), plus Safari's Cmd+Opt+A and Cmd+Opt+Shift+T. Ctrl+Alt is left alone, because on Windows that is AltGr and is used for typing characters such as ć and €. |

### Who is checked

By default **only visitors who are not logged in**. "Never apply to" can narrow
that to administrators only, or to nobody. The exemption covers detection and both
blocks.

Never active in: wp-admin, AJAX, REST, feeds, embeds, the Customizer and Divi's
Visual Builder (`et_fb`) and previews. **Pages to leave alone** takes one path per
line; end a line with `*` to match everything under it.

### Does it work outside an iframe?

Yes. The test measures the console of the window the script runs in, and DevTools
attach per tab, so a normal page works exactly like the SuperApp preview iframe. In
SuperApp the script actually runs in the builder window, not inside the iframe; it
just wipes the iframe. Its `'tab'` previews aren't covered because they are a
separate tab with their own DevTools.

## The error page

Drawn in the browser by `assets/js/dib-page.js`, which is shared by the front end and
the Theme Options live preview, so what you see while editing is exactly what
visitors get.

- **Background:** a designed background (Aurora, Radar sweep, Waves, Glowing grid,
  Topography, Constellation, Low poly, Liquid blobs), a solid colour, a gradient, or
  an uploaded photo with overlay and blur. Designed backgrounds are generated from
  the base and accent colours: no image download, sharp at any size.
- **Wording:** tab title, badge, heading, message (one paragraph per line), button,
  and the four live status messages. Placeholders: `{site_name}`, `{year}`, and
  `{home_url}` in the footer.
- **Logo** (falls back to the Theme Options logo), **footer** (links and bold
  allowed), card style (frosted glass / solid / none), icon, font (system fonts only),
  light/dark text (automatic by default), animation, and film grain.
- Honours `prefers-reduced-motion`. Mobile-friendly. `noindex`.

Live preview: Desktop/Mobile, and Waiting / Still open / Reloading to see each status.
**Open full-screen preview** (General tab) opens the home page with `?dib_preview=1`,
which shows the error page with the saved settings to users who can edit theme
options.

## Limits — a deterrent, not protection

The HTML has already reached the browser before any of this runs. View-source, the
Network panel, a proxy, `curl`, or turning JavaScript off all still show it. This
stops casual inspection only.

- Tested in Chrome 154, Edge 154 and Firefox 157 (desktop): blocked with DevTools
  open, no false positives with them closed.
- Safari: tested on WebKit (WebKitGTK 2.52 with its Web Inspector, the same engine
  and inspector frontend Safari uses), not on Safari itself. With the inspector
  attached, `console.table()` took 42–180ms; detached, 0ms. Docked and undocked
  inspector, already open at load, Reload button and automatic reload all behave
  as above. Safari users can still open the inspector from the Develop menu; the
  page is then hidden in the same way.
- Undocked DevTools in a separate window are detected the same way.
- Clears the console once per check while a guarded page is open.

## Filters

```php
add_filter( 'dib_should_guard', '__return_false' );        // skip a request
add_filter( 'dib_settings', function ( $s ) { return $s; } ); // adjust resolved settings
```

## Files

| File | |
|---|---|
| `includes/class-dib-settings.php` | Field definitions, defaults, sanitising (`DIB_Settings::get()`) |
| `includes/class-dib-epanel.php` | The Theme Options tab, through `et_epanel_tab_names` / `et_epanel_layout_data` |
| `includes/class-dib-frontend.php` | Who is guarded; loads the scripts in `<head>` with optimiser opt-outs |
| `assets/js/inspect-blocker.js` | Detection, wipe, reload, right-click and shortcut blocks |
| `assets/js/dib-page.js` | The error page and its backgrounds |
| `assets/js/admin.js` | Colour pickers, design picker, conditional fields, live preview |
| `uninstall.php` | Removes only the `dib_` keys from the theme's option row |

Settings are stored in Divi's one-row option (`et_divi`) under `dib_*` keys.
