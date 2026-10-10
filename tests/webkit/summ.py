import sys,json,re
last=None
for l in sys.stdin:
    m=re.match(r'\[\s*([\d.]+)s\] (\{.*\})$',l.strip())
    if m:
        d=json.loads(m.group(2)); k='content=%s error_page=%s body_script_runs=%s'%(d['secret'],d['state'],d['bodyRuns'])
        if k!=last: print('  %5ss %s'%(m.group(1),k)); last=k
    elif re.search(r'INSPECTOR|RELOAD|\] JS |load started',l): print('  '+l.strip()); last=None
