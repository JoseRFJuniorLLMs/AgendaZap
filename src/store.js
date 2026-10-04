import pg from 'pg';
const emptyState=()=>({tenants:{},accounts:{},sessions:{},receipts:{}});
// One database session owns the projection during the relational transition.
export class Store {
  constructor({connectionString=process.env.DATABASE_URL,schema=process.env.DATABASE_SCHEMA||'agendazap'}={}) {
    if(!connectionString)throw new Error('DATABASE_URL is required');
    if(!/^agendazap(?:_[a-z0-9_]{1,48})?$/.test(schema))throw new Error('Invalid AgendaZap schema');
    this.schema=schema;this.client=new pg.Client({connectionString,connectionTimeoutMillis:15000,query_timeout:15000});
    this.client.on('error',()=>{this.healthy=false;});this.state=emptyState();this.tail=Promise.resolve();this.healthy=false;
  }
  async init(){
    try{
      await this.client.connect();
      const lock=await this.client.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired',[`AgendaZap:${this.schema}`]);
      if(!lock.rows[0].acquired)throw new Error('AgendaZap writer already running');
      await this.client.query('BEGIN');
      await this.client.query(`CREATE SCHEMA IF NOT EXISTS "${this.schema}"`);
      await this.client.query(`CREATE TABLE IF NOT EXISTS "${this.schema}".state(id smallint PRIMARY KEY CHECK(id=1),revision bigint NOT NULL DEFAULT 0,payload jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now())`);
      await this.client.query(`CREATE TABLE IF NOT EXISTS "${this.schema}".commits(revision bigint PRIMARY KEY,actor text NOT NULL,committed_at timestamptz NOT NULL DEFAULT now())`);
      await this.client.query(`INSERT INTO "${this.schema}".state(id,payload) VALUES(1,$1::jsonb) ON CONFLICT(id) DO NOTHING`,[JSON.stringify(emptyState())]);
      const result=await this.client.query(`SELECT payload FROM "${this.schema}".state WHERE id=1`);
      await this.client.query('COMMIT');this.state=result.rows[0].payload;this.healthy=true;
    }catch(error){await this.client.query('ROLLBACK').catch(()=>{});await this.close();throw error;}
  }
  async probe(){if(!this.healthy)throw new Error('Persistence unavailable');await this.client.query('SELECT 1');}
  transaction(actor,operation){
    const run=this.tail.then(async()=>{
      if(!this.healthy)throw new Error('Persistence unavailable; restart required');
      const next=structuredClone(this.state);
      const result=await operation(next);
      if(JSON.stringify(next)===JSON.stringify(this.state))return result;
      try{
        await this.client.query('BEGIN');
        const row=await this.client.query(`SELECT revision FROM "${this.schema}".state WHERE id=1 FOR UPDATE`);
        const revision=(BigInt(row.rows[0].revision)+1n).toString();
        await this.client.query(`UPDATE "${this.schema}".state SET payload=$1::jsonb,revision=$2,updated_at=now() WHERE id=1`,[JSON.stringify(next),revision]);
        await this.client.query(`INSERT INTO "${this.schema}".commits(revision,actor) VALUES($1,$2)`,[revision,actor]);
        await this.client.query('COMMIT');this.state=next;return result;
      }catch(error){
        // A lost COMMIT response is ambiguous; reload before any further write.
        this.healthy=false;await this.client.query('ROLLBACK').catch(()=>{});throw error;
      }
    });this.tail=run.catch(()=>{});return run;
  }
  async close(){this.healthy=false;await this.client.end().catch(()=>{});}
}
export class MemoryStore {
  constructor(){this.state=emptyState();this.tail=Promise.resolve();this.healthy=true;}
  async init(){}
  transaction(actor,fn){const run=this.tail.then(async()=>{const next=structuredClone(this.state);const result=await fn(next);this.state=next;return result;});this.tail=run.catch(()=>{});return run;}
  close(){}
}
