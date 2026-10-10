// Fires keydown events shaped like the ones each browser really sends, returns which got blocked.
(function(){
 var cases=[
  // [label, expectBlocked, code, key, keyCode, meta, alt, shift, ctrl]
  ['Safari ⌥⌘I Web Inspector',1,'KeyI','ˆ',73,1,1,0,0],
  ['Safari ⌥⌘C JS Console',1,'KeyC','ç',67,1,1,0,0],
  ['Safari ⌥⌘U Page Source',1,'KeyU','¨',85,1,1,0,0],
  ['Safari ⌥⌘A Page Resources',1,'KeyA','å',65,1,1,0,0],
  ['Safari ⇧⌘C Element Selection',1,'KeyC','c',67,1,0,1,0],
  ['Safari ⌥⇧⌘T Timeline Recording',1,'KeyT','ˇ',84,1,1,1,0],
  ['Safari 10.0 ⌥⌘I (no e.code)',1,'','ˆ',73,1,1,0,0],
  ['Chrome Mac ⌥⌘J Console',1,'KeyJ','∆',74,1,1,0,0],
  ['Firefox Mac ⌘U Source',1,'KeyU','u',85,1,0,0,0],
  ['Win F12',1,'F12','F12',123,0,0,0,0],
  ['Win Ctrl+Shift+I',1,'KeyI','I',73,0,0,1,1],
  ['Win Ctrl+Shift+J',1,'KeyJ','J',74,0,0,1,1],
  ['Win Ctrl+Shift+C',1,'KeyC','C',67,0,0,1,1],
  ['Firefox Ctrl+Shift+K',1,'KeyK','K',75,0,0,1,1],
  ['Win Ctrl+U',1,'KeyU','u',85,0,0,0,1],
  ['Mac ⌘C copy',0,'KeyC','c',67,1,0,0,0],
  ['Mac ⌘A select all',0,'KeyA','a',65,1,0,0,0],
  ['Mac ⌘I italic',0,'KeyI','i',73,1,0,0,0],
  ['Mac ⇧⌘T reopen tab',0,'KeyT','t',84,1,0,1,0],
  ['Mac ⌥A types å',0,'KeyA','å',65,0,1,0,0],
  ['Win AltGr+C types ć (Polish)',0,'KeyC','ć',67,0,1,0,1],
  ['Win AltGr+J (some layouts)',0,'KeyJ','j',74,0,1,0,1],
  ['Win AltGr+U types € (Polish)',0,'KeyU','€',85,0,1,0,1],
  ['Mac ⌥⌘ old Safari ⌥⌘A (no e.code)',1,'','å',65,1,1,0,0],
  ['Linux Ctrl+Shift+U unicode',0,'KeyU','U',85,0,0,1,1],
 ];
 return cases.map(function(c){
  var e=new KeyboardEvent('keydown',{code:c[2],key:c[3],metaKey:!!c[5],altKey:!!c[6],shiftKey:!!c[7],ctrlKey:!!c[8],bubbles:true,cancelable:true});
  Object.defineProperty(e,'keyCode',{get:function(){return c[4];}});
  document.body.dispatchEvent(e);
  return (e.defaultPrevented==!!c[1]?'ok  ':'FAIL')+' '+(e.defaultPrevented?'blocked':'allowed')+'  '+c[0];
 }).join('\n');
})()
