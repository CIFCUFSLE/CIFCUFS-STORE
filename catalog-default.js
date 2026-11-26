/* Data katalog bawaan (ID sama dengan index.html). Dipakai admin.html hanya untuk
   mengisi Firestore pertama kali bila katalog di cloud masih kosong. */
const DEFAULT_CATEGORIES = [
  { id: 'streaming', name: 'Aplikasi Streaming', slug: 'streaming', icon: 'play', description: 'Layanan streaming film & serial resmi kualitas HD/4K anti limit.' },
  { id: 'listening', name: 'Listening', slug: 'listening', icon: 'music', description: 'Nikmati musik bebas iklan dengan audio jernih dan fitur offline.' },
  { id: 'ai', name: 'Artificial Intelligence', slug: 'ai', icon: 'cpu', description: 'Akses kecerdasan buatan premium untuk riset, tulisan, dan produktivitas.' },
  { id: 'editing', name: 'Editing', slug: 'editing', icon: 'scissors', description: 'Aplikasi desain grafis & video editing fitur pro tanpa watermark.' },
  { id: 'social-media', name: 'Kebutuhan Social Media', slug: 'social-media', icon: 'share-2', description: 'Promosi & pertumbuhan akun organik sesuai ketentuan platform.' },
  { id: 'jasa-edit-tugas', name: 'Jasa Edit & Jasa Tugas', slug: 'jasa-edit-tugas', icon: 'file-edit', description: 'Jasa desain kreatif, perapian dokumen, dan pendampingan belajar etis.' }
];

const DEFAULT_SETTINGS = {
  storeName: 'CIFCUFS STORE',
  tagline: 'Your Digital Needs, One Place.',
  whatsappNumber: '0813-8598-2311',
  whatsappRaw: '6281385982311',
  logoImage: '',
  heroBannerImage: '',
  announcementText: 'Solusi Kebutuhan Digital, Editing & Pendampingan Belajar Terpercaya — WhatsApp Resmi 0813-8598-2311',
  payments: {
    QRIS: { active: true, qrisImage: '', merchantName: '' },
    DANA: { active: true, accountNumber: '', accountName: '' },
    SeaBank: { active: true, accountNumber: '', accountName: '' },
    gatewayWebhookUrl: '',
    gatewayMode: 'manual'
  }
};

const DEFAULT_PRODUCTS = (function () {
  const V = (id, plan, duration, extra) => Object.assign({ id, plan, duration, basePrice: null, promoPrice: null, extraFee: 0, stock: 'Tersedia' }, extra || {});
  const P = (id, categoryId, name, description, order, variants, extra) =>
    Object.assign({ id, categoryId, name, description, image: '', active: true, featured: false, order, variants }, extra || {});
  const list = [];

  // 1. STREAMING
  list.push(P('prod-netflix', 'streaming', 'NETFLIX', 'Streaming film dan serial original Ultra HD 4K. Tersedia pilihan plan 1P1U, 1P2U, Semi Private, hingga Private.', 1, [
    V('nf-1p1u-1d', '1P1U', '1 Hari'), V('nf-1p1u-7d', '1P1U', '7 Hari'), V('nf-1p1u-1m', '1P1U', '1 Bulan'),
    V('nf-1p2u-1d', '1P2U', '1 Hari'), V('nf-1p2u-7d', '1P2U', '7 Hari'), V('nf-1p2u-1m', '1P2U', '1 Bulan'),
    V('nf-semi-1m', 'Semi Private', '1 Bulan'), V('nf-priv-1m', 'Private', '1 Bulan')
  ], { featured: true }));
  list.push(P('prod-viu', 'streaming', 'VIU', 'Nonton drama Korea, variety show, dan anime Asia terbaru tanpa iklan & anti limit.', 2, [
    V('viu-1m', 'Anti Limit Private', '1 Bulan'), V('viu-1y', 'Anti Limit Private', '1 Tahun')
  ]));
  list.push(P('prod-wetv', 'streaming', 'WETV', 'Akses VIP drama Asia eksklusif dan episode fast-track resolusi tinggi.', 3, [
    V('wetv-6u', '1 Bulan 6 User', '1 Bulan'), V('wetv-3u', '1 Bulan 3 User', '1 Bulan'), V('wetv-priv', '1 Bulan Private', '1 Bulan')
  ]));
  list.push(P('prod-disney', 'streaming', 'DISNEY+', 'Koleksi lengkap Disney, Pixar, Marvel, Star Wars, dan National Geographic.', 4, [
    V('dis-1d', 'Reguler', '1 Hari'), V('dis-7d', 'Reguler', '7 Hari'), V('dis-1m', 'Reguler', '1 Bulan')
  ]));
  list.push(P('prod-hbomax', 'streaming', 'HBO MAX', 'Tayangan blockbuster HBO Original, DC Universe, dan serial pemenang penghargaan.', 5, [
    V('hbo-all', 'All Sharing Anti Limit', 'All Sharing Anti Limit')
  ], { singleOptionMode: true }));
  list.push(P('prod-iqiyi', 'streaming', 'IQIYI', 'Streaming drama Tiongkok, anime, dan variety show subtitle lengkap.', 6, [
    V('iq-std', '1 Bulan Standar', '1 Bulan'), V('iq-prem', '1 Bulan Premium', '1 Bulan'), V('iq-priv', '1 Bulan Private', '1 Bulan')
  ]));
  list.push(P('prod-prime', 'streaming', 'PRIME VIDEO', 'Amazon Prime Video Original dengan kualitas HDR dan download offline.', 7, [
    V('prime-priv', '1 Bulan Private', '1 Bulan'), V('prime-shar', '1 Bulan Sharing', '1 Bulan')
  ]));

  // 2. LISTENING
  list.push(P('prod-ytmusic', 'listening', 'YOUTUBE MUSIC', 'Streaming jutaan lagu & video musik tanpa iklan. Paket Head menggunakan akun seller (otomatis ditambah biaya tambahan Rp5.000 dari harga dasar).', 1, [
    V('ytm-fam', 'Family Plan', '1 Bulan'), V('ytm-ind', 'Indplan', '1 Bulan'),
    V('ytm-head', 'Head (Akun Seller)', '1 Bulan', { extraFee: 5000, extraFeeNote: 'Biaya tambahan akun seller (+Rp5.000)' })
  ], { featured: true }));
  list.push(P('prod-applemusic', 'listening', 'APPLE MUSIC', 'Audio Lossless & Spatial Audio dengan Dolby Atmos untuk kualitas suara studio.', 2, [
    V('am-shar', 'Sharing', '1 Bulan')
  ]));
  list.push(P('prod-spotify', 'listening', 'SPOTIFY', 'Playlist personal, podcast eksklusif, dan dengar musik offline tanpa batas.', 3, [
    V('sp-ng-1m', 'Indplan No Garansi', '1 Bulan'), V('sp-ng-3m', 'Indplan No Garansi', '3 Bulan'), V('sp-fg-1m', 'Full Garansi', '1 Bulan')
  ], { featured: true }));

  // 3. AI
  list.push(P('prod-gemini-pro', 'ai', 'GEMINI PRO', 'Model AI multimodal canggih untuk riset mendalam, coding, dan integrasi produktivitas.', 1, [
    V('gp-1m', 'Gemini Pro', '1 Bulan'), V('gp-3m', 'Gemini Pro', '3 Bulan'), V('gp-1y', 'Gemini Pro', '1 Tahun')
  ], { featured: true }));
  list.push(P('prod-gemini-plus', 'ai', 'GEMINI PLUS', 'Asisten AI harian cerdas untuk penulisan, ringkasan dokumen, dan ide kreatif.', 2, [
    V('gplus-1m', 'Gemini Plus', '1 Bulan'), V('gplus-3m', 'Gemini Plus', '3 Bulan'), V('gplus-1y', 'Gemini Plus', '1 Tahun')
  ]));

  // 4. EDITING
  list.push(P('prod-capcut', 'editing', 'CAPCUT PRO', 'Buka seluruh efek Pro, transisi sinematik, auto-caption, dan ekspor tanpa watermark.', 1, [
    V('cc-sh-7d', 'Sharing', '7 Hari'), V('cc-pr-7d', 'Private', '7 Hari'), V('cc-sh-1m', 'Sharing', '1 Bulan'), V('cc-pr-1m', 'Private', '1 Bulan')
  ], { featured: true }));
  list.push(P('prod-canva-member', 'editing', 'CANVA PRO MEMBER BIASA', 'Akses jutaan template premium, penghapus latar belakang instan, dan Magic Studio.', 2, [
    V('cv-mb-1m', 'Member Biasa', '1 Bulan'), V('cv-mb-3m', 'Member Biasa', '3 Bulan'), V('cv-mb-1y', 'Member Biasa', '1 Tahun')
  ]));
  list.push(P('prod-canva-design', 'editing', 'CANVA PRO DESIGN', 'Paket Canva Pro dengan fitur Brand Kit lengkap dan ekspor aset resolusi tinggi.', 3, [
    V('cv-ds-1m', 'Pro Design', '1 Bulan'), V('cv-ds-3m', 'Pro Design', '3 Bulan'), V('cv-ds-1y', 'Pro Design', '1 Tahun')
  ]));
  list.push(P('prod-canva-admin', 'editing', 'CANVA PRO ADMIN', 'Kendali penuh tim desain, paket 1 Bulan mendukung invite hingga 50 member.', 4, [
    V('cv-ad-1m', 'Admin (Bisa Invite 50 Member)', '1 Bulan'), V('cv-ad-3m', 'Admin', '3 Bulan')
  ]));

  // 5. SOCIAL MEDIA
  const counts = [100, 200, 300, 400, 500, 600];
  list.push(P('prod-tiktok-followers', 'social-media', 'TIKTOK FOLLOWERS', 'Layanan promosi dan pertumbuhan audiens akun TikTok secara organik & sesuai ketentuan platform (tanpa bot, akun palsu, atau engagement palsu).', 1,
    counts.map(n => V('ttf-' + n, 'Pertumbuhan Organik', n + ' Followers')),
    { requiresTargetInput: true, targetLabel: 'Username / Link Profil TikTok', targetPlaceholder: 'Contoh: @usernameanda atau https://tiktok.com/@username' }));
  list.push(P('prod-tiktok-likes', 'social-media', 'TIKTOK LIKES', 'Promosi distribusi konten TikTok kepada audiens nyata sesuai kebijakan platform (bebas bot & fake engagement).', 2,
    counts.map(n => V('ttl-' + n, 'Promosi Konten', n + ' Likes')),
    { requiresTargetInput: true, targetLabel: 'Link Video TikTok Target', targetPlaceholder: 'Contoh: https://vt.tiktok.com/...' }));

  // 6. JASA EDIT & JASA TUGAS
  const edit = [
    ['je-edit-ppt', 'Edit PPT', 'Perbaikan layout, tipografi, transisi, dan visualisasi slide PowerPoint agar lebih profesional.', 'Ringan - Menengah', '1 - 2 Hari'],
    ['je-desain-ppt', 'Desain PPT', 'Pembuatan desain slide presentasi kreatif dari materi mentah Anda.', 'Menengah', '1 - 3 Hari'],
    ['je-edit-word', 'Edit Word', 'Penyuntingan struktur paragraf, margin, heading otomatis, dan daftar isi dokumen Word.', 'Ringan', '1 Hari'],
    ['je-rapikan-dok', 'Rapikan dokumen', 'Merapikan tata letak, penomoran halaman, tabel, dan konsistensi format dokumen.', 'Ringan', '1 Hari'],
    ['je-desain-poster', 'Desain poster', 'Desain poster acara, edukasi, promosi digital, atau infografis resolusi cetak.', 'Menengah', '1 - 2 Hari'],
    ['je-edit-foto', 'Edit foto', 'Color grading, retouching, penghapusan objek, dan penyesuaian rasio foto.', 'Ringan', '1 Hari'],
    ['je-edit-video', 'Edit video', 'Pemotongan klip, subtitle dinamis, transisi halus, dan audio mixing untuk konten digital.', 'Kompleks', '2 - 4 Hari'],
    ['je-desain-lain', 'Desain lainnya', 'Kebutuhan desain grafis custom seperti banner, feed media sosial, atau sertifikat.', 'Menengah', '1 - 3 Hari'],
    ['je-custom', 'Custom Request', 'Permintaan layanan editing khusus sesuai kebutuhan spesifik proyek Anda.', 'Fleksibel', 'Sesuai Kesepakatan']
  ];
  const tugas = [
    ['jt-konsultasi', 'Konsultasi tugas', 'Sesi diskusi & bimbingan langkah demi langkah untuk memahami kerangka penyelesaian tugas Anda.', 'Ringan - Menengah', '1 Hari'],
    ['jt-materi', 'Bantuan memahami materi', 'Penjelasan konsep, rangkuman terstruktur, dan studi kasus agar Anda menguasai topik pelajaran.', 'Ringan', '1 Hari'],
    ['jt-presentasi', 'Desain presentasi', 'Visualisasi materi presentasi seminar atau kelas agar sistematis dan mudah dipahami audiens.', 'Menengah', '1 - 2 Hari'],
    ['jt-formatting', 'Formatting dokumen', 'Penyesuaian template, sitasi, daftar pustaka, margin, dan gaya penulisan standar.', 'Ringan', '1 Hari'],
    ['jt-proofreading', 'Proofreading', 'Pengecekan tata bahasa, ejaan (PUEBI/EYD), koherensi kalimat, dan kejelasan tulisan.', 'Ringan', '1 - 2 Hari'],
    ['jt-laporan', 'Perapian laporan', 'Penataan struktur bab, tabel, grafik, dan lampiran laporan praktikum atau kegiatan.', 'Menengah', '1 - 2 Hari'],
    ['jt-data', 'Bantuan pengolahan data', 'Pendampingan tabulasi spreadsheet, visualisasi grafik, dan pemahaman interpretasi data.', 'Kompleks', '2 - 3 Hari'],
    ['jt-custom', 'Custom Request', 'Kebutuhan bimbingan belajar, review draf, atau konsultasi akademik etis lainnya.', 'Fleksibel', 'Sesuai Kesepakatan']
  ];
  edit.forEach(([id, name, desc, diff, est], i) => list.push(P('prod-' + id, 'jasa-edit-tugas', name, desc, i + 1, [
    V(id + '-reg', 'Paket Reguler', est), V(id + '-exp', 'Paket Prioritas / Express', 'Lebih Cepat')
  ], { subcategory: 'Jasa Edit', difficulty: diff, estimatedTime: est, isService: true, featured: i === 1 })));
  tugas.forEach(([id, name, desc, diff, est], i) => list.push(P('prod-' + id, 'jasa-edit-tugas', name, desc, i + 10, [
    V(id + '-std', 'Pendampingan Standar', est), V(id + '-int', 'Pendampingan Intensif', 'Prioritas')
  ], { subcategory: 'Jasa Tugas', difficulty: diff, estimatedTime: est, isService: true })));

  return list;
})();