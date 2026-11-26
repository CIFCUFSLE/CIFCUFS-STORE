/* =========================================================================
   ADMIN-AUTH.JS — khusus untuk admin.html (halaman admin, terpisah)

   admin.html = salinan index.html. Di admin.html, sebelum </body>, setelah
   </script> utama, pasang URUTAN INI:

       <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
       <script src="admin-auth.js"></script>
       <script src="dashboard.js"></script>
       <script src="monitoring.js"></script>

   (tambahkan juga firebase-auth-compat.js di <head> jika lebih suka; yang penting
    dimuat sebelum admin-auth.js)

   Yang dilakukan:
   1. Login admin memakai Firebase Authentication (bukan password di browser)
   2. Hanya email di ADMIN_EMAILS yang boleh masuk (harus sama dengan firestore.rules)
   3. Setelah login, hanya tampil dashboard admin (tanpa tampilan toko)
   4. Perubahan katalog, harga, dan pengaturan otomatis dikirim ke Firestore
      supaya pelanggan melihat harga terbaru di perangkat mereka
   ========================================================================= */
(function () {
  // >>> GANTI dengan email admin yang SUDAH dibuat di Firebase Console > Authentication <<<
  const ADMIN_EMAILS = ['admin@emailkamu.com'];

  let authed = false;
  let armed = false;
  let lastCatalog = '';
  let lastSettings = '';

  // ---------- sesi lokal lama tidak dipercaya ----------
  state.adminAuth.isAuthenticated = false;
  state.adminAuth.password = '';
  document.title = 'Admin • CIFCUFS STORE';
  const robots = document.createElement('meta');
  robots.name = 'robots'; robots.content = 'noindex,nofollow';
  document.head.appendChild(robots);

  // Hentikan pemanggilan sinkron otomatis sebelum login (akan dijalankan setelah login)
  window.fetchOrdersFromDB = function () {};
  window.fetchReviewsFromDB = function () {};

  // ---------- tampilan: hanya dashboard ----------
  const style = document.createElement('style');
  style.textContent = `
    #top-announcement, #main-footer, #main-navbar nav { display: none !important; }
    #main-navbar button[onclick*="openUserProfileModal"],
    #main-navbar button[onclick*="openCartDrawer"],
    #main-navbar button[onclick*="toggleMobileMenu"] { display: none !important; }
  `;
  document.head.appendChild(style);

  const _nav = navigateTo;
  navigateTo = function () { _nav('admin'); };

  const _render = renderApp;
  renderApp = function () {
    if (authed) state.activePage = 'admin';
    _render();
  };

  // ---------- gerbang login ----------
  const gate = document.createElement('div');
  gate.id = 'admin-gate';
  gate.className = 'fixed inset-0 z-[100] bg-[#f4f7f4] flex items-center justify-center p-4';
  gate.innerHTML = `
    <form id="gate-form" class="bg-white border border-[#d5e3d6] rounded-3xl max-w-md w-full p-7 shadow-xl space-y-4">
      <div>
        <p class="text-xs uppercase tracking-widest font-bold text-[#4a7c59]">CIFCUFS STORE</p>
        <h1 class="text-2xl font-extrabold text-[#181f1a] mt-1">Admin Login</h1>
        <p class="text-xs text-[#4e6355] mt-1">Halaman ini khusus admin.</p>
      </div>
      <label class="block text-xs font-bold">Email Admin
        <input id="gate-email" type="email" autocomplete="username" required class="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-[#d5e3d6] text-sm font-normal outline-none focus:border-[#4a7c59]" />
      </label>
      <label class="block text-xs font-bold">Password
        <input id="gate-pass" type="password" autocomplete="current-password" required class="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-[#d5e3d6] text-sm font-normal outline-none focus:border-[#4a7c59]" />
      </label>
      <p id="gate-err" class="text-xs text-[#d94e4e] min-h-[1rem]"></p>
      <button id="gate-btn" class="w-full py-3 rounded-xl bg-[#2d5a3c] hover:bg-[#4a7c59] text-white font-bold text-sm">Masuk</button>
    </form>`;
  document.body.appendChild(gate);

  const $ = (id) => document.getElementById(id);
  const showGate = (msg) => { gate.style.display = 'flex'; if (msg) $('gate-err').textContent = msg; };
  const hideGate = () => { gate.style.display = 'none'; $('gate-err').textContent = ''; $('gate-pass').value = ''; };

  openAdminLoginModal = function () { showGate(); };
  submitAdminLogin = function (e) { if (e && e.preventDefault) e.preventDefault(); };

  if (!window.firebase || !firebase.auth) {
    showGate('Firebase Auth belum dimuat. Pastikan firebase-auth-compat.js dipasang sebelum admin-auth.js.');
    return;
  }
  const auth = firebase.auth();

  logoutAdmin = function () { auth.signOut(); };

  $('gate-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('gate-btn');
    $('gate-err').textContent = '';
    btn.disabled = true; btn.textContent = 'Memeriksa...';
    try {
      await auth.signInWithEmailAndPassword($('gate-email').value.trim(), $('gate-pass').value);
    } catch (err) {
      const m = {
        'auth/invalid-credential': 'Email atau password salah.',
        'auth/wrong-password': 'Email atau password salah.',
        'auth/user-not-found': 'Email atau password salah.',
        'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.'
      }[err.code] || 'Gagal masuk. Coba lagi.';
      $('gate-err').textContent = m;
    } finally {
      btn.disabled = false; btn.textContent = 'Masuk';
    }
  });

  // ---------- kompres gambar ----------
  const _readFile = readImageFileAsDataUrl;
  readImageFileAsDataUrl = function (file, callback) {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) { _readFile(file, callback); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1000;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      callback(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); _readFile(file, callback); };
    img.src = url;
  };

  // ---------- kirim perubahan katalog & pengaturan ke Firestore ----------
  const _save = saveToStorage;
  let tCat = null, tSet = null;
  saveToStorage = function (key, value) {
    _save(key, value);
    if (!authed || !armed) return;
    if (key === STORAGE_KEYS.PRODUCTS) {
      const j = JSON.stringify(value);
      if (j === lastCatalog) return;
      clearTimeout(tCat);
      tCat = setTimeout(() => { lastCatalog = j; syncCatalogToCloud(); }, 600);
    } else if (key === STORAGE_KEYS.SETTINGS) {
      const j = JSON.stringify(value);
      if (j === lastSettings) return;
      clearTimeout(tSet);
      tSet = setTimeout(() => { lastSettings = j; syncSettingsToCloud(); }, 600);
    }
  };

  // ---------- status login ----------
  let started = false;
  function activate(user) {
    authed = true;
    state.adminAuth.isAuthenticated = true;
    state.adminAuth.email = user.email;
    state.adminAuth.password = '';
    state.activePage = 'admin';
    hideGate();

    if (!started) {
      started = true;
      try { (window.startAdminCloudSync || initRealtimeFirestoreSync)(); } catch (e) { console.error(e); }
      // Isi pertama kali: bila katalog / pengaturan belum ada di cloud, kirim yang ada sekarang
      if (firestoreDB) {
        firestoreDB.collection('store_config').doc('catalog').get().then(d => { if (!d.exists) syncCatalogToCloud(); }).catch(() => {});
        firestoreDB.collection('store_config').doc('settings').get().then(d => { if (!d.exists) syncSettingsToCloud(); }).catch(() => {});
      }
      setTimeout(() => {
        lastCatalog = JSON.stringify(state.products);
        lastSettings = JSON.stringify(state.settings);
        armed = true;
      }, 3000);
    }
    renderApp();
  }

  auth.onAuthStateChanged((user) => {
    if (!user) {
      authed = false; armed = false;
      state.adminAuth.isAuthenticated = false;
      showGate();
      return;
    }
    const email = (user.email || '').toLowerCase();
    if (!ADMIN_EMAILS.map(x => x.toLowerCase()).includes(email)) {
      auth.signOut();
      showGate('Akun ini tidak memiliki akses admin.');
      return;
    }
    activate(user);
  });

  try { _render(); } catch (e) { console.error(e); }
})();