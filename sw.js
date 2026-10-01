/* オフライン動作用のサービスワーカー。ルート(/)に置き、2つのアプリ
 * （/ = 問診、/qr/ = QR変換）の両方をまとめてキャッシュする。
 *
 * ★キャッシュ名にビルド版を埋めてあることが最重要。
 *   埋めないと端末が古いページを永久に出し続ける（版ずれの最悪形）。
 *   版が変われば別キャッシュになり、activate で古いものを消す。
 */
const VERSION = '2026-10-01 728e0a2';
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
  // ★cache:'reload' で HTTP キャッシュを飛ばして取りに行く。
  //   付けないと GitHub Pages の max-age=600 が効き、直前に開いた旧版の HTML を
  //   新しい版の名前でキャッシュしてしまう（次の版まで旧版に固定される。2026-09-30 実機で確認）。
  e.waitUntil(caches.open(CACHE).then((c) =>
    c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
  self.skipWaiting(); // 更新をすぐ反映する。古い版で診療されるのを避ける。
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      // CACHE 以外は全部消す。旧版（〜f5b4079）が共有の受け渡しに使っていた
      // 'er-monshin-share' に取り出されないまま残った患者情報も、ここで消える。
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
 * ★受け取った文章はストレージ（Cache Storage 等）に書かない。SW のメモリにだけ置き、
 *   1回限りの番号を付けてページへ渡す。ページが番号で取りに来たら渡して即座に消す。
 *   以前はキャッシュに書いていたため、受け取りに失敗すると期限なしで端末に残り、
 *   連続して共有すると同じ置き場所を上書きしていた。
 *   SW が止まればメモリごと消える（＝残らない）。そのときページは「もう一度共有して」と出す。 */
const SHARE_TTL_MS = 60 * 1000;   // 取りに来ないまま残った分はこれで捨てる
const pendingShares = new Map();  // id -> { text, at }

function dropStaleShares() {
  const now = Date.now();
  for (const [id, v] of pendingShares) {
    if (now - v.at > SHARE_TTL_MS) pendingShares.delete(id);
  }
}

async function handleShare(request, url) {
  let text = '';
  try {
    const form = await request.formData();
    // title / text / url のどれで来るかは共有元のアプリ次第なので、来たものを繋ぐ
    text = ['title', 'text', 'url'].map((k) => form.get(k)).filter(Boolean).join('\n');
  } catch (err) {
    /* 取り出せなくても画面は開く。黙って失敗させない方が現場で切り分けやすい */
  }
  dropStaleShares();
  const id = self.crypto.randomUUID();
  pendingShares.set(id, { text: text, at: Date.now() });
  return Response.redirect(new URL('./?shared=' + id, url).href, 303);
}

/* ページからの受け取り。渡したら消す（2回目は来ない）。 */
self.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || d.type !== 'take-share' || !e.ports || !e.ports[0]) return;
  dropStaleShares();
  const v = pendingShares.get(d.id);
  pendingShares.delete(d.id);
  e.ports[0].postMessage({ text: v ? v.text : null });
});

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
