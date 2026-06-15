/*
 * Service Worker - 离线支持
 * 让 App 在无网络时也能打开
 */
const CACHE_NAME = 'basketball-trainer-v6.0';
const FILES_TO_CACHE = [
  '/',
  'index.html',
  'styles.css',
  'app.js',
  'curriculum-data.js',
  'manifest.json'
];

// 安装：缓存所有文件
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
          .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// 请求：缓存优先，网络回退
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(response) {
      return response || fetch(event.request).then(function(res) {
        // 缓存新的请求
        if (res.status === 200) {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return res;
      });
    }).catch(function() {
      // 完全离线且未缓存时返回首页
      if (event.request.mode === 'navigate') {
        return caches.match('index.html');
      }
    })
  );
});
