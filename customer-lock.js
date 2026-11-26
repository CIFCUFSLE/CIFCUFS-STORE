/* =========================================================================
   CUSTOMER-LOCK.JS — khusus untuk index.html (halaman pelanggan)

   Pasang di index.html, sebelum </body>, setelah </script> utama:
       <script src="customer-lock.js"></script>

   JANGAN pasang dashboard.js / monitoring.js / admin-auth.js di index.html.

   Yang dilakukan:
   1. Menutup semua jalur masuk admin di halaman pelanggan
   2. Menghapus sesi admin lama dari localStorage
   3. Pelanggan TIDAK lagi mengunduh seluruh daftar pesanan dari Firestore
      (sebelumnya semua pelanggan bisa melihat data semua orang)
   4. Pelanggan melacak pesanan lewat Nomor Pesanan + Nomor WhatsApp
   5. Status pesanan milik pelanggan di perangkat ini diperbarui otomatis
   6. Gambar (bukti transfer, dll.) dikompres supaya muat di Firestore
   ========================================================================= */
(function () {
  // ---------- 1 & 2. Kunci admin ----------
  state.adminAuth = { isAuthenticated: false, email: '', password: '', adminName: '', adminAvatar: '' };
  try { localStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH); } catch (e) {}

  const _save = saveToStorage;
  saveToStorage = function (key, value) {
    if (key === STORAGE_KEYS.ADMIN_AUTH) return; // tidak pernah menyimpan sesi admin di sisi pelanggan
    _save(key, value);
  };

  openAdminLoginModal = function () {};
  submitAdminLogin = function (e) { if (e && e.preventDefault) e.preventDefault(); };
  logoutAdmin = function () {};
  setAdminMenu = function () {};

  const _nav = navigateTo;
  navigateTo = function (page) { _nav(page === 'admin' ? 'home' : page); };

  const _render = renderApp;
  renderApp = function () {
    if (state.activePage === 'admin') state.activePage = 'home';
    state.adminAuth.isAuthenticated = false;
    _render();
    scheduleOrderLookup();
  };

  // ---------- 3. Sinkron Firestore versi pelanggan (tanpa daftar pesanan) ----------
  let syncStarted = false;
  initRealtimeFirestoreSync = function () {
    if (!firestoreDB || syncStarted) return;
    syncStarted = true;
    const onErr = (name) => (err) => console.warn('Sinkron ' + name + ' gagal:', err.code || err);

    firestoreDB.collection('reviews').orderBy('createdAt', 'desc').onSnapshot((snap) => {
      state.reviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      saveToStorage(STORAGE_KEYS.REVIEWS, state.reviews);
      if (state.activePage === 'home') renderApp();
    }, onErr('ulasan'));

    firestoreDB.collection('store_config').doc('catalog').onSnapshot((doc) => {
      if (doc.exists && Array.isArray(doc.data().products)) {
        state.products = doc.data().products;
        saveToStorage(STORAGE_KEYS.PRODUCTS, state.products);
        if (['home', 'catalog'].includes(state.activePage)) renderApp();
      }
    }, onErr('katalog'));

    firestoreDB.collection('store_config').doc('settings').onSnapshot((doc) => {
      if (doc.exists && doc.data().settings) {
        state.settings = { ...state.settings, ...doc.data().settings };
        saveToStorage(STORAGE_KEYS.SETTINGS, state.settings);
        renderApp();
      }
    }, onErr('pengaturan'));
  };
  window.fetchOrdersFromDB = function () {
    initRealtimeFirestoreSync();
    setTimeout(refreshMyOrders, 1200);
  };
  window.fetchReviewsFromDB = function () {};

  // ---------- 5. Perbarui status pesanan milik perangkat ini ----------
  async function refreshMyOrders() {
    if (!firestoreDB) return;
    let changed = false;
    for (const o of state.orders) {
      try {
        const snap = await firestoreDB.collection('orders').doc(o.id).get();
        if (snap.exists) {
          const d = snap.data();
          if (d.status && d.status !== o.status) {
            o.status = d.status;
            o.updatedAt = d.updatedAt || o.updatedAt;
            changed = true;
          }
        }
      } catch (e) { /* abaikan */ }
    }
    if (changed) {
      saveToStorage(STORAGE_KEYS.ORDERS, state.orders);
      if (state.activePage === 'orders') renderApp();
    }
  }
  setInterval(() => { if (state.activePage === 'orders') refreshMyOrders(); }, 30000);

  // ---------- 4. Lacak pesanan dari perangkat lain (Nomor Pesanan + WhatsApp) ----------
  let lookupTimer = null, lastKey = '';
  const digits = (s) => String(s || '').replace(/\D/g, '');
  function scheduleOrderLookup() {
    if (state.activePage !== 'orders') return;
    const num = state.orderSearchNumber.trim().toUpperCase();
    const wa = digits(state.orderSearchWhatsapp);
    if (!num || wa.length < 8) return;
    const key = num + '|' + wa;
    if (key === lastKey) return;
    clearTimeout(lookupTimer);
    lookupTimer = setTimeout(async () => {
      lastKey = key;
      if (!firestoreDB || state.orders.some(o => o.orderNumber.toUpperCase() === num)) return;
      try {
        const snap = await firestoreDB.collection('orders').doc(num).get();
        if (!snap.exists) return;
        const d = snap.data();
        // cocokkan 9 digit terakhir nomor WhatsApp supaya format 08xx / 62xx sama-sama valid
        if (digits(d.customerWhatsapp).slice(-9) !== wa.slice(-9)) return;
        state.orders.unshift({ id: snap.id, ...d });
        saveToStorage(STORAGE_KEYS.ORDERS, state.orders);
        _render();
      } catch (e) { console.warn('Pelacakan pesanan gagal:', e.code || e); }
    }, 700);
  }

  // ---------- 6. Kompres gambar sebelum disimpan ----------
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
      callback(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); _readFile(file, callback); };
    img.src = url;
  };

  try { renderApp(); } catch (e) { console.error(e); }
})();