#!/usr/bin/env python3
"""Exercise deployment failure boundaries in temporary files with fake services.

Linux-only; no live service, container, database, or network access is used.
"""
import json
import os
import subprocess
import tempfile
from pathlib import Path

DISPATCH = r'''#!/usr/bin/env python3
import json,os,subprocess,sys
from pathlib import Path
root=Path(os.environ['TEST_ROOT']);name=Path(sys.argv[0]).name;args=sys.argv[1:];phase=os.environ['TEST_PHASE']
with (root/'calls').open('a') as f:f.write(name+' '+repr(args)+'\n')
if name=='sudo':sys.exit(subprocess.call(args[2:] if args[:1]==['-u'] else args))
if name=='git':
 if 'rev-parse' in args:print('new-sha')
 elif 'archive' in args:sys.exit(subprocess.call(['/bin/tar','-cf','-','-C',str(root/'fixture'),'.']))
 sys.exit(0)
if name=='npm':sys.exit(1 if phase=='tests' and args==['test'] else 0)
if name=='chown' or name=='systemctl' or name=='sleep':sys.exit(0)
if name=='nginx':
 marker=root/'nginx-failed'
 if phase=='nginx' and not marker.exists():marker.touch();sys.exit(1)
 sys.exit(0)
if name=='curl':
 if any('8795' in x for x in args):print('{"ok":true}');sys.exit(0)
 text=(root/'etc/agendazap.env').read_text()
 if phase=='health' and 'APP_REVISION=new-sha' in text:sys.exit(1)
 print('{"status":"ok","ok":true,"revision":"'+('new-sha' if 'APP_REVISION=new-sha' in text else 'old-sha')+'"}');sys.exit(0)
if name=='docker':
 file=root/'containers.json';state=json.loads(file.read_text());op=args[0]
 if op=='build' and phase=='build':sys.exit(1)
 if op=='rename':state[args[2]]=state.pop(args[1])
 if op=='rm':
  for n in args[1:]:state.pop(n,None)
 if op=='stop':state[args[1]]['running']=False
 if op=='start':state[args[1]]['running']=True
 if op=='run':
  n=args[args.index('--name')+1]
  if phase=='voice' and n=='agendazap-voice':sys.exit(1)
  state[n]={'running':True,'image':'new-image'}
 file.write_text(json.dumps(state));sys.exit(0)
raise SystemExit('Unknown mock command '+name)
'''

source = Path(__file__).with_name('agendazap-auto-deploy.sh').read_text()
helper = Path(__file__).with_name('configure-voice-proxy.py').read_text()
for phase in ['tests','build','nginx','voice','health','success']:
    with tempfile.TemporaryDirectory(prefix='agendazap-deploy-test-') as directory:
        root=Path(directory)
        app=root/'home/web2a/AgendaZap';stage=root/'fixture';state=root/'var/lib/agendazap-deploy'
        for folder in [app/'.git',app/'data',app/'node_modules',stage/'deploy',stage/'node_modules',root/'bin',root/'etc/nginx/snippets',root/'etc/systemd/system',state,root/'var/lock']:
            folder.mkdir(parents=True,exist_ok=True)
        (app/'code.txt').write_text('old-code');(app/'data/preserve.txt').write_text('durable');(app/'node_modules/dependency').write_text('old-deps')
        (stage/'code.txt').write_text('new-code');(stage/'new-file.txt').write_text('new');(stage/'node_modules/dependency').write_text('new-deps')
        (stage/'deploy/agendazap.service').write_text('new-unit');(stage/'deploy/nginx-agendazap.conf').write_text('new-nginx')
        translated_helper=helper.replace('/etc/',str(root)+'/etc/')
        (stage/'deploy/configure-voice-proxy.py').write_text(translated_helper)
        original_configs={'etc/agendazap.env':'APP_REVISION=old-sha\nDATABASE_URL=keep-this\n','etc/agendazap-voice.env':'GEMINI_LIVE_MODEL=preserve-model\nVOICE_SHARED_SECRET=\n','etc/nginx/snippets/nginx-agendazap.conf':'old-nginx','etc/systemd/system/agendazap.service':'old-unit'}
        for name,value in original_configs.items():(root/name).write_text(value)
        (state/'deployed-sha').write_text('old-sha\n');(root/'containers.json').write_text(json.dumps({'agendazap-voice':{'running':True,'image':'old-image'}}))
        for name in ['sudo','git','npm','chown','systemctl','nginx','curl','docker','sleep']:
            executable=root/'bin'/name;executable.write_text(DISPATCH);executable.chmod(0o755)
        script=source
        for prefix in ['/home/web2a','/var/lib','/var/lock','/etc']:
            script=script.replace(prefix,str(root)+prefix)
        target=root/'deploy.sh';target.write_text(script)
        env={**os.environ,'PATH':str(root/'bin')+':'+os.environ['PATH'],'TEST_ROOT':str(root),'TEST_PHASE':phase}
        result=subprocess.run(['bash',str(target)],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=30)
        if phase=='success':
            assert result.returncode==0,result.stdout
            assert (state/'deployed-sha').read_text().strip()=='new-sha'
            assert (app/'code.txt').read_text()=='new-code'
            assert json.loads((root/'containers.json').read_text())['agendazap-voice']['image']=='new-image'
        else:
            assert result.returncode!=0,result.stdout
            assert (state/'deployed-sha').read_text().strip()=='old-sha'
            assert (state/'failed-sha').read_text().strip()=='new-sha'
            assert (app/'code.txt').read_text()=='old-code',result.stdout
            assert (app/'node_modules/dependency').read_text()=='old-deps',result.stdout
            assert not (app/'new-file.txt').exists(),result.stdout
            for name,value in original_configs.items():assert (root/name).read_text()==value,(name,result.stdout)
            assert not (root/'etc/nginx/snippets/agendazap-voice-secret.conf').exists()
            assert json.loads((root/'containers.json').read_text())=={'agendazap-voice':{'running':True,'image':'old-image'}},result.stdout
            previous=(root/'calls').read_text().count('npm ')
            retry=subprocess.run(['bash',str(target)],env=env,capture_output=True,text=True,timeout=30)
            assert retry.returncode==0,retry.stdout+retry.stderr
            assert (root/'calls').read_text().count('npm ')==previous
        assert (app/'data/preserve.txt').read_text()=='durable'
        print('PASS deploy phase '+phase)
