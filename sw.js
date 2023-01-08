// 本地chrome调试
// /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --user-data-dir=/tmp/foo --ignore-certificate-errors --unsafely-treat-insecure-origin-as-secure=https://emonitor.local.elenet.me:3000/

const chacheName = __chacheName__; // 更新缓存只需要修改 chacheName 版本号即可
const expirationHour = Number(__expirationHour__);

class MessageEntity {
  constructor(type = "", data = "") {
    this.type = type;
    this.data = data;
  }
}

function reportError(type, msg) {
  const m = new MessageEntity(type, msg);
  self.clients.matchAll().then(function (clientList) {
    clientList.forEach((client) => {
      client.postMessage(m);
    });
  });
}

async function makeFetch(req) {
  return await fetch(req)
    .then((res) => {
      if (!res.ok) {
        reportError("FetchError", res.statusText);
      }
      return res;
    })
    .catch((err) => {
      reportError("NetWorkError", err);
    });
}

async function handleCache (req, cacheName) {
  const cachedState = await caches.match(req);
  if(cachedState) {
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
  headers.append("sw-date", new Date().getTime()); // 保存资源的起始时间
  const blob = await res.blob();
  const copyRes = new Response(blob, {
    status: res.status,
    statusText: res.statusText,
    headers: headers,
  });
  return cache.put(req, copyRes);
}

async function deleteExpiredResponse(cacheName) {
  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  const responses = [];
  requests.forEach(key => {responses.push(cache.match(key))})
  const responsesRes = await Promise.allSettled(responses);

  responsesRes.forEach((response, index) => {
    const status = response.status;
    const headers = response.value.headers;
    if (status === 'fulfilled' && headers.has("sw-date")) {
      const dateTime = new Date(Number(headers.get("sw-date"))).getTime();
      if (!isNaN(dateTime)) {
        const now = Date.now();
        const expirationSeconds = expirationHour * 60 * 60;
        if (dateTime < now - expirationSeconds * 1000) {
          // 已过期
          const request = requests[index];
          cache.delete(request);
          console.log("过期了", request);
        }
      }
    }
  })
}

self.addEventListener("fetch", (e) => {
  e.respondWith(
    (async () => {
      const res = await makeFetch(e.request);
      if(res && res.url)  {
        const url = new URL(res.url);
        const searchParams = url.searchParams;
        if(searchParams.has('appType') && searchParams.get('appType') === 'sub') {
          const cacheName = searchParams.get('appName');
          await deleteExpiredResponse(cacheName);
          await handleCache(e.request, cacheName);
        }
      }
      return res;
    })()
  );
});

self.addEventListener("activate", (e) => {
  self.clients.claim();
  e.waitUntil(
    (async () => {
      const keyList = await caches.keys();
      await Promise.all(
        keyList.map((key) => {
          const exist = key === chacheName;
          if (exist) {
            caches.delete(key);
          }
        })
      );
      reportError("RefreshClient", null);
    })()
  );
});
