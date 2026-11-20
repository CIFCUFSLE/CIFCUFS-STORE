require("dotenv").config();
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");

const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
  console.error("Isi ADMIN_NAME, ADMIN_EMAIL, dan ADMIN_PASSWORD (minimal 12 karakter) di .env.");
  process.exit(1);
}
const db = new Database(path.join(__dirname, "data.sqlite"));
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, order_number TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL, customer_whatsapp TEXT NOT NULL,
    customer_notes TEXT DEFAULT '', items_json TEXT NOT NULL,
    total_amount INTEGER NOT NULL DEFAULT 0, payment_method TEXT DEFAULT '',
    payment_proof_image TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'Waiting for Payment',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
`);
const hash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
db.prepare(`
  INSERT INTO admins (name, email, password_hash)
  VALUES (?, ?, ?)
  ON CONFLICT(email) DO UPDATE SET name=excluded.name, password_hash=excluded.password_hash
`).run(ADMIN_NAME, ADMIN_EMAIL.toLowerCase(), hash);
console.log("Admin berhasil dibuat/diperbarui:", ADMIN_EMAIL);
db.close();
