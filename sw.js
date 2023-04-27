const expirationHour = Number(__expirationHour__);

class MessageEntity {
  constructor(type = '', data = '') {
    this.type = type;
    this.data = data;
  }
}

function reportError(type, msg) {
  const m = new MessageEntity(type, msg);
  self.clients.matchAll().then(function (clientList) {
    clientList.forEach(client => {
      client.postMessage(m);
    });
  });
}

async function makeFetch(req) {
  return await fetch(req)
    .then(res => {
      if (!res.ok) {
        reportError('FetchError', res.statusText);
      }
      return res;
    })
    .catch(err => {
      reportError('NetWorkError', err);
    });
}

async function handleCache(req, cacheName) {
  const cachedState = await caches.match(req);
  if (cachedState) {
    console.log('资源从缓存中读取：' + req.url);
    return cachedState;
  } else {
    // 如果缓存中不存在，从后台获取资源
    const tmpRes = await makeFetch(req);
    if (tmpRes && tmpRes.ok) {
      const res = tmpRes.clone();
      saveReq(cacheName, req, res);
    }
    return tmpRes;
  }
}

async function saveReq(cacheName, req, res) {
  // 保存资源，未超出cache缓存数量，在header中保存字段，直接存入
  const cache = await caches.open(cacheName);
  const headers = new Headers(res.headers);
  headers.append('sw-date', new Date().getTime()); // 保存资源的起始时间
  const blob = await res.blob();
  const copyRes = new Response(blob, {
    status: res.status,
    statusText: res.statusText,
    headers: headers,
  });
  return cache.put(req, copyRes);
}

async function deleteExpiredResponse() {
  const cacheVersions = await caches.keys();
  for (let i = 0; i < cacheVersions.length; i++) {
    const cacheVersion = cacheVersions[i];
    const responses = [];
    const cache = await caches.open(cacheVersion);
    const requests = await cache.keys();
    requests.forEach(key => {
      responses.push(cache.match(key));
    });
    const responsesRes = await Promise.allSettled(responses);
    responsesRes.forEach((response, index) => {
      const status = response.status;
      const headers = response.value.headers;
      if (status === 'fulfilled' && headers.has('sw-date')) {
        const dateTime = new Date(Number(headers.get('sw-date'))).getTime();
        if (!isNaN(dateTime)) {
          const now = Date.now();
          const expirationSeconds = expirationHour * 60 * 60;
          if (dateTime < now - expirationSeconds * 1000) {
            // 已过期
            const request = requests[index];
            cache.delete(request);
            console.log('资源过期被移除：' + request.url);
          }
        }
      }
    });
  }
}

self.addEventListener('install', e => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('fetch', e => {
  e.respondWith(
    (async () => {
      const req = e.request;
      if (req && req.url) {
        const url = new URL(req.url);
        const searchParams = url.searchParams;
        if (searchParams.has('appType') && searchParams.get('appType') === 'sub') {
          const cacheName = searchParams.get('appName');
          return await handleCache(e.request, cacheName);
        } else {
          return await makeFetch(e.request);
        }
      }
    })()
  );
});

self.addEventListener('activate', e => {
  self.clients.claim();
  deleteExpiredResponse();
  reportError('RefreshClient', null);
});
