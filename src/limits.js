export function boundedRate(map,key,{limit,window=60000,capacity=10000},now=Date.now()){
  let entry=map.get(key);
  if(!entry||now-entry.since>=window){entry={since:now,count:0};if(!map.has(key)&&map.size>=capacity)map.delete(map.keys().next().value);map.set(key,entry);}
  return ++entry.count<=limit;
}
export function validUnicode(value){
  const pending=[value];
  while(pending.length){const item=pending.pop();if(typeof item==='string'){if(item.includes('\0')||!item.isWellFormed())return false;}else if(item&&typeof item==='object')for(const [key,value]of Object.entries(item))pending.push(key,value);}
  return true;
}
