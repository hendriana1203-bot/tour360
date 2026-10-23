# Tour360 - Interactive Virtual Tour 360° Platform
(Arsitektur Three.js WebGL, Google Street View Raycasting Hotspots, Prisma SQLite, dan Express.js)

Aplikasi web Virtual Tour 360 derajat interaktif berstandar profesional mirip Google Street View dengan orientasi raycasting lantai presisi tinggi, manajemen upload foto panorama dinamis, dan panel admin lengkap.

---

## 🚀 Panduan Menjalankan di Komputer Lokal (`D:/tur360`)

### 1. Prasyarat Sistem
- **Node.js**: Versi 18.x atau 20.x+
- **NPM**: Versi 9.x atau 10.x+

### 2. Langkah Instalasi & Persiapan Direktori
Salin seluruh file proyek ini ke dalam folder `D:/tur360` komputer Anda.
Buka Command Prompt (CMD), PowerShell, atau Git Bash di direktori tersebut:

```bash
cd D:/tur360
npm install
```

### 3. Migrasi Database SQLite & Prisma ORM
Jalankan perintah sinkronisasi skema database Prisma untuk membuat file `prisma/dev.db`:

```bash
npx prisma generate
npx prisma db push
```

### 4. Menjalankan Server Aplikasi
Jalankan server aplikasi secara lokal:

```bash
npm run dev
```

Aplikasi siap diakses melalui browser:
- **Halaman Pengguna (Public Tour View):** [http://localhost:3000/](http://localhost:3000/)
- **Halaman Panel Admin (Admin Dashboard):** [http://localhost:3000/admin](http://localhost:3000/admin)

> **Kredensial Akun Bawaan (Default Admin):**
> - **Username:** `admin`
> - **Password:** `admin123`

---

## 🗺️ Rangkaian 16 Scene & Titik Navigasi Penanda Merah

Setiap titik navigasi telah diposisikan secara matematis tepat di atas lingkaran merah:

| No | Nama Scene / Lokasi | Berkas Foto | Sudut Awal (P, Y) | Target Navigasi (P, Y) |
|---|---|---|---|---|
| 1 | Gerbang Masuk Binar Alam View | `pt1.jpg` | (-8.0°, -125.4°) | → Foto 2 (P: -13.5°, Y: -125.4°) |
| 2 | Area Patung Karakter & Gazebo | `pt2.jpg` | (-6.0°, -162.7°) | → Foto 3 (P: 1.0°, Y: -162.7°) |
| 3 | Taman Hati & Tepi Kolam | `pt3.jpg` | (-8.0°, 104.3°) | → Foto 4 (P: -12.7°, Y: 104.3°) |
| 4 | Kolam Renang Anak & Perosotan | `pt4.jpg` | (-7.0°, -89.7°) | → Foto 5 (P: -7.0°, Y: -89.7°) |
| 5 | Jalur Kolam Arus & Gazebo Pohon | `pt5.jpg` | (-8.0°, -170.7°) | → Foto 6 (P: -7.6°, Y: -170.7°) |
| 6 | Persimpangan Saung & Jalur Taman | `pt6.jpg` | (-6.0°, 107.7°) | → Foto 7 (P: -5.6°, Y: 107.7°) |
| 7 | Lapangan Rumput Sintetis & Kanopi | `pt7.jpg` | (-8.0°, -26.7°) | → Foto 8 (P: -9.0°, Y: -26.7°) |
| 8 | Tepian Danau Binar Alam | `pt8.jpg` | (-10.0°, 2.8°) | → Foto 9 (P: -14.1°, Y: 2.8°) |
| 9 | Jalur Taman Air Danau & Pot Bunga | `pt9.jpg` | (-8.0°, 153.3°) | → Foto 10 (P: -9.6°, Y: 153.3°) |
| 10 | Jembatan Penyeberangan Danau | `pt10.jpg` | (-5.0°, 177.8°) | → Foto 11 (P: -4.8°, Y: 177.8°) |
| 11 | Ujung Jembatan & Saung Apung | `pt11.jpg` | (-10.0°, -104.9°) | → Foto 12 (P: -12.9°, Y: -104.9°) |
| 12 | Villa Segitiga & Area Panggung | `pt12.jpg` | (-6.0°, -136.1°) | → Foto 13 (P: -4.8°, Y: -136.1°) |
| 13 | Tebing Air Terjun Buatan | `pt13.jpg` | (-6.0°, -162.3°) | → Foto 14 (P: -7.9°, Y: -162.3°) |
| 14 | Pendopo Utama & Bunga Bugenvil | `pt14.jpg` | (-8.0°, -103.2°) | → Foto 15 (P: -10.4°, Y: -103.2°) |
| 15 | Rumah Kebun & Sayap Danau | `pt15.jpg` | (-8.0°, 42.5°) | → Foto 16 (P: -9.8°, Y: 42.5°) |
| 16 | Dermaga Perahu Bebek Air Danau | `pt16.jpg` | (-8.0°, -19.7°) | → Foto 1 (P: -9.0°, Y: -19.7°) |

1. **Viewer Panorama 360° Responsif & Mobile-First (Three.js):**
   - Rendering bola equirectangular (`THREE.SphereGeometry`) dengan koreksi UV horizontal.
   - Panning & tilting halus dengan exponential camera damping.
   - Dukungan gesture sentuh: drag 1 jari untuk memutar, pinch 2 jari untuk zoom in/out, dan mouse wheel zoom.

2. **Koreksi Matematika Raycasting & Koordinat Hotspot (Pitch & Yaw Alignment):**
   - Perhitungan konversi sudut bulat (`degToRad`, `Math.sin`, `Math.cos`) dan inversi raycaster (`asin`, `atan2`) yang presisi 100% tanpa drift atau pergeseran saat di-zoom.
   - **Google Street View Ground Alignment Mode:** Ikon panah diletakkan menempel di lantai dengan cincin konsentris berdenyut (*pulsing ground rings*) dan perspektif kemiringan lantai (*ground tilt*).

3. **Fitur Pengalaman Pengguna Lengkap:**
   - **Radar / Kompas Orientasi:** Indikator arah mata angin berputar real-time mengikuti arah kamera.
   - **Suara Ambien Web Audio:** Sintesis audio prosedural tanpa file eksternal (suasana hembusan angin ruangan damai dan efek *whoosh + chime* saat berpindah ruangan).
   - **Dock Galeri Ruangan Bawah:** Carousel kartu ruangan horizontal yang dapat disembunyikan (*collapsible cinema mode*) agar tidak menutupi pemandangan 360°.

4. **Panel Admin & Manajemen Konten (Rute `/admin`):**
   - **Autentikasi & Proteksi Rute:** Sistem login admin berbasis token sesi.
   - **CRUD Scene & Ganti Foto Dinamis:** Admin dapat menambah scene, mengedit data, dan langsung mengunggah file foto 360 panorama baru (JPG, PNG, WebP) untuk menggantikan foto lama secara dinamis menggunakan Multer.
   - **Visual Hotspot Pinpointing:** Viewer 3D interaktif di mana admin cukup mengklik area lantai untuk menancapkan titik panah Street View dengan koordinat Pitch/Yaw otomatis.
   - **Manajemen Logo & Branding:** Unggah logo instansi/sekolah baru dan ubah nama tur serta kontak secara langsung di header.
   - **Manajemen Akun Admin (CRUD Admin):** Tambah admin baru dengan hak akses fleksibel (Super Admin, Admin, Editor).
