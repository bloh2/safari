<?php
define('ABSPATH', '/');
function __($s){return $s;} function esc_html__($s){return $s;}
function et_get_option($k,$d=false){return $d;}
function apply_filters($n,$v){return $v;}
foreach(['sanitize_text_field','sanitize_textarea_field','esc_url_raw','wp_kses_post','sanitize_hex_color','wp_kses','sanitize_key','esc_attr','wp_strip_all_tags'] as $f){ if(!function_exists($f)) eval("function $f(\$v){return \$v;}"); }
function absint($v){return abs((int)$v);}
require $argv[1].'/includes/class-dib-settings.php';
$s = DIB_Settings::get(); unset($s['exempt'],$s['exclude']);
$s['block_contextmenu']=true; $s['block_shortcuts']=true; // Test both blocks too.
echo json_encode(['mode'=>'guard','detect'=>true,'settings'=>$s,'vars'=>['site_name'=>'Test Site','year'=>'2026','home_url'=>'/'],'lang'=>'en-US','rtl'=>false], JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT);
