# Kalib Downloader

Aplikasi statik HTML, CSS dan JavaScript dalam Bahasa Melayu untuk muat turun fail daripada URL terus yang membenarkan CORS. Tiada kebergantungan build atau akaun diperlukan.

## Jalankan

```sh
cd /workspace/kalibdownloader
python3 -m http.server 8080 --bind 0.0.0.0
```

Buka melalui pelayan HTTP. Papan klip memerlukan konteks selamat (HTTPS atau localhost) dan kebenaran pelayar; tampal manual juga tersedia.

## Sokongan

- Muat turun fail terus dengan semakan jenis PDF, video, HTML, CSS dan JS.
- Had 250 MB; fail dikumpulkan dalam memori pelayar.
- Senarai 10 muat turun terkini dalam localStorage, dengan pilihan kosongkan.
- Pengendalian ralat HTTP, CORS, format dan tamat masa.
- Tiada backend, proksi CORS atau pemproses pautan YouTube/Scribd. Gunakan muat turun rasmi platform; sokongan pautan halaman memerlukan backend/API yang dibenarkan.
- Senarai menandakan fail dihantar ke pelayar; JavaScript tidak boleh mengesahkan fail selesai disimpan pada cakera.

Gunakan hanya kandungan yang anda miliki atau mempunyai kebenaran untuk dimuat turun. Fon Google bersifat pilihan; fon sistem digunakan jika tidak tersedia.
