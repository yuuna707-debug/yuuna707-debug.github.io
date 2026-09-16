(function (global) {
  'use strict';
  function normalize(value) {
    return String(value == null ? '' : value).replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function buildPipeText(entries) {
    return entries.map(function (entry) {
      var key = normalize(entry[0]);
      var value = normalize(entry[1]);
      return value ? (key ? key + ':' + value : value) : '';
    }).filter(Boolean).join('|');
  }
  function render(container, text) {
    if (!global.QRCode) throw new Error(document.documentElement.lang === 'en' ? 'The local QR code library could not be loaded.' : 'ローカルのQRコードライブラリを読み込めませんでした。');
    container.replaceChildren();
    return new global.QRCode(container, {text:text,width:256,height:256,colorDark:'#17343a',colorLight:'#ffffff',correctLevel:global.QRCode.CorrectLevel.L});
  }
  global.PediatricQR = { normalize: normalize, buildPipeText: buildPipeText, render: render };
})(window);
