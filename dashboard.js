/* =========================================================================
   DASHBOARD.JS — Ganti menu "1. Ringkasan Dashboard" dengan dashboard lengkap
   CIFCUFS STORE (tanpa library tambahan, grafik pakai SVG).

   CARA PASANG di index.html, sebelum </body>, setelah </script> utama:

       <script src="dashboard.js"></script>
       <script src="monitoring.js"></script>   <!-- dashboard.js harus DI ATAS monitoring.js -->

   Isi dashboard:
   - Filter periode 7 / 30 / 90 hari
   - KPI: pendapatan periode, pendapatan bulan ini vs bulan lalu, total pesanan,
     pelanggan unik, rata-rata nilai pesanan, perlu tindakan
   - Grafik pendapatan (harian / mingguan)
   - Distribusi status pesanan
   - Produk terlaris & pendapatan per kategori
   - Pelanggan teratas
   - Antrean tindakan cepat (verifikasi pembayaran, mulai proses)
   - Pesanan terbaru
   ========================================================================= */
(function () {
  const PAID = ['Paid', 'In Progress', 'Revision', 'Completed'];
  const dash = { range: 30 };

  // ---------- helpers ----------
  const pad = (n) => String(n).padStart(2, '0');
  const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const short = (n) => {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.0', '') + ' jt';
    if (n >= 1e3) return Math.round(n / 1e3) + ' rb';
    return String(n);
  };
  const orderTotal = (o) => Number(o.totalAmount || 0);
  const isPaid = (o) => PAID.includes(o.status);

  function monthRevenue(offset) {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return state.orders.filter(o => {
      if (!isPaid(o)) return false;
      const d = new Date(o.createdAt);
      return d.getFullYear() === target.getFullYear() && d.getMonth() === target.getMonth();
    }).reduce((s, o) => s + orderTotal(o), 0);
  }

  function buildSeries(orders, range) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const weekly = range > 30;
    const buckets = [];
    if (!weekly) {
      for (let i = range - 1; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        buckets.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, start: new Date(d), end: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1), value: 0, count: 0 });
      }
    } else {
      const weeks = Math.ceil(range / 7);
      for (let i = weeks - 1; i >= 0; i--) {
        const end = new Date(now); end.setDate(end.getDate() - i * 7 + 1);
        const start = new Date(end); start.setDate(start.getDate() - 7);
        buckets.push({ label: `${start.getDate()}/${start.getMonth() + 1}`, start, end, value: 0, count: 0 });
      }
    }
    orders.forEach(o => {
      const t = new Date(o.createdAt);
      const b = buckets.find(x => t >= x.start && t < x.end);
      if (b) { b.value += orderTotal(o); b.count += 1; }
    });
    return buckets;
  }

  function chartSvg(series) {
    const W = 640, H = 190, padL = 38, padB = 22, padT = 10;
    const max = Math.max(1, ...series.map(s => s.value));
    const innerW = W - padL - 8, innerH = H - padB - padT;
    const bw = innerW / series.length;
    const labelEvery = series.length > 15 ? Math.ceil(series.length / 8) : 1;
    const grid = [0, 0.5, 1].map(f => {
      const y = padT + innerH - innerH * f;
      return `<line x1="${padL}" x2="${W - 8}" y1="${y}" y2="${y}" stroke="#e6efe6" /><text x="${padL - 6}" y="${y + 3}" font-size="9" text-anchor="end" fill="#647568">${short(max * f)}</text>`;
    }).join('');
    const bars = series.map((s, i) => {
      const h = (s.value / max) * innerH;
      const x = padL + i * bw + bw * 0.15;
      const y = padT + innerH - h;
      const lbl = i % labelEvery === 0 ? `<text x="${x + bw * 0.35}" y="${H - 6}" font-size="9" text-anchor="middle" fill="#647568">${s.label}</text>` : '';
      return `<g><rect x="${x}" y="${s.value ? y : padT + innerH - 1}" width="${bw * 0.7}" height="${s.value ? h : 1}" rx="3" fill="${s.value ? '#2d5a3c' : '#d5e3d6'}"><title>${s.label}: ${formatRupiah(s.value) === 'Harga belum tersedia' ? 'Rp 0' : formatRupiah(s.value)} (${s.count} pesanan)</title></rect>${lbl}</g>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="w-full h-auto" role="img" aria-label="Grafik pendapatan">${grid}${bars}</svg>`;
  }

  const rp = (n) => (Number(n) > 0 ? formatRupiah(n) : 'Rp 0');

  // ---------- render ----------
  function renderDashboardSummary() {
    const now = new Date();
    const since = new Date(now); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - (dash.range - 1));
    const inRange = state.orders.filter(o => new Date(o.createdAt) >= since);
    const paidRange = inRange.filter(isPaid);

    const revenue = paidRange.reduce((s, o) => s + orderTotal(o), 0);
    const aov = paidRange.length ? revenue / paidRange.length : 0;
    const thisM = monthRevenue(0), lastM = monthRevenue(-1);
    const growth = lastM > 0 ? Math.round(((thisM - lastM) / lastM) * 100) : null;
    const customers = new Set(inRange.map(o => (o.customerWhatsapp || '').replace(/\D/g, '') || o.customerName)).size;
    const needAction = state.orders.filter(o => ['Waiting for Verification', 'Paid', 'Revision'].includes(o.status)).length;

    // status distribution
    const statusCount = ORDER_STATUSES.map(s => ({ s, n: state.orders.filter(o => o.status === s).length }));
    const maxStatus = Math.max(1, ...statusCount.map(x => x.n));

    // top produk & kategori (dari pesanan terbayar pada periode)
    const prodMap = {}, catMap = {};
    paidRange.forEach(o => (o.items || []).forEach(it => {
      const p = prodMap[it.productName] || (prodMap[it.productName] = { name: it.productName, qty: 0, rev: 0 });
      p.qty += Number(it.quantity || 0); p.rev += Number(it.subtotal || 0);
      const cn = it.categoryName || 'Lainnya';
      catMap[cn] = (catMap[cn] || 0) + Number(it.subtotal || 0);
    }));
    const topProducts = Object.values(prodMap).sort((a, b) => b.rev - a.rev).slice(0, 5);
    const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    const maxCat = Math.max(1, ...cats.map(c => c[1]));

    // pelanggan teratas
    const custMap = {};
    state.orders.filter(isPaid).forEach(o => {
      const k = (o.customerWhatsapp || '').replace(/\D/g, '') || o.customerName;
      const c = custMap[k] || (custMap[k] = { name: o.customerName, wa: o.customerWhatsapp, orders: 0, spent: 0 });
      c.orders += 1; c.spent += orderTotal(o);
    });
    const topCustomers = Object.values(custMap).sort((a, b) => b.spent - a.spent).slice(0, 5);

    const toVerify = state.orders.filter(o => o.status === 'Waiting for Verification').slice(0, 5);
    const toProcess = state.orders.filter(o => o.status === 'Paid').slice(0, 5);

    const kpis = [
      { label: `Pendapatan ${dash.range} Hari`, value: rp(revenue), sub: `${paidRange.length} pesanan terbayar` },
      { label: 'Pendapatan Bulan Ini', value: rp(thisM), sub: growth === null ? 'Belum ada pembanding bulan lalu' : `${growth >= 0 ? '▲' : '▼'} ${Math.abs(growth)}% vs bulan lalu`, subClass: growth === null ? '' : growth >= 0 ? 'text-emerald-700' : 'text-[#d94e4e]' },
      { label: 'Pesanan Masuk', value: inRange.length, sub: `${state.orders.length} total keseluruhan` },
      { label: 'Pelanggan Unik', value: customers, sub: `dalam ${dash.range} hari` },
      { label: 'Rata-rata Pesanan', value: rp(aov), sub: 'dari pesanan terbayar' },
      { label: 'Perlu Tindakan', value: needAction, sub: 'verifikasi / proses / revisi', subClass: needAction ? 'text-amber-700' : '' }
    ];

    const empty = (t) => `<p class="text-xs text-[#4e6355] py-6 text-center">${t}</p>`;

    return `
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-extrabold text-[#181f1a]">Ringkasan Dashboard</h2>
          <p class="text-xs text-[#4e6355]">Pantau penjualan, status pesanan, dan antrean kerja dalam satu layar.</p>
        </div>
        <div class="flex gap-1.5">
          ${[7, 30, 90].map(r => `<button onclick="dashSetRange(${r})" class="px-3.5 py-2 rounded-xl text-xs font-bold ${dash.range === r ? 'bg-[#2d5a3c] text-white' : 'bg-white border border-[#d5e3d6] text-[#43574a] hover:bg-[#e6efe6]'}">${r} Hari</button>`).join('')}
        </div>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
        ${kpis.map(k => `
          <div class="bg-white border border-[#d5e3d6] rounded-2xl p-4 shadow-2xs">
            <span class="text-[11px] font-semibold text-[#4e6355]">${k.label}</span>
            <p class="text-lg sm:text-xl font-extrabold text-[#181f1a] mt-1 break-words">${k.value}</p>
            <p class="text-[11px] mt-0.5 ${k.subClass || 'text-[#718174]'}">${k.sub}</p>
          </div>`).join('')}
      </div>

      <div class="bg-white border border-[#d5e3d6] rounded-3xl p-6 shadow-2xs">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-extrabold text-base">Grafik Pendapatan</h3>
          <span class="text-[11px] text-[#718174]">${dash.range > 30 ? 'per minggu' : 'per hari'} • hanya pesanan terbayar</span>
        </div>
        ${paidRange.length ? chartSvg(buildSeries(paidRange, dash.range)) : empty('Belum ada pesanan terbayar pada periode ini.')}
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div class="bg-white border border-[#d5e3d6] rounded-3xl p-6 shadow-2xs space-y-3">
          <h3 class="font-extrabold text-base">Antrean Tindakan Cepat</h3>
          <p class="text-[11px] font-bold uppercase tracking-wider text-[#4a7c59]">Menunggu Verifikasi (${state.orders.filter(o => o.status === 'Waiting for Verification').length})</p>
          ${toVerify.length === 0 ? empty('Tidak ada bukti transfer yang menunggu.') : toVerify.map(o => `
            <div class="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#f4f7f4] border border-[#d5e3d6]">
              <div class="min-w-0">
                <p class="text-xs font-bold truncate">${escapeHtml(o.orderNumber)} • ${escapeHtml(o.customerName)}</p>
                <p class="text-[11px] text-[#2d5a3c] font-bold">${rp(o.totalAmount)} • ${escapeHtml(o.paymentMethod || '-')}</p>
              </div>
              <div class="flex gap-1.5 shrink-0">
                <button onclick="openOrderInspectModal('${o.id}')" class="px-2.5 py-1.5 rounded-lg bg-white border border-[#d5e3d6] text-[11px] font-bold">Cek</button>
                <button onclick="updateAdminOrderStatus('${o.id}','Paid')" class="px-2.5 py-1.5 rounded-lg bg-[#2d5a3c] text-white text-[11px] font-bold">Setujui</button>
              </div>
            </div>`).join('')}
          <p class="text-[11px] font-bold uppercase tracking-wider text-[#4a7c59] pt-2">Siap Dikerjakan (${state.orders.filter(o => o.status === 'Paid').length})</p>
          ${toProcess.length === 0 ? empty('Tidak ada pesanan yang menunggu diproses.') : toProcess.map(o => `
            <div class="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#f4f7f4] border border-[#d5e3d6]">
              <div class="min-w-0">
                <p class="text-xs font-bold truncate">${escapeHtml(o.orderNumber)} • ${escapeHtml(o.customerName)}</p>
                <p class="text-[11px] text-[#4e6355] truncate">${(o.items || []).map(i => escapeHtml(i.productName)).join(', ')}</p>
              </div>
              <button onclick="updateAdminOrderStatus('${o.id}','In Progress')" class="px-2.5 py-1.5 rounded-lg bg-[#e6efe6] text-[#2d5a3c] text-[11px] font-bold shrink-0">Mulai Proses</button>
            </div>`).join('')}
        </div>

        <div class="bg-white border border-[#d5e3d6] rounded-3xl p-6 shadow-2xs space-y-3">
          <h3 class="font-extrabold text-base">Status Pesanan</h3>
          ${statusCount.map(x => `
            <div class="flex items-center gap-3 text-xs">
              <span class="w-36 shrink-0 font-semibold text-[#43574a]">${x.s}</span>
              <div class="flex-1 h-2.5 rounded-full bg-[#eef4ef] overflow-hidden"><div class="h-full rounded-full bg-[#4a7c59]" style="width:${(x.n / maxStatus) * 100}%"></div></div>
              <span class="w-6 text-right font-extrabold">${x.n}</span>
            </div>`).join('')}
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div class="bg-white border border-[#d5e3d6] rounded-3xl p-6 shadow-2xs space-y-3">
          <h3 class="font-extrabold text-base">Produk Terlaris</h3>
          ${topProducts.length === 0 ? empty('Belum ada data penjualan.') : topProducts.map((p, i) => `
            <div class="flex items-center justify-between gap-2 text-xs">
              <span class="min-w-0 truncate"><strong>${i + 1}.</strong> ${escapeHtml(p.name)} <span class="text-[#718174]">(${p.qty}x)</span></span>
              <span class="font-extrabold text-[#2d5a3c] shrink-0">${rp(p.rev)}</span>
            </div>`).join('')}
        </div>

        <div class="bg-white border border-[#d5e3d6] rounded-3xl p-6 shadow-2xs space-y-3">
          <h3 class="font-extrabold text-base">Pendapatan per Kategori</h3>
          ${cats.length === 0 ? empty('Belum ada data penjualan.') : cats.map(([name, val]) => `
            <div class="text-xs space-y-1">
              <div class="flex justify-between"><span class="font-semibold truncate">${escapeHtml(name)}</span><span class="font-extrabold text-[#2d5a3c]">${rp(val)}</span></div>
              <div class="h-2 rounded-full bg-[#eef4ef] overflow-hidden"><div class="h-full rounded-full bg-[#2d5a3c]" style="width:${(val / maxCat) * 100}%"></div></div>
            </div>`).join('')}
        </div>

        <div class="bg-white border border-[#d5e3d6] rounded-3xl p-6 shadow-2xs space-y-3">
          <h3 class="font-extrabold text-base">Pelanggan Teratas</h3>
          ${topCustomers.length === 0 ? empty('Belum ada pelanggan.') : topCustomers.map((c, i) => `
            <div class="flex items-center justify-between gap-2 text-xs">
              <span class="min-w-0 truncate"><strong>${i + 1}.</strong> ${escapeHtml(c.name)} <span class="text-[#718174]">(${c.orders} pesanan)</span></span>
              <span class="font-extrabold text-[#2d5a3c] shrink-0">${rp(c.spent)}</span>
            </div>`).join('')}
        </div>
      </div>

      <div class="bg-white border border-[#d5e3d6] rounded-3xl p-6 space-y-4 shadow-2xs">
        <div class="flex items-center justify-between">
          <h3 class="font-extrabold text-base">Pesanan Terbaru</h3>
          <button onclick="setAdminMenu('orders')" class="text-xs font-bold text-[#2d5a3c] underline">Kelola Pesanan</button>
        </div>
        ${state.orders.length === 0 ? empty('Belum ada pesanan masuk.') : `
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs min-w-[560px]">
              <thead><tr class="border-b border-[#eef4ef] text-[#4e6355]">
                <th class="py-2.5">Waktu</th><th class="py-2.5">No. Pesanan</th><th class="py-2.5">Pelanggan</th><th class="py-2.5">Total</th><th class="py-2.5">Status</th>
              </tr></thead>
              <tbody class="divide-y divide-[#eef4ef]">
                ${state.orders.slice(0, 8).map(o => `
                  <tr>
                    <td class="py-3 whitespace-nowrap text-[#4e6355]">${new Date(o.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td class="py-3 font-bold">${escapeHtml(o.orderNumber)}</td>
                    <td class="py-3">${escapeHtml(o.customerName)}</td>
                    <td class="py-3 font-bold text-[#2d5a3c]">${rp(o.totalAmount)}</td>
                    <td class="py-3"><span class="px-2.5 py-1 rounded-full text-[11px] font-bold border ${getStatusBadgeClass(o.status)}">${escapeHtml(o.status)}</span></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>`}
      </div>
    `;
  }

  window.dashSetRange = function (r) { dash.range = r; renderApp(); };

  // ---------- pasang ke dashboard yang sudah ada ----------
  const _orig = renderAdminPanelContent;
  renderAdminPanelContent = function (activeMenu) {
    if (activeMenu.id === 'summary') return renderDashboardSummary();
    return _orig(activeMenu);
  };

  try { renderApp(); } catch (e) { console.error(e); }
})();