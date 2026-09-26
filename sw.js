/* オフライン動作用のサービスワーカー。ルート(/)に置き、2つのアプリ
 * （/ = 問診、/qr/ = QR変換）の両方をまとめてキャッシュする。
 *
 * ★キャッシュ名にビルド版を埋めてあることが最重要。
 *   埋めないと端末が古いページを永久に出し続ける（版ずれの最悪形）。
 *   版が変われば別キャッシュになり、activate で古いものを消す。
 */
const VERSION = '2026-09-26 b1b905b';
const CACHE = 'er-monshin-' + VERSION;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './en/',
  './en/index.html',
  './ped/',
  './ped/index.html',
  './ped/en/',
  './ped/en/index.html',
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
      // CACHE 以外は全部消す。共有の受け渡し用（SHARE_CACHE）もここで消えるが、
      // それでよい。取り出されないまま残った患者情報を端末に残さないため。
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ---- 共有から受け取る（Web Share Target）----
 * 他のアプリ（スキャンアプリ等）の「共有」先に QR変換 を出すための受け口。
 * manifest-qr.json の share_target が POST /qr/share を叩き、それをここで捕まえる。
 *
 * ★GET ではなく POST にしてある。GET だと共有された文章が URL に載り、
 *   閲覧履歴に患者情報が残る。POST ならここで受けるので URL には出ない。
 *
 * ★受け渡しに使うキャッシュは資産用とは別にし、ページ側が読んだ時点で消す。
 *   患者情報を端末に残さないため。取り出せないまま終わった分は activate でも消す。 */
const SHARE_CACHE = 'er-monshin-share';
const SHARE_KEY = '/__shared__';   // ルート配信前提（SWもページも同じ絶対パスで引ける）

async function handleShare(request, url) {
  let text = '';
  try {
    const form = await request.formData();
    // title / text / url のどれで来るかは共有元のアプリ次第なので、来たものを繋ぐ
    text = ['title', 'text', 'url'].map((k) => form.get(k)).filter(Boolean).join('\n');
  } catch (err) {
    /* 取り出せなくても画面は開く。黙って失敗させない方が現場で切り分けやすい */
  }
  const cache = await caches.open(SHARE_CACHE);
  await cache.put(SHARE_KEY, new Response(text, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  }));
  return Response.redirect(new URL('./?shared=1', url).href, 303);
}

/* cache-first。ページは通信しない作りなので、取りに行く理由が無い。 */
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname.endsWith('/qr/share')) {
    e.respondWith(handleShare(e.request, url));
    return;
  }
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
