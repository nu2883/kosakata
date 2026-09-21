const CACHE_NAME = 'kuiskosakata-v2';
const SCOPE = '/kosakata/';

const PRECACHE_URLS = [
  '/kosakata/',
  '/kosakata/index.html',
  '/kosakata/kuisKosakata.html',
  '/kosakata/manifest-kuis.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return Promise.all(
          PRECACHE_URLS.map(url => 
            cache.add(url).catch(err => console.warn('Gagal precache:', url, err))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

function isHtmlRequest(event, url) {
  return (
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname === SCOPE
  );
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.hostname.includes('script.google.com')) {
    event.respondWith(
      fetch(event.request)
        .catch(() =>
          new Response(
            JSON.stringify({
              error: 'Offline: tidak dapat terhubung ke server.'
            }),
            {
              headers: {
                'Content-Type': 'application/json'
              }
            }
          )
        )
    );
    return;
  }

  if (
    url.pathname.startsWith(SCOPE) &&
    isHtmlRequest(event, url)
  ) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME)
              .then(cache =>
                cache.put(event.request, response.clone())
              );
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  if (url.pathname.startsWith(SCOPE)) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          if (cached) return cached;
          return fetch(event.request)
            .then(response => {
              if (
                response &&
                response.status === 200 &&
                response.type === 'basic'
              ) {
                caches.open(CACHE_NAME)
                  .then(cache =>
                    cache.put(event.request, response.clone())
                  );
              }
              return response;
            });
        })
    );
    return;
  }

  event.respondWith(fetch(event.request));
});
