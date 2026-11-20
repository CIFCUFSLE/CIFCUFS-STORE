/*
  INTEGRASI KE WEBSITE CIFCUFS STORE YANG SUDAH ADA
  1) Simpan file ini bersama admin.html dan server.js pada folder project.
  2) Tambahkan pemanggilan syncOrderToServer(newOrder) tepat setelah
     state.orders.unshift(newOrder) pada fungsi checkout yang sudah ada.
  3) Tambahkan syncPaymentToServer(order) setelah customer mengunggah bukti transfer.
  4) Untuk migrasi, buka website lama pada browser yang sama, login admin
     pada /admin.html, lalu jalankan migrateOldLocalOrders() dari Console browser.
*/
async function syncOrderToServer(order) {
  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(order)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Gagal sinkronisasi pesanan");
    console.info("Pesanan tersimpan di server:", result.orderNumber);
    return true;
  } catch (error) {
    console.error("Pesanan masih tersimpan di browser, tetapi gagal dikirim ke server:", error);
    alert("Pesanan belum berhasil tersinkron ke server. Hubungi admin dan jangan tutup halaman sebelum mencoba kembali.");
    return false;
  }
}

async function syncPaymentToServer(order) {
  if (!order?.orderNumber) return false;
  const response = await fetch(`/api/orders/${encodeURIComponent(order.orderNumber)}/payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      paymentMethod: order.paymentMethod,
      paymentProofImage: order.paymentProofImage
    })
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "Gagal menyinkronkan bukti pembayaran");
  }
  return true;
}

async function migrateOldLocalOrders() {
  const key = "galeyn_orders_v1";
  const oldOrders = JSON.parse(localStorage.getItem(key) || "[]");
  if (!oldOrders.length) {
    console.log("Tidak ada data pesanan lama pada key", key);
    return;
  }
  const response = await fetch("/api/admin/import-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ orders: oldOrders })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Import gagal");
  console.log(`Migrasi selesai: ${result.imported} dari ${result.received} pesanan baru diimpor.`);
}
