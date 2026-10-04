// Read-only release health gate; no customer records or secrets are emitted.
const base=process.argv[2]||'http://localhost:8793/AgendaZap';
for(const path of ['/', '/api/health','/api/config','/styles.css','/app.js','/manifest.webmanifest']) {
  const response=await fetch(base+path,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`${path}: HTTP ${response.status}`);
  if(path==='/api/health') {const data=await response.json();if(data.database!=='PostgreSQL'||data.status!=='ok')throw new Error('Database unhealthy');}
  console.log(`PASS ${path}`);
}
