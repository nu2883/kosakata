const CACHE_NAME = 'kuiskosakata-v1';
const SCOPE = '/kosakata/';

const PRECACHE_URLS = [
  '/kosakata/',
  '/kosakata/index.html',
  '/kosakata/kuisKosakata.html',
  '/kosakata/manifest.json',

  'https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&display=swap',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
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

  // GAS API
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

  // Google Fonts
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          const network = fetch(event.request)
            .then(response => {
              if (response && response.status === 200) {
                cache.put(event.request, response.clone());
              }
              return response;
            })
            .catch(() => cached);

          return cached || network;
        })
      )
    );
    return;
  }

  // HTML → Network First
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

  // Asset lain → Cache First
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

self.addEventListener('message', event => {
  if (
    event.data &&
    event.data.type === 'SKIP_WAITING'
  ) {
    self.skipWaiting();
  }
});
