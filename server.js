import express from 'express';
import cors from 'cors';
import { JSONFilePreset } from 'lowdb/node';

const app = express();
const PORT = process.env.PORT || 3000;

// Inisialisasi file database otomatis: db.json (orders + reviews)
const defaultData = { orders: [], reviews: [] };
const db = await JSONFilePreset('db.json', defaultData);

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.static('.'));

// 1. AMBIL SEMUA PESANAN
app.get('/api/orders', async (req, res) => {
  await db.read();
  res.json(db.data.orders || []);
});

// 2. SIMPAN PESANAN BARU
app.post('/api/orders', async (req, res) => {
  const newOrder = req.body;
  if (!newOrder || !newOrder.id) {
    return res.status(400).json({ error: 'Data pesanan tidak valid' });
  }
  await db.read();
  db.data.orders = db.data.orders || [];
  db.data.orders.unshift(newOrder);
  await db.write();
  console.log(`[ORDER BARU] ${newOrder.orderNumber} - ${newOrder.customerName}`);
  res.status(201).json({ success: true, order: newOrder });
});

// 3. UPDATE BUKTI BAYAR ATAU STATUS PESANAN
app.patch('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  await db.read();
  const idx = (db.data.orders || []).findIndex((o) => o.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  }
  db.data.orders[idx] = { ...db.data.orders[idx], ...updates };
  await db.write();
  console.log(`[UPDATE ORDER] ${id} -> ${updates.status || 'Bukti diunggah'}`);
  res.json({ success: true, order: db.data.orders[idx] });
});

// 4. AMBIL SEMUA REVIEW PELANGGAN ASLI
app.get('/api/reviews', async (req, res) => {
  await db.read();
  res.json(db.data.reviews || []);
});

// 5. SIMPAN REVIEW PELANGGAN BARU
app.post('/api/reviews', async (req, res) => {
  const newReview = req.body;
  if (!newReview || !newReview.name || !newReview.review) {
    return res.status(400).json({ error: 'Data review tidak lengkap' });
  }
  await db.read();
  db.data.reviews = db.data.reviews || [];
  db.data.reviews.unshift(newReview);
  await db.write();
  console.log(`[REVIEW BARU] ${newReview.name} (${newReview.rating}★) - ${newReview.service}`);
  res.status(201).json({ success: true, review: newReview });
});

app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`DATABASE & SERVER CIFCUFS STORE AKTIF!`);
  console.log(`Port aktif: ${PORT}`);
  console.log(`File database tersimpan di: db.json`);
  console.log('====================================================');
});