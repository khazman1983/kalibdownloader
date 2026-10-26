'use strict';
const form = document.querySelector('#download-form');
const input = document.querySelector('#url');
const status = document.querySelector('#status');
const submit = document.querySelector('#submit');
const historyElement = document.querySelector('#history');
const storageKey = 'kalib-downloads-v1';
let selectedType = 'all';
let backendAvailable = false;
const backendReady = fetch('/api/health').then(r => r.ok ? r.json() : null).then(data => { backendAvailable = data?.ok === true; }).catch(() => {});
let downloads = [];
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (Array.isArray(saved)) downloads = saved.filter(x => x && typeof x.name === 'string' && typeof x.date === 'string' && typeof x.size === 'number').slice(0, 10);
} catch { /* Storage is optional in private browsing. */ }
function message(text, error = false) {
  status.textContent = text;
  status.classList.toggle('error', error);
}
function renderHistory() {
  historyElement.replaceChildren();
  if (!downloads.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = '<span class="empty-icon" aria-hidden="true">↓</span><div><strong>Belum ada muat turun</strong><p>Fail yang anda muat turun akan muncul di sini.</p></div>';
    historyElement.append(empty);
    return;
  }
  downloads.forEach(file => {
    const row = document.createElement('div');
    row.className = 'history-row';
    const icon = document.createElement('span');
    icon.className = 'file-icon';
    icon.textContent = file.name.split('.').pop().slice(0, 5).toUpperCase();
    const info = document.createElement('div');
    info.className = 'file-info';
    const name = document.createElement('strong');
    name.textContent = file.name;
    const meta = document.createElement('small');
    const date = new Date(file.date);
    meta.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB · ${Number.isNaN(date.getTime()) ? '' : date.toLocaleString('ms-MY')}`;
    info.append(name, meta);
    const completed = document.createElement('span');
    completed.className = 'completed';
    completed.textContent = '✓ Dihantar ke pelayar';
    row.append(icon, info, completed);
    historyElement.append(row);
  });
}
function saveHistory() {
  try { localStorage.setItem(storageKey, JSON.stringify(downloads)); } catch { /* Downloads still work without storage. */ }
  renderHistory();
}
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  selectedType = tab.dataset.type;
  document.querySelectorAll('.tab').forEach(item => {
    item.classList.toggle('active', item === tab);
    item.setAttribute('aria-pressed', String(item === tab));
  });
  const examples = { all: 'dokumen.pdf', pdf: 'dokumen.pdf', video: 'video.mp4', web: 'index.html' };
  input.placeholder = `https://example.com/${examples[selectedType]}`;
  message('');
}));
document.querySelector('#paste').addEventListener('click', async () => {
  try {
    input.value = await navigator.clipboard.readText();
    input.focus();
    message('Pautan ditampal. Klik “Muat turun fail” untuk meneruskan.');
  } catch {
    input.focus();
    message('Akses papan klip tidak tersedia. Tampal pautan menggunakan Ctrl+V atau menu peranti.', true);
  }
});
document.querySelector('#clear').addEventListener('click', () => {
  downloads = [];
  saveHistory();
  message('Senarai muat turun telah dikosongkan.');
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  let url;
  try {
    url = new URL(input.value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
  } catch { message('Masukkan pautan HTTP atau HTTPS yang sah tanpa maklumat log masuk.', true); return; }
  await backendReady;
  const host = url.hostname.toLowerCase();
  if (['youtube.com', 'youtu.be', 'youtube-nocookie.com'].some(domain => host === domain || host.endsWith(`.${domain}`))) {
    message('Pautan halaman YouTube belum disokong. Gunakan pilihan muat turun rasmi atau URL fail terus yang anda dibenarkan akses.', true);
    return;
  }
  if ((host === 'scribd.com' || host.endsWith('.scribd.com')) && !backendAvailable) {
    message('Backend belum tersedia di laman ini. GitHub Pages tidak menjalankan backend; buka aplikasi pada pelayan Node.js untuk semakan pautan PDF awam Scribd.', true);
    return;
  }
  submit.disabled = true;
  submit.textContent = 'Sedang mengambil fail…';
  message('Menghubungi pelayan sumber…');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const response = backendAvailable
      ? await fetch('/api/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.href }), signal: controller.signal })
      : await fetch(url.href, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok && backendAvailable) {
      const error = await response.json();
      throw new Error(error.error || 'Backend tidak dapat memuat turun fail.');
    }
    if (!response.ok) throw new Error(`Pelayan memberi respons HTTP ${response.status}. Semak pautan dan kebenaran akses.`);
    const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const finalUrl = new URL(backendAvailable ? url.href : response.url || url.href);
    let name;
    try { name = decodeURIComponent(response.headers.get('x-file-name') || finalUrl.pathname.split('/').pop() || ''); } catch { name = ''; }
    const extension = name.split('.').pop().toLowerCase();
    if (selectedType === 'pdf' && mime !== 'application/pdf' && extension !== 'pdf') throw new Error('Pautan ini tidak memberikan fail PDF. Pilih jenis fail yang sesuai.');
    if (selectedType === 'video' && !mime.startsWith('video/') && !['mp4', 'webm', 'mov', 'm4v', 'ogv'].includes(extension)) throw new Error('Pautan ini tidak memberikan fail video terus. Gunakan URL seperti .mp4 atau .webm.');
    if (selectedType === 'web' && !['html', 'htm', 'css', 'js', 'mjs'].includes(extension) && !['text/html', 'text/css', 'text/javascript', 'application/javascript'].includes(mime)) throw new Error('Pautan ini bukan fail HTML, CSS atau JavaScript.');
    if (mime === 'text/html' && selectedType !== 'web') throw new Error('Pautan ini membuka halaman web. Gunakan URL fail terus, atau pilih HTML / CSS / JS untuk menyimpan halaman HTML.');
    const limit = 250 * 1024 * 1024;
    if (Number(response.headers.get('content-length')) > limit) throw new Error('Fail melebihi had 250 MB versi pelayar ini. Gunakan muat turun rasmi sumber.');
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error('Fail melebihi had 250 MB versi pelayar ini.'); }
      chunks.push(value);
      message(`Menerima fail… ${(size / 1024 / 1024).toFixed(2)} MB`);
    }
    if (!size) throw new Error('Pelayan memulangkan fail kosong. Semak pautan sumber.');
    const blob = new Blob(chunks, { type: mime || 'application/octet-stream' });
    const suffix = { 'application/pdf': 'pdf', 'video/mp4': 'mp4', 'video/webm': 'webm', 'text/html': 'html', 'text/css': 'css', 'application/javascript': 'js', 'text/javascript': 'js' }[mime] || 'bin';
    name = (name || `muat-turun.${suffix}`).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 180);
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    downloads.unshift({ name, size, date: new Date().toISOString() });
    downloads = downloads.slice(0, 10);
    saveHistory();
    message('Fail dihantar ke pelayar. Semak senarai muat turun peranti anda.');
  } catch (error) {
    controller.abort();
    message(error.name === 'AbortError' ? 'Permintaan mengambil masa terlalu lama. Cuba semula atau gunakan fail lebih kecil.' : error instanceof TypeError ? 'Fail tidak dapat dicapai. Pelayan mungkin menyekat CORS, memerlukan log masuk, atau rangkaian terputus. Cuba URL fail terus yang lain.' : error.message, true);
  } finally {
    clearTimeout(timeout);
    submit.disabled = false;
    submit.innerHTML = 'Muat turun fail <span>↓</span>';
  }
});
renderHistory();
