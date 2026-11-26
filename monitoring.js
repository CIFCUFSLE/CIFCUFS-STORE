/* =========================================================================
   MONITORING.JS — Menu "15. Database Monitoring" untuk Admin Dashboard
   CIFCUFS STORE.

   CARA PASANG (1 baris saja):
   Di index.html, taruh tepat SETELAH tag </script> utama dan SEBELUM </body>:

       <script src="monitoring.js"></script>

   Fitur:
   - Katalog data monitoring pelanggan (siapa beli apa, mulai & habis kapan)
   - Status otomatis: Aktif / Akan Habis (<=3 hari) / Expired / Dihentikan
   - Tambah, edit, hapus, cari, filter status
   - Import otomatis dari pesanan berstatus Paid / In Progress / Completed
   - Tombol WhatsApp pengingat perpanjangan
   - Export CSV
   - Simpan di localStorage + sinkron real-time ke Firestore (koleksi "monitoring")
   - Kartu peringatan di Ringkasan Dashboard
   - Memperbaiki fetchOrdersFromDB / fetchReviewsFromDB yang belum terdefinisi
   ========================================================================= */
(function () {
  const MON_KEY = 'galeyn_monitoring_v1';
  const MON_STATUSES = ['Aktif', 'Akan Habis', 'Expired', 'Dihentikan', 'Tanpa Batas'];

  const mon = {
    items: loadFromStorage(MON_KEY, []),
    search: '',
    filter: 'all'
  };

  // ---------- Perbaikan: fungsi yang dipanggil tapi belum ada ----------
  let _syncStarted = false;
  function startCloudSyncOnce() {
    if (_syncStarted) return;
    _syncStarted = true;
    try { if (typeof initRealtimeFirestoreSync === 'function') initRealtimeFirestoreSync(); } catch (e) { console.error(e); }
    initMonitoringSync();
  }
  window.startAdminCloudSync = startCloudSyncOnce; // dipanggil admin-auth.js setelah login berhasil
  if (typeof window.fetchOrdersFromDB !== 'function') window.fetchOrdersFromDB = startCloudSyncOnce;
  if (typeof window.fetchReviewsFromDB !== 'function') window.fetchReviewsFromDB = function () {};

  // ---------- Helper tanggal & status ----------
  function todayStr() { return new Date().toISOString().slice(0, 10); }

  function addDuration(startStr, durationText) {
    const m = String(durationText || '').toLowerCase().match(/(\d+)\s*(hari|minggu|bulan|tahun)/);
    if (!m || !startStr) return '';
    const n = Number(m[1]);
    const d = new Date(startStr + 'T00:00:00');
    if (m[2] === 'hari') d.setDate(d.getDate() + n);
    else if (m[2] === 'minggu') d.setDate(d.getDate() + n * 7);
    else if (m[2] === 'bulan') d.setMonth(d.getMonth() + n);
    else if (m[2] === 'tahun') d.setFullYear(d.getFullYear() + n);
    return d.toISOString().slice(0, 10);
  }

  function daysLeft(endStr) {
    if (!endStr) return null;
    const end = new Date(endStr + 'T23:59:59');
    return Math.ceil((end - new Date()) / 86400000);
  }

  function computeStatus(r) {
    if (r.stopped) return 'Dihentikan';
    if (!r.endDate) return 'Tanpa Batas';
    const d = daysLeft(r.endDate);
    if (d < 0) return 'Expired';
    if (d <= 3) return 'Akan Habis';
    return 'Aktif';
  }

  function statusClass(s) {
    return {
      'Aktif': 'bg-emerald-50 text-emerald-800 border-emerald-200',
      'Akan Habis': 'bg-amber-50 text-amber-800 border-amber-200',
      'Expired': 'bg-red-50 text-[#d94e4e] border-red-200',
      'Dihentikan': 'bg-stone-100 text-stone-600 border-stone-200',
      'Tanpa Batas': 'bg-sky-50 text-sky-800 border-sky-200'
    }[s] || 'bg-stone-100 text-stone-600 border-stone-200';
  }

  function fmtDate(s) {
    if (!s) return '-';
    return new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function waLink(r) {
    let num = String(r.whatsapp || '').replace(/\D/g, '').replace(/^0/, '62');
    const d = daysLeft(r.endDate);
    const info = d === null ? '' : d < 0 ? `sudah berakhir pada ${fmtDate(r.endDate)}` : `akan berakhir pada ${fmtDate(r.endDate)} (${d} hari lagi)`;
    const text = `Halo kak ${r.customerName}, ini admin ${state.settings.storeName}. Layanan *${r.productName}${r.plan ? ' (' + r.plan + ')' : ''}* kakak ${info}. Mau diperpanjang? 😊`;
    return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
  }

  // ---------- Penyimpanan ----------
  function persist() { saveToStorage(MON_KEY, mon.items); }

  async function cloudSave(item) {
    if (!firestoreDB) return;
    try { await firestoreDB.collection('monitoring').doc(item.id).set(item); }
    catch (e) { console.error('Gagal simpan monitoring ke Firebase:', e); }
  }
  async function cloudDelete(id) {
    if (!firestoreDB) return;
    try { await firestoreDB.collection('monitoring').doc(id).delete(); }
    catch (e) { console.error('Gagal hapus monitoring di Firebase:', e); }
  }
  function initMonitoringSync() {
    if (!firestoreDB) return;
    firestoreDB.collection('monitoring').onSnapshot((snap) => {
      // Gabungkan: data cloud menang, data lokal yang belum ada di cloud tetap dipertahankan
      const cloud = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const cloudIds = new Set(cloud.map(c => c.id));
      const localOnly = mon.items.filter(i => !cloudIds.has(i.id));
      mon.items = [...cloud, ...localOnly];
      persist();
      localOnly.forEach(cloudSave);
      if (state.activePage === 'admin' && state.activeAdminMenu === 'monitoring') renderApp();
    }, (err) => console.warn('Sinkron monitoring gagal (cek Firestore rules):', err));
  }

  // ---------- Render panel ----------
  function renderMonitoringPanel() {
    const q = mon.search.trim().toLowerCase();
    const enriched = mon.items.map(r => ({ ...r, _status: computeStatus(r), _days: daysLeft(r.endDate) }));

    const counts = {
      total: enriched.length,
      aktif: enriched.filter(r => r._status === 'Aktif').length,
      soon: enriched.filter(r => r._status === 'Akan Habis').length,
      expired: enriched.filter(r => r._status === 'Expired').length
    };

    const rows = enriched
      .filter(r => mon.filter === 'all' ? true : r._status === mon.filter)
      .filter(r => !q || [r.customerName, r.whatsapp, r.email, r.productName, r.plan, r.orderNumber, r.accountInfo, r.notes]
        .join(' ').toLowerCase().includes(q))
      .sort((a, b) => {
        // yang paling mendesak (hari tersisa paling sedikit) di atas
        const da = a._days === null ? 99999 : a._days;
        const db = b._days === null ? 99999 : b._days;
        return da - db;
      });

    const kpis = [
      { label: 'Total Data', value: counts.total },
      { label: 'Aktif', value: counts.aktif },
      { label: 'Akan Habis (≤3 hari)', value: counts.soon },
      { label: 'Expired', value: counts.expired }
    ];

    return `
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        ${kpis.map(k => `
          <div class="bg-white border border-[#d5e3d6] rounded-2xl p-4 shadow-2xs">
            <span class="text-[11px] font-semibold text-[#4e6355]">${k.label}</span>
            <p class="text-xl font-extrabold text-[#181f1a] mt-1">${k.value}</p>
          </div>`).join('')}
      </div>

      <div class="bg-white border border-[#d5e3d6] rounded-3xl p-6 space-y-5 shadow-2xs">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-xl font-extrabold text-[#181f1a]">15. Database Monitoring</h2>
            <p class="text-xs text-[#4e6355]">Katalog data pelanggan: layanan yang dibeli, tanggal mulai, masa berlaku, dan info akun.</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button onclick="monImportFromOrders()" class="px-3.5 py-2.5 rounded-xl bg-[#e6efe6] hover:bg-[#d5e3d6] text-[#2d5a3c] text-xs font-bold inline-flex items-center gap-1.5">
              <i data-lucide="download" class="w-4 h-4"></i><span>Import dari Pesanan</span>
            </button>
            <button onclick="monExportCsv()" class="px-3.5 py-2.5 rounded-xl bg-[#e6efe6] hover:bg-[#d5e3d6] text-[#2d5a3c] text-xs font-bold inline-flex items-center gap-1.5">
              <i data-lucide="file-text" class="w-4 h-4"></i><span>Export CSV</span>
            </button>
            <button onclick="openMonitoringForm(null)" class="px-4 py-2.5 rounded-xl bg-[#2d5a3c] hover:bg-[#4a7c59] text-white text-xs font-bold inline-flex items-center gap-1.5">
              <i data-lucide="plus" class="w-4 h-4"></i><span>Tambah Data</span>
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <input type="text" value="${escapeHtml(mon.search)}" oninput="monSetSearch(this.value)" placeholder="Cari nama, WhatsApp, produk, no. pesanan..." class="w-full sm:w-80 px-3.5 py-2 rounded-xl border border-[#d5e3d6] text-xs" />
          <div class="flex flex-wrap gap-1.5">
            ${['all', ...MON_STATUSES].map(f => `
              <button onclick="monSetFilter('${f}')" class="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                mon.filter === f ? 'bg-[#4a7c59] text-white' : 'bg-[#e6efe6] text-[#2d5a3c] hover:bg-[#d5e3d6]'
              }">${f === 'all' ? 'Semua' : f}</button>`).join('')}
          </div>
        </div>

        ${rows.length === 0 ? `
          <p class="text-xs text-[#4e6355] py-10 text-center">Belum ada data. Klik <strong>Import dari Pesanan</strong> atau <strong>Tambah Data</strong>.</p>
        ` : `
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs min-w-[900px]">
              <thead>
                <tr class="border-b border-[#eef4ef] text-[#4e6355]">
                  <th class="py-3">Pelanggan</th>
                  <th class="py-3">Layanan</th>
                  <th class="py-3">Mulai</th>
                  <th class="py-3">Berakhir</th>
                  <th class="py-3">Status</th>
                  <th class="py-3">Info Akun / Catatan</th>
                  <th class="py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#eef4ef]">
                ${rows.map(r => `
                  <tr class="align-top hover:bg-[#f4f7f4]">
                    <td class="py-3">
                      <p class="font-bold text-[#181f1a]">${escapeHtml(r.customerName)}</p>
                      <p class="text-[11px] text-[#4e6355]">${escapeHtml(r.whatsapp || '-')}</p>
                      ${r.email ? `<p class="text-[11px] text-[#4e6355]">${escapeHtml(r.email)}</p>` : ''}
                    </td>
                    <td class="py-3">
                      <p class="font-bold">${escapeHtml(r.productName)}</p>
                      <p class="text-[11px] text-[#4a7c59] font-semibold">${escapeHtml(r.plan || '')} ${r.duration ? '• ' + escapeHtml(r.duration) : ''}</p>
                      ${r.orderNumber ? `<p class="text-[10px] text-[#718174]">${escapeHtml(r.orderNumber)}</p>` : ''}
                    </td>
                    <td class="py-3 whitespace-nowrap">${fmtDate(r.startDate)}</td>
                    <td class="py-3 whitespace-nowrap">
                      ${fmtDate(r.endDate)}
                      ${r._days !== null && !r.stopped ? `<p class="text-[10px] font-bold ${r._days < 0 ? 'text-[#d94e4e]' : r._days <= 3 ? 'text-amber-700' : 'text-[#4e6355]'}">${r._days < 0 ? Math.abs(r._days) + ' hari lewat' : r._days + ' hari lagi'}</p>` : ''}
                    </td>
                    <td class="py-3"><span class="px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusClass(r._status)}">${r._status}</span></td>
                    <td class="py-3 max-w-[220px]">
                      ${r.accountInfo ? `<p class="text-[11px] break-words"><strong>Akun:</strong> ${escapeHtml(r.accountInfo)}</p>` : ''}
                      ${r.notes ? `<p class="text-[11px] text-[#4e6355] break-words">${escapeHtml(r.notes)}</p>` : ''}
                    </td>
                    <td class="py-3 text-right whitespace-nowrap space-x-1">
                      ${r.whatsapp ? `<a href="${waLink(r)}" target="_blank" rel="noreferrer" class="inline-block p-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100" title="Kirim pengingat WhatsApp"><i data-lucide="phone" class="w-3.5 h-3.5"></i></a>` : ''}
                      <button onclick="monRenew('${r.id}')" class="p-2 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100" title="Perpanjang sesuai durasi"><i data-lucide="sparkles" class="w-3.5 h-3.5"></i></button>
                      <button onclick="openMonitoringForm('${r.id}')" class="p-2 rounded-lg bg-[#e6efe6] text-[#2d5a3c] hover:bg-[#d5e3d6]" title="Edit"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>
                      <button onclick="monDelete('${r.id}')" class="p-2 rounded-lg bg-red-50 text-[#d94e4e] hover:bg-red-100" title="Hapus"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        `}
        <p class="text-[11px] text-[#718174]">Tips: jangan simpan password akun pelanggan dalam bentuk teks biasa. Cukup catat email/username akun dan profil/slot yang dipakai.</p>
      </div>
    `;
  }

  // ---------- Aksi ----------
  window.monSetSearch = function (v) { mon.search = v; renderApp(); };
  window.monSetFilter = function (f) { mon.filter = f; renderApp(); };

  window.openMonitoringForm = function (id) {
    const ex = id ? mon.items.find(i => i.id === id) : null;
    const r = ex || { customerName: '', whatsapp: '', email: '', productName: '', plan: '', duration: '', startDate: todayStr(), endDate: '', accountInfo: '', notes: '', orderNumber: '', stopped: false };
    const prodOptions = state.products.map(p => `<option value="${escapeHtml(p.name)}"></option>`).join('');
    document.getElementById('modal-root').innerHTML = `
      <div class="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white border border-[#d5e3d6] rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-fade-in">
          <div class="px-6 py-4 bg-[#f4f7f4] border-b border-[#d5e3d6] flex items-center justify-between">
            <h3 class="font-extrabold text-base text-[#181f1a]">${ex ? 'Edit Data Monitoring' : 'Tambah Data Monitoring'}</h3>
            <button onclick="closeModal()" class="p-2 rounded-xl hover:bg-[#e6efe6]"><i data-lucide="x" class="w-5 h-5"></i></button>
          </div>
          <form onsubmit="monSave(event, ${ex ? `'${ex.id}'` : 'null'})" class="p-6 space-y-3.5 max-h-[82vh] overflow-y-auto">
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-xs font-bold mb-1">Nama Pelanggan *</label>
                <input id="mf-name" required value="${escapeHtml(r.customerName)}" class="w-full px-3 py-2 rounded-xl border border-[#d5e3d6] text-xs" /></div>
              <div><label class="block text-xs font-bold mb-1">WhatsApp</label>
                <input id="mf-wa" type="tel" value="${escapeHtml(r.whatsapp)}" class="w-full px-3 py-2 rounded-xl border border-[#d5e3d6] text-xs" /></div>
            </div>
            <div><label class="block text-xs font-bold mb-1">Email Pelanggan</label>
              <input id="mf-email" type="email" value="${escapeHtml(r.email)}" class="w-full px-3 py-2 rounded-xl border border-[#d5e3d6] text-xs" /></div>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-xs font-bold mb-1">Produk / Layanan *</label>
                <input id="mf-prod" list="mf-prod-list" required value="${escapeHtml(r.productName)}" class="w-full px-3 py-2 rounded-xl border border-[#d5e3d6] text-xs" />
                <datalist id="mf-prod-list">${prodOptions}</datalist></div>
              <div><label class="block text-xs font-bold mb-1">Plan / Paket</label>
                <input id="mf-plan" value="${escapeHtml(r.plan)}" class="w-full px-3 py-2 rounded-xl border border-[#d5e3d6] text-xs" /></div>
            </div>
            <div class="grid grid-cols-3 gap-3">
              <div><label class="block text-xs font-bold mb-1">Durasi</label>
                <input id="mf-dur" value="${escapeHtml(r.duration)}" placeholder="1 Bulan" onchange="monAutoEnd()" class="w-full px-3 py-2 rounded-xl border border-[#d5e3d6] text-xs" /></div>
              <div><label class="block text-xs font-bold mb-1">Mulai</label>
                <input id="mf-start" type="date" value="${escapeHtml(r.startDate)}" onchange="monAutoEnd()" class="w-full px-3 py-2 rounded-xl border border-[#d5e3d6] text-xs" /></div>
              <div><label class="block text-xs font-bold mb-1">Berakhir</label>
                <input id="mf-end" type="date" value="${escapeHtml(r.endDate)}" class="w-full px-3 py-2 rounded-xl border border-[#d5e3d6] text-xs" /></div>
            </div>
            <div><label class="block text-xs font-bold mb-1">Info Akun (email/username, profil/slot)</label>
              <input id="mf-acc" value="${escapeHtml(r.accountInfo)}" class="w-full px-3 py-2 rounded-xl border border-[#d5e3d6] text-xs" /></div>
            <div><label class="block text-xs font-bold mb-1">Nomor Pesanan (opsional)</label>
              <input id="mf-order" value="${escapeHtml(r.orderNumber)}" class="w-full px-3 py-2 rounded-xl border border-[#d5e3d6] text-xs" /></div>
            <div><label class="block text-xs font-bold mb-1">Catatan</label>
              <textarea id="mf-notes" rows="2" class="w-full px-3 py-2 rounded-xl border border-[#d5e3d6] text-xs">${escapeHtml(r.notes)}</textarea></div>
            <label class="inline-flex items-center gap-2 text-xs font-semibold">
              <input id="mf-stop" type="checkbox" ${r.stopped ? 'checked' : ''} /> <span>Tandai dihentikan (tidak dipantau)</span>
            </label>
            <button type="submit" class="w-full py-3 rounded-xl bg-[#2d5a3c] hover:bg-[#4a7c59] text-white font-bold text-sm">Simpan</button>
          </form>
        </div>
      </div>`;
    if (window.lucide) lucide.createIcons();
  };

  window.monAutoEnd = function () {
    const start = document.getElementById('mf-start').value;
    const dur = document.getElementById('mf-dur').value;
    const end = addDuration(start, dur);
    if (end) document.getElementById('mf-end').value = end;
  };

  window.monSave = function (e, id) {
    e.preventDefault();
    const g = (x) => document.getElementById(x).value.trim();
    const data = {
      customerName: g('mf-name'),
      whatsapp: g('mf-wa'),
      email: g('mf-email'),
      productName: g('mf-prod'),
      plan: g('mf-plan'),
      duration: g('mf-dur'),
      startDate: document.getElementById('mf-start').value,
      endDate: document.getElementById('mf-end').value,
      accountInfo: g('mf-acc'),
      orderNumber: g('mf-order'),
      notes: g('mf-notes'),
      stopped: document.getElementById('mf-stop').checked,
      updatedAt: new Date().toISOString()
    };
    let item;
    if (id) {
      const idx = mon.items.findIndex(i => i.id === id);
      if (idx === -1) return;
      item = { ...mon.items[idx], ...data };
      mon.items[idx] = item;
    } else {
      item = { id: 'mon-' + Date.now() + '-' + Math.floor(Math.random() * 1000), createdAt: new Date().toISOString(), ...data };
      mon.items.unshift(item);
    }
    persist();
    cloudSave(item);
    closeModal();
    renderApp();
    showToast('Data monitoring tersimpan.');
  };

  window.monDelete = function (id) {
    if (!confirm('Hapus data monitoring ini?')) return;
    mon.items = mon.items.filter(i => i.id !== id);
    persist();
    cloudDelete(id);
    renderApp();
    showToast('Data monitoring dihapus.');
  };

  window.monRenew = function (id) {
    const idx = mon.items.findIndex(i => i.id === id);
    if (idx === -1) return;
    const r = mon.items[idx];
    if (!r.duration || !addDuration(todayStr(), r.duration)) {
      showToast('Isi durasi (mis. "1 Bulan") dulu lewat Edit untuk perpanjang otomatis.', 'error');
      return;
    }
    // perpanjang dari tanggal berakhir bila masih aktif, kalau sudah lewat mulai dari hari ini
    const base = r.endDate && daysLeft(r.endDate) >= 0 ? r.endDate : todayStr();
    const item = { ...r, startDate: base, endDate: addDuration(base, r.duration), stopped: false, updatedAt: new Date().toISOString() };
    mon.items[idx] = item;
    persist();
    cloudSave(item);
    renderApp();
    showToast(`Diperpanjang sampai ${fmtDate(item.endDate)}.`);
  };

  window.monImportFromOrders = function () {
    const okStatuses = ['Paid', 'In Progress', 'Revision', 'Completed'];
    const existing = new Set(mon.items.map(i => i.sourceKey).filter(Boolean));
    let added = 0;
    state.orders.filter(o => okStatuses.includes(o.status)).forEach(o => {
      (o.items || []).forEach((it, idx) => {
        const key = `${o.orderNumber}#${idx}`;
        if (existing.has(key)) return;
        const start = (o.createdAt || new Date().toISOString()).slice(0, 10);
        const item = {
          id: 'mon-' + Date.now() + '-' + Math.floor(Math.random() * 100000),
          sourceKey: key,
          customerName: o.customerName,
          whatsapp: o.customerWhatsapp,
          email: '',
          productName: it.productName,
          plan: it.plan,
          duration: it.duration,
          startDate: start,
          endDate: addDuration(start, it.duration),
          accountInfo: it.customBrief?.targetAccount || '',
          orderNumber: o.orderNumber,
          notes: o.customerNotes || '',
          stopped: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        mon.items.unshift(item);
        cloudSave(item);
        added++;
      });
    });
    persist();
    renderApp();
    showToast(added ? `${added} data berhasil diimpor dari pesanan.` : 'Tidak ada pesanan baru (Paid/Completed) untuk diimpor.', added ? 'success' : 'error');
  };

  window.monExportCsv = function () {
    const head = ['Nama', 'WhatsApp', 'Email', 'Produk', 'Plan', 'Durasi', 'Mulai', 'Berakhir', 'Status', 'Info Akun', 'No Pesanan', 'Catatan'];
    const cell = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const lines = [head.map(cell).join(',')];
    mon.items.forEach(r => {
      lines.push([r.customerName, r.whatsapp, r.email, r.productName, r.plan, r.duration, r.startDate, r.endDate, computeStatus(r), r.accountInfo, r.orderNumber, r.notes].map(cell).join(','));
    });
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `monitoring-${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ---------- Pasang ke dashboard yang sudah ada ----------
  if (!ADMIN_MENUS.some(m => m.id === 'monitoring')) {
    ADMIN_MENUS.push({ id: 'monitoring', label: '15. Database Monitoring', icon: 'database' });
  }

  const _origPanel = renderAdminPanelContent;
  renderAdminPanelContent = function (activeMenu) {
    if (activeMenu.id === 'monitoring') return renderMonitoringPanel();
    const html = _origPanel(activeMenu);
    if (activeMenu.id === 'summary') {
      const soon = mon.items.filter(r => computeStatus(r) === 'Akan Habis').length;
      const exp = mon.items.filter(r => computeStatus(r) === 'Expired').length;
      if (soon + exp > 0) {
        return `
          <div class="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-3">
            <span><strong>Pengingat Monitoring:</strong> ${soon} layanan akan habis ≤3 hari, ${exp} sudah expired.</span>
            <button onclick="setAdminMenu('monitoring')" class="px-3 py-1.5 rounded-lg bg-amber-200 hover:bg-amber-300 font-bold">Buka Database Monitoring</button>
          </div>` + html;
      }
    }
    return html;
  };

  // Jika halaman sudah ter-render sebelum script ini dimuat, render ulang
  try { renderApp(); } catch (e) { console.error(e); }
})();