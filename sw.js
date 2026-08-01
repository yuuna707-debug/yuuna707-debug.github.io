/* オフライン動作用のサービスワーカー。ルート(/)に置き、2つのアプリ
 * （/ = 問診、/qr/ = QR変換）の両方をまとめてキャッシュする。
 *
 * ★キャッシュ名にビルド版を埋めてあることが最重要。
 *   埋めないと端末が古いページを永久に出し続ける（版ずれの最悪形）。
 *   版が変われば別キャッシュになり、activate で古いものを消す。
 */
const VERSION = '2026-08-01 3b43c21';
const CACHE = 'er-monshin-' + VERSION;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './qr/',
  './qr/index.html',
  './qr/manifest.json',
  './icons/monshin-192.png',
  './icons/monshin-512.png',
  './icons/qr-192.png',
  './icons/qr-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting(); // 更新をすぐ反映する。古い版で診療されるのを避ける。
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* cache-first。ページは通信しない作りなので、取りに行く理由が無い。 */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
