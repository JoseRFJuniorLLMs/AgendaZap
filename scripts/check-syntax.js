import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
for(const dir of ['src','public','voice-service/src','ui-test'])for(const name of readdirSync(dir))if(name.endsWith('.js')){
  const result=spawnSync(process.execPath,['--check',join(dir,name)],{stdio:'inherit',windowsHide:true});if(result.status!==0)process.exit(result.status||1);
}
