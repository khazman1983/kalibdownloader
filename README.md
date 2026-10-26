# Kalib Downloader

Antara muka HTML/CSS/JavaScript dan backend Node.js, tanpa kebergantungan npm.

## Jalankan backend dan laman

Node.js 20 atau lebih baharu:

```sh
cd /workspace/kalibdownloader
npm start
```

Pelayan menggunakan `PORT` (lalai 3000), bind `0.0.0.0`. Frontend dan API mesti pada origin sama. `npm test` menjalankan ujian backend. `GET /api/health` ialah readiness check.

## Deploy

Pada hosting Node.js seperti Render atau Railway, pilih repositori ini, runtime Node.js, dan start command `npm start`. Tiada build atau dependency install diperlukan. Platform perlu membenarkan HTTPS keluar ke sumber fail. Buka URL hosting backend untuk menggunakan aplikasi lengkap. GitHub Pages hanya menyajikan frontend: ia tidak boleh menjalankan server.js. URL backend yang berasingan tidak disambungkan secara automatik ke GitHub Pages.

## API dan sokongan

`POST /api/download` menerima JSON `{"url":"https://example.com/file.pdf"}` dan memulangkan lampiran fail atau ralat JSON. Had fail backend 50 MB, maksimum tiga permintaan serentak bagi setiap proses. URL awam HTTP/HTTPS pada port 80/443 sahaja; alamat dalaman, credential URL dan redirect ke alamat dalaman ditolak. TLS verification kekal aktif. Fail dibuffer dalam memori, bukan disimpan pada cakera pelayan.

- Backend mengatasi sekatan CORS pada fail terus yang boleh dicapai pelayan.
- Scribd: hanya mengesan pautan PDF awam eksplisit (`a`/`link` dengan `type="application/pdf"`) dalam HTML yang dihantar sumber. Ini bukan sokongan umum downloader Scribd. Jika tiada pautan tersebut, pengguna perlu menggunakan Download rasmi Scribd dengan akaun/kebenaran yang diperlukan. Tiada bypass log masuk, langganan, CAPTCHA atau ekstraksi halaman viewer.
- YouTube belum disokong.
- Jika backend tiada, frontend masih boleh memuat turun fail terus dengan CORS, had 250 MB dalam memori pelayar.
- Senarai terkini disimpan dalam localStorage. “Dihantar ke pelayar” tidak mengesahkan simpanan ke cakera selesai.
- Fon Google pilihan; fon sistem digunakan jika tidak tersedia.

## Status pengesahan

Ujian backend meliputi penolakan SSRF, pemilihan pautan PDF, health, fail statik, method, origin dan ralat API. Pautan Scribd pengguna `https://www.scribd.com/doc/119170982/JENIS-JENIS-KARANGAN` tidak dapat disemak kerana CONNECT proxy environment memberi 403. Tiada tuntutan muat turun dokumen itu berjaya. Backend belum dideploy pada hosting awam.
