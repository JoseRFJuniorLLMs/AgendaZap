import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const probe=promisify(execFile);
export async function audioDurationMs(file){
  try{
    const {stdout}=await probe('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',file],{timeout:5000,maxBuffer:65536,windowsHide:true});
    const seconds=Number(stdout.trim());if(!Number.isFinite(seconds)||seconds<=0)throw new Error('invalid_audio');return Math.ceil(seconds*1000);
  }catch(cause){const error=new Error(cause.code==='ENOENT'?'Medição de áudio indisponível':'Arquivo de áudio inválido');error.statusCode=cause.code==='ENOENT'?503:400;throw error;}
}
