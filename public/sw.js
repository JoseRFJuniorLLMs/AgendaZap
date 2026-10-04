const CACHE='agendazap-shell-v1';
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['./icon.svg','./styles.css']))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method==='GET'&&url.origin===location.origin&&['/icon.svg','/styles.css'].some(path=>url.pathname.endsWith(path)))event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));});
