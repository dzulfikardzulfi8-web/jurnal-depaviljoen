const express = require('express');
const session = require('express-session');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');

const app = express();
const port = process.env.PORT || 3000;

const db = new sqlite3.Database('jurnal.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      nama TEXT UNIQUE,
      password TEXT,
      divisi TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS jurnal (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      tanggal TEXT,
      divisi TEXT,
      kegiatan TEXT,
      kegiatan_custom TEXT,
      foto TEXT
    )
  `);
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use(session({
  secret: 'paviljoen',
  resave: false,
  saveUninitialized: true
}));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    require('fs').mkdirSync('uploads', { recursive: true });
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, Date.now() + '-' + safeName);
  }
});

const upload = multer({ storage });

function cekLogin(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/');
  }
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function namaDivisi(divisi) {
  const map = {
    'IT': 'IT',
    'Front Office': 'FRONT OFFICE',
    'House Keeping': 'HOUSE KEEPING',
    'Engineering': 'ENGINEERING',
    'F&B Service': 'F&B SERVICE',
    'F&BP': 'F&B PRODUCT',
    'HRD': 'HRD',
    'Accounting': 'ACCOUNTING',
    'Sales': 'SALES'
  };

  return map[divisi] || String(divisi || '').toUpperCase();
}

function namaTanpaPrefix(nama) {
  return String(nama || '')
    .replace(/^IT_/i, '')
    .replace(/^FO_/i, '')
    .replace(/^HK_/i, '')
    .replace(/^ENG_/i, '')
    .replace(/^FBS_/i, '')
    .replace(/^FBP_/i, '')
    .replace(/^HRD_/i, '')
    .replace(/^ACC_/i, '')
    .replace(/^SLS_/i, '');
}

function iconDivisi(divisi) {
  const map = {
    'IT': '💻',
    'Front Office': '🛎️',
    'House Keeping': '🧹',
    'Engineering': '🛠️',
    'F&B Service': '🍽️',
    'F&BP': '🍳',
    'HRD': '🧑‍💼',
    'Accounting': '💰',
    'Sales': '📈'
  };

  return map[divisi] || '🏢';
}

function daftarKegiatanDivisi(divisi) {
  const kegiatan = {
    'IT': [
      'Instal ulang pc/laptop',
      'Checklist server jaringan',
      'Crimping kabel LAN',
      'Mengganti sparepart komputer/laptop',
      'Membuat website',
      'Input atau update data',
      'Memperbaiki komputer',
      'cloning TV'
    ],

    'Front Office': [
      'Melayani check-in tamu',
      'Melayani check-out tamu',
      'Menerima telepon',
      'Memberikan informasi kepada tamu',
      'Membantu reservasi kamar',
      'Menangani permintaan tamu',
      'Menangani komplain tamu',
      'Mengecek status kamar',
      'Membuat laporan Front Office'
    ],

    'House Keeping': [
      'Membersihkan kamar',
      'Membersihkan kamar mandi',
      'Merapikan tempat tidur',
      'Mengganti linen',
      'Mengganti handuk',
      'Melengkapi amenities',
      'Membersihkan area hotel',
      'Mengecek kelengkapan kamar',
      'Membuat laporan House Keeping'
    ],

    'Engineering': [
      'Mengecek fasilitas hotel',
      'Melakukan maintenance',
      'Mengecek listrik',
      'Mengecek AC',
      'Memperbaiki fasilitas rusak',
      'Mengecek peralatan engineering',
      'Melakukan pengecekan rutin',
      'Membuat laporan Engineering'
    ],

    'F&B Service': [
      'Menyiapkan meja',
      'Melayani tamu',
      'Mengambil pesanan',
      'Menyiapkan peralatan makan',
      'Menyiapkan makanan',
      'Menyiapkan minuman',
      'Membersihkan area restoran',
      'Melayani breakfast',
      'Membuat laporan F&B Service'
    ],

    'F&BP': [
      'Menyiapkan bahan makanan',
      'Memasak menu harian',
      'Mengecek kualitas bahan baku',
      'Membuat garnish/plating',
      'Menjaga kebersihan dapur',
      'Mengecek stok bahan makanan',
      'Menyimpan bahan sesuai SOP',
      'Membuat laporan F&B Product'
    ],

    'HRD': [
      'Melakukan absensi karyawan/trainee',
      'Menginput data karyawan/trainee',
      'Mengurus administrasi trainee',
      'Melakukan briefing/orientasi',
      'Menangani surat menyurat',
      'Mengecek kelengkapan dokumen',
      'Membuat laporan HRD'
    ],

    'Accounting': [
      'Mencatat transaksi harian',
      'Membuat laporan keuangan',
      'Mengecek invoice/nota',
      'Melakukan rekonsiliasi kas',
      'Menginput data pengeluaran',
      'Menginput data pemasukan',
      'Membuat laporan Accounting'
    ],

    'Sales': [
      'Melakukan penawaran ke klien',
      'Follow up calon tamu/klien',
      'Membuat laporan penjualan',
      'Mengecek target sales',
      'Menghubungi corporate/agent',
      'Membuat proposal kerjasama',
      'Membuat laporan Sales'
    ]
  };

  return kegiatan[divisi] || ['Kegiatan lainnya'];
};


/* =========================================================
   HALAMAN LOGIN + DAFTAR
========================================================= */

app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');

  res.send(`<!DOCTYPE html>
<html lang="id">
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>De Paviljoen - Jurnal Trainee</title>

<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');

*{
  margin:0;
  padding:0;
  box-sizing:border-box;
  font-family:Poppins,sans-serif
}

body{
  background:#020206;
  min-height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden
}

body.lit{
  background:#1a1600
}

.container{
  width:95%;
  max-width:950px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:30px;
  z-index:5
}

.lamp-side{
  flex:1;
  display:flex;
  flex-direction:column;
  align-items:center
}

.form-side{
  flex:1;
  max-width:400px;
  opacity:0;
  pointer-events:none
}

@keyframes munculForm{
  0%{
    opacity:0;
    transform:translateY(80px) scale(.85);
    filter:blur(10px)
  }
  60%{
    opacity:.8;
    transform:translateY(-10px) scale(1.02);
    filter:blur(0)
  }
  100%{
    opacity:1;
    transform:translateY(0) scale(1);
    filter:blur(0)
  }
}

body.lit .form-side{
  animation:munculForm .9s cubic-bezier(.34,1.56,.64,1) forwards;
  pointer-events:all
}

body:not(.lit) .form-side{
  opacity:0;
  transform:translateY(40px)
}

.lamp{
  position:relative;
  width:200px;
  height:320px;
  cursor:pointer
}

.shade{
  width:190px;
  height:75px;
  background:#2a2a2a;
  border-radius:90px 90px 12px 12px;
  transition:.5s
}

body.lit .shade{
  background:#FFF7CC;
  box-shadow:0 10px 40px #FFD700,0 20px 90px rgba(255,180,0,.6)
}

.pole{
  width:20px;
  height:170px;
  background:#3a3a3a;
  margin:0 auto;
  margin-top:-6px;
  transition:.5s
}

body.lit .pole{
  background:#EAE7D6
}

.base{
  width:110px;
  height:18px;
  background:#3a3a3a;
  border-radius:10px;
  margin:0 auto;
  margin-top:-2px;
  transition:.5s
}

body.lit .base{
  background:#EAE7D6
}

.chain{
  position:absolute;
  right:62px;
  top:68px;
  width:2px;
  height:90px;
  transform-origin:top;
  transition:.2s
}

.chain .line{
  width:2px;
  height:100%;
  background:#666
}

.chain .dot{
  width:14px;
  height:14px;
  background:#FFEB99;
  border-radius:50%;
  transform:translateX(-6px);
  margin-top:-3px
}

.lamp.pulled .chain{
  transform:translateY(25px)
}

.glow{
  position:absolute;
  top:70px;
  left:50%;
  transform:translateX(-50%);
  width:400px;
  height:400px;
  background:radial-gradient(ellipse at 50% 0%,rgba(255,210,0,.35) 0%,transparent 70%);
  opacity:0;
  transition:.6s;
  pointer-events:none
}

body.lit .glow{
  opacity:1;
  animation:pulseGlow 2s infinite alternate
}

@keyframes pulseGlow{
  0%{
    transform:translateX(-50%) scale(1);
    opacity:.35
  }
  100%{
    transform:translateX(-50%) scale(1.1);
    opacity:.5
  }
}

.card{
  background:rgba(25,25,30,.95);
  border:1px solid rgba(255,255,255,.1);
  border-radius:20px;
  padding:26px;
  position:relative;
  overflow:hidden
}

.card::before{
  content:'';
  position:absolute;
  top:-50%;
  left:-50%;
  width:200%;
  height:200%;
  background:linear-gradient(120deg,transparent 30%,rgba(255,215,0,.15) 50%,transparent 70%);
  transform:translateX(-100%)
}

body.lit .card::before{
  animation:shine 1.2s .6s ease forwards
}

@keyframes shine{
  0%{transform:translateX(-100%)}
  100%{transform:translateX(100%)}
}

.card h2{
  color:#fff;
  text-align:center;
  font-size:20px;
  margin-bottom:18px
}

.tab{
  display:flex;
  background:#1C1C20;
  border-radius:12px;
  padding:4px;
  margin-bottom:20px
}

.tab button{
  flex:1;
  padding:10px;
  border:none;
  border-radius:8px;
  background:transparent;
  color:#888;
  font-weight:600;
  cursor:pointer;
  transition:.3s
}

.tab button.on{
  background:#fff;
  color:#000;
  transform:scale(1.05)
}

label{
  font-size:12px;
  color:#fff;
  opacity:.8;
  margin-top:10px;
  display:block
}

select,.normal{
  width:100%;
  padding:13px 14px;
  margin:6px 0;
  border-radius:12px;
  border:1px solid #333;
  background:#222;
  color:#fff;
  outline:none
}

.input-group{
  display:flex;
  align-items:center;
  background:#222;
  border:1px solid #333;
  border-radius:12px;
  margin:6px 0;
  transition:.3s
}

.input-group:focus-within{
  border-color:#FFD700;
  box-shadow:0 0 15px rgba(255,215,0,.2)
}

.input-group.disabled{
  opacity:.4;
  pointer-events:none
}

.prefix{
  padding:13px 0 13px 14px;
  color:#FFD700;
  font-weight:700;
  white-space:nowrap
}

.input-group input{
  flex:1;
  border:none;
  background:transparent;
  padding:13px 6px;
  outline:none;
  color:#fff
}

.btn{
  width:100%;
  padding:14px;
  background:#FFD700;
  color:#000;
  font-weight:700;
  border:none;
  border-radius:12px;
  margin-top:14px;
  cursor:pointer;
  transition:.2s
}

.btn:active{
  transform:scale(.97)
}

.btn:disabled{
  background:#333;
  color:#666
}

.sub{
  font-size:11px;
  text-align:center;
  color:#fff;
  opacity:.4;
  margin-top:12px
}

.form-error{
  display:none;
  color:#ff6b6b;
  font-size:11px;
  margin:-1px 0 8px 3px;
}

.form-success{
  color:#72e6a5;
  font-size:11px;
  margin:-5px 0 10px 3px;
  text-align:center;
}

.input-error{
  border-color:#ff5c5c !important;
  box-shadow:0 0 12px rgba(255,92,92,.12);
}

::placeholder{
  color:#888
}

@media(max-width:750px){
  body{
    overflow:auto;
    padding:20px 0
  }

  .container{
    flex-direction:column
  }

  .lamp{
    width:140px;
    height:220px
  }

  .shade{
    width:130px;
    height:50px
  }

  .pole{
    height:110px
  }

  .form-side{
    width:100%;
    max-width:400px
  }
}

/* ==== TAMBAHAN: preview logo divisi ==== */
.divisi-preview{
  display:none;
  align-items:center;
  gap:12px;
  margin:8px 0 4px;
  padding:11px 14px;
  border-radius:12px;
  background:linear-gradient(135deg,#242018,#1c1c20);
  border:1px solid #4d431e;
  animation:munculDivisi .35s ease
}

.divisi-preview.show{
  display:flex
}

.divisi-preview .divisi-emoji{
  font-size:24px;
  width:38px;
  height:38px;
  border-radius:10px;
  background:#FFD700;
  display:flex;
  align-items:center;
  justify-content:center;
  flex-shrink:0
}

.divisi-preview .divisi-label{
  color:#FFD700;
  font-weight:700;
  font-size:12px;
  letter-spacing:.5px
}

@keyframes munculDivisi{
  from{opacity:0;transform:translateY(-6px)}
  to{opacity:1;transform:translateY(0)}
}
</style>
</head>

<body>

<div class="container">

  <div class="lamp-side">

    <div class="lamp" id="lamp" onclick="tarik()">
      <div class="glow"></div>
      <div class="shade"></div>

      <div class="chain" id="chain">
        <div class="line"></div>
        <div class="dot"></div>
      </div>

      <div class="pole"></div>
      <div class="base"></div>
    </div>

  </div>

  <div class="form-side" id="formSide">

    <div class="card">

      <h2>JURNAL TRAINEE DPB</h2>

      <div id="fL">

        <form action="/login" method="POST" id="loginForm">

          <label>1. Pilih Divisi</label>

          <select id="loginDivisi" name="divisi" onchange="loginDivChange()" required>
            <option value="" disabled selected>-- Pilih Divisi --</option>
            <option value="IT">💻 IT</option>
            <option value="Front Office">🛎️ Front Office</option>
            <option value="House Keeping">🧹 House Keeping</option>
            <option value="Engineering">🛠️ Engineering</option>
            <option value="F&B Service">🍽️ F&B Service</option>
            <option value="F&BP">🍳 F&BP</option>
            <option value="HRD">🧑‍💼 HRD</option>
            <option value="Accounting">💰 Accounting</option>
            <option value="Sales">📈 Sales</option>
          </select>

          <div class="divisi-preview" id="loginDivisiPreview">
            <div class="divisi-emoji" id="loginDivisiEmoji"></div>
            <div class="divisi-label" id="loginDivisiLabel"></div>
          </div>

          <label>2. Nama Pengguna</label>

          <div class="input-group disabled" id="loginGroup">
            <span class="prefix" id="loginPref"></span>
            <input
              type="text"
              id="loginNamaOnly"
              placeholder="nama trainee"
              autocomplete="username"
              oninput="loginKetik()"
            >
          </div>

          <input type="hidden" name="nama" id="loginNamaF">

          <div class="form-error" id="usernameError">Nama belum terdaftar.</div>

          <label>Kata Sandi</label>

          <input
            class="normal"
            type="password"
            name="password"
            id="loginPassword"
            placeholder="Masukkan kata sandi"
            autocomplete="current-password"
            required
          >

          <div class="form-error" id="passwordError">Kata sandi salah.</div>

          <div class="form-error" id="loginGeneralError">Data login tidak benar.</div>

          <div class="form-success" id="registerSuccess"></div>

          <button class="btn">
            MASUK SEKARANG
          </button>

        </form>

        <div class="sub">
          Belum mempunyai akun? Silahkan hubungi admin/divisi IT untuk dibuatkan akun.
        </div>

      </div>

    </div>

  </div>

</div>

<script>

let lit = false;

function tarik(){

  const lamp = document.getElementById('lamp');

  lamp.classList.add('pulled');

  setTimeout(() => lamp.classList.remove('pulled'), 200);

  setTimeout(() => {

    lit = !lit;

    if(lit){

      document.body.classList.add('lit');

      setTimeout(() => document.body.classList.remove('lit'), 80);
      setTimeout(() => document.body.classList.add('lit'), 160);

    }else{

      document.body.classList.remove('lit');

    }

  },120);

}

const mp = {
  'IT':'IT_',
  'Front Office':'FO_',
  'House Keeping':'HK_',
  'Engineering':'ENG_',
  'F&B Service':'FBS_',
  'F&BP':'FBP_',
  'HRD':'HRD_',
  'Accounting':'ACC_',
  'Sales':'SLS_'
};

const divisiIcon = {
  'IT':{emoji:'💻',label:'IT'},
  'Front Office':{emoji:'🛎️',label:'FRONT OFFICE'},
  'House Keeping':{emoji:'🧹',label:'HOUSE KEEPING'},
  'Engineering':{emoji:'🛠️',label:'ENGINEERING'},
  'F&B Service':{emoji:'🍽️',label:'F&B SERVICE'},
  'F&BP':{emoji:'🍳',label:'F&B PRODUCT'},
  'HRD':{emoji:'🧑\u200d💼',label:'HRD'},
  'Accounting':{emoji:'💰',label:'ACCOUNTING'},
  'Sales':{emoji:'📈',label:'SALES'}
};

function tampilkanDivisiPreview(previewId, emojiId, labelId, divisi){

  const info = divisiIcon[divisi];

  const preview = document.getElementById(previewId);
  const emojiEl = document.getElementById(emojiId);
  const labelEl = document.getElementById(labelId);

  if(!preview || !emojiEl || !labelEl) return;

  if(!info){
    preview.classList.remove('show');
    return;
  }

  emojiEl.textContent = info.emoji;
  labelEl.textContent = info.label;
  preview.classList.add('show');

}

function loginDivChange(){

  const v = document.getElementById('loginDivisi').value;

  document.getElementById('loginPref').textContent = mp[v] || '';

  document.getElementById('loginGroup').classList.remove('disabled');

  tampilkanDivisiPreview('loginDivisiPreview','loginDivisiEmoji','loginDivisiLabel', v);

  document.getElementById('loginNamaOnly').focus();

  loginKetik();

}

function loginKetik(){

  let s = document
    .getElementById('loginNamaOnly')
    .value
    .toLowerCase()
    .replace(/[^a-z0-9]/g,'');

  document.getElementById('loginNamaOnly').value = s;

  const pref = document.getElementById('loginPref').textContent;

  document.getElementById('loginNamaF').value = pref + s;

}

function tampilkanPesanLogin(){

  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  const divisi = params.get('divisi') || '';
  const nama = params.get('nama') || '';

  if(error){
    lit = true;
    document.body.classList.add('lit');
  }

  if(divisi && mp[divisi]){
    const select = document.getElementById('loginDivisi');
    select.value = divisi;
    loginDivChange();

    let prefix = mp[divisi];
    let only = nama.startsWith(prefix) ? nama.slice(prefix.length) : nama;
    document.getElementById('loginNamaOnly').value = only;
    loginKetik();
  }

  if(error === 'user_not_found'){
    document.getElementById('usernameError').style.display = 'block';
    document.getElementById('loginNamaOnly').classList.add('input-error');
  }

  if(error === 'wrong_password'){
    document.getElementById('passwordError').style.display = 'block';
    document.getElementById('loginPassword').classList.add('input-error');
  }

  if(error === 'wrong_division'){
    document.getElementById('usernameError').textContent = 'Nama belum terdaftar pada divisi ini.';
    document.getElementById('usernameError').style.display = 'block';
    document.getElementById('loginNamaOnly').classList.add('input-error');
  }

  if(error === 'registered_exists'){
    document.getElementById('usernameError').textContent = 'Nama tersebut sudah terdaftar. Silakan login atau gunakan nama lain.';
    document.getElementById('usernameError').style.display = 'block';
    document.getElementById('loginNamaOnly').classList.add('input-error');
  }

  if(error === 'server'){
    document.getElementById('loginGeneralError').textContent = 'Terjadi kesalahan. Silakan coba lagi.';
    document.getElementById('loginGeneralError').style.display = 'block';
  }

  if(params.get('registered') === '1'){
    document.getElementById('registerSuccess').style.display = 'block';
  }

}

window.addEventListener('DOMContentLoaded', tampilkanPesanLogin);

</script>

</body>
</html>`);
});


/* =========================================================
   HALAMAN DAFTAR AKUN (KHUSUS ADMIN)
   Tidak ditautkan di halaman login publik.
   Buka langsung: /daftar-admin
========================================================= */

app.get('/daftar-admin', (req, res) => {

  res.send(`<!DOCTYPE html>
<html lang="id">
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Daftarkan Akun Trainee - Admin</title>

<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');

*{
  margin:0;
  padding:0;
  box-sizing:border-box;
  font-family:Poppins,sans-serif
}

body{
  background:#020206;
  min-height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:30px 0
}

.card{
  width:95%;
  max-width:400px;
  background:rgba(25,25,30,.95);
  border:1px solid rgba(255,255,255,.1);
  border-radius:20px;
  padding:26px
}

.card h2{
  color:#fff;
  text-align:center;
  font-size:20px;
  margin-bottom:8px
}

.card .tag{
  text-align:center;
  color:#FFD700;
  font-size:11px;
  letter-spacing:2px;
  margin-bottom:20px;
  display:block
}

label{
  font-size:12px;
  color:#fff;
  opacity:.8;
  margin-top:10px;
  display:block
}

select,.normal{
  width:100%;
  padding:13px 14px;
  margin:6px 0;
  border-radius:12px;
  border:1px solid #333;
  background:#222;
  color:#fff;
  outline:none
}

.input-group{
  display:flex;
  align-items:center;
  background:#222;
  border:1px solid #333;
  border-radius:12px;
  margin:6px 0;
  transition:.3s
}

.input-group:focus-within{
  border-color:#FFD700;
  box-shadow:0 0 15px rgba(255,215,0,.2)
}

.input-group.disabled{
  opacity:.4;
  pointer-events:none
}

.prefix{
  padding:13px 0 13px 14px;
  color:#FFD700;
  font-weight:700;
  white-space:nowrap
}

.input-group input{
  flex:1;
  border:none;
  background:transparent;
  padding:13px 6px;
  outline:none;
  color:#fff
}

.btn{
  width:100%;
  padding:14px;
  background:#FFD700;
  color:#000;
  font-weight:700;
  border:none;
  border-radius:12px;
  margin-top:14px;
  cursor:pointer;
  transition:.2s
}

.btn:disabled{
  background:#333;
  color:#666
}

.sub{
  font-size:11px;
  text-align:center;
  color:#fff;
  opacity:.4;
  margin-top:12px
}

.form-success{
  color:#72e6a5;
  font-size:11px;
  margin:-5px 0 10px 3px;
  text-align:center;
}

.form-error{
  display:none;
  color:#ff6b6b;
  font-size:11px;
  margin:-5px 0 10px 3px;
  text-align:center;
}

.divisi-preview{
  display:none;
  align-items:center;
  gap:12px;
  margin:8px 0 4px;
  padding:11px 14px;
  border-radius:12px;
  background:linear-gradient(135deg,#242018,#1c1c20);
  border:1px solid #4d431e
}

.divisi-preview.show{
  display:flex
}

.divisi-preview .divisi-emoji{
  font-size:24px;
  width:38px;
  height:38px;
  border-radius:10px;
  background:#FFD700;
  display:flex;
  align-items:center;
  justify-content:center;
  flex-shrink:0
}

.divisi-preview .divisi-label{
  color:#FFD700;
  font-weight:700;
  font-size:12px;
  letter-spacing:.5px
}

::placeholder{
  color:#888
}
</style>
</head>

<body>

<div class="card">

  <h2>DAFTARKAN AKUN TRAINEE</h2>
  <span class="tag">HALAMAN INI KHUSUS ADMIN / DIVISI IT</span>

  <div class="form-success" id="registerSuccess">Akun berhasil didaftarkan.</div>
  <div class="form-error" id="registerError">Nama tersebut sudah terdaftar. Gunakan nama lain.</div>

  <form action="/register" method="POST" onsubmit="return cek()">

    <label>1. Pilih Divisi (wajib)</label>

    <select id="divSel" onchange="divChange()">

      <option value="" disabled selected>-- Pilih Divisi --</option>

      <option value="IT">💻 IT</option>
      <option value="Front Office">🛎️ Front Office</option>
      <option value="House Keeping">🧹 House Keeping</option>
      <option value="Engineering">🛠️ Engineering</option>
      <option value="F&B Service">🍽️ F&B Service</option>
      <option value="F&BP">🍳 F&BP</option>
      <option value="HRD">🧑‍💼 HRD</option>
      <option value="Accounting">💰 Accounting</option>
      <option value="Sales">📈 Sales</option>

    </select>

    <div class="divisi-preview" id="divisiPreview">
      <div class="divisi-emoji" id="divisiEmoji"></div>
      <div class="divisi-label" id="divisiLabel"></div>
    </div>

    <label>2. Nama Trainee</label>

    <div class="input-group disabled" id="group">

      <span class="prefix" id="pref"></span>

      <input
        type="text"
        id="namaOnly"
        placeholder="nama trainee"
        oninput="ketik()"
      >

    </div>

    <input type="hidden" name="divisi" id="divH">
    <input type="hidden" name="nama" id="namaF">

    <label>Kata Sandi</label>

    <input
      class="normal"
      type="password"
      name="password"
      placeholder="Buat kata sandi"
      required
    >

    <button class="btn" id="btnD" disabled>
      DAFTARKAN AKUN
    </button>

  </form>

  <div class="sub">
    Nama otomatis mengikuti divisi. Contoh: IT_nama
  </div>

</div>

<script>

const mp = {
  'IT':'IT_',
  'Front Office':'FO_',
  'House Keeping':'HK_',
  'Engineering':'ENG_',
  'F&B Service':'FBS_',
  'F&BP':'FBP_',
  'HRD':'HRD_',
  'Accounting':'ACC_',
  'Sales':'SLS_'
};

const divisiIcon = {
  'IT':{emoji:'💻',label:'IT'},
  'Front Office':{emoji:'🛎️',label:'FRONT OFFICE'},
  'House Keeping':{emoji:'🧹',label:'HOUSE KEEPING'},
  'Engineering':{emoji:'🛠️',label:'ENGINEERING'},
  'F&B Service':{emoji:'🍽️',label:'F&B SERVICE'},
  'F&BP':{emoji:'🍳',label:'F&B PRODUCT'},
  'HRD':{emoji:'🧑\u200d💼',label:'HRD'},
  'Accounting':{emoji:'💰',label:'ACCOUNTING'},
  'Sales':{emoji:'📈',label:'SALES'}
};

function tampilkanDivisiPreview(previewId, emojiId, labelId, divisi){
  const info = divisiIcon[divisi];
  const preview = document.getElementById(previewId);
  const emojiEl = document.getElementById(emojiId);
  const labelEl = document.getElementById(labelId);
  if(!preview || !emojiEl || !labelEl) return;
  if(!info){
    preview.classList.remove('show');
    return;
  }
  emojiEl.textContent = info.emoji;
  labelEl.textContent = info.label;
  preview.classList.add('show');
}

function divChange(){

  const v = document.getElementById('divSel').value;

  document.getElementById('pref').textContent = mp[v] || '';

  document.getElementById('group').classList.remove('disabled');

  document.getElementById('divH').value = v;

  tampilkanDivisiPreview('divisiPreview','divisiEmoji','divisiLabel', v);

  document.getElementById('namaOnly').focus();

  ketik();

}

function ketik(){

  let s = document
    .getElementById('namaOnly')
    .value
    .toLowerCase()
    .replace(/[^a-z0-9]/g,'');

  document.getElementById('namaOnly').value = s;

  const pref = document.getElementById('pref').textContent;

  const final = pref + s;

  document.getElementById('namaF').value = final;

  document.getElementById('btnD').disabled = !(pref && s.length >= 2);

}

function cek(){

  const f = document.getElementById('namaF').value;

  if(!f || f.length < 4){
    alert('Pilih divisi dan isi nama minimal 2 huruf!');
    return false;
  }

  return true;

}

(function tampilkanStatus(){
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');

  if(params.get('registered') === '1'){
    document.getElementById('registerSuccess').style.display = 'block';
  }

  if(error === 'registered_exists'){
    document.getElementById('registerError').textContent = 'Nama tersebut sudah terdaftar. Gunakan nama lain.';
    document.getElementById('registerError').style.display = 'block';
  }

  if(error === 'server'){
    document.getElementById('registerError').textContent = 'Lengkapi divisi, nama, dan kata sandi terlebih dahulu.';
    document.getElementById('registerError').style.display = 'block';
  }
})();

</script>

</body>
</html>`);

});


/* =========================================================
   REGISTER
========================================================= */

app.post('/register', async (req, res) => {

  try {

    const nama = String(req.body.nama || '').trim();
    const divisi = String(req.body.divisi || '').trim();

    if(!nama || !divisi || !req.body.password){
      return res.redirect('/daftar-admin?error=server');
    }

    const hash = await bcrypt.hash(req.body.password, 10);

    db.run(
      `INSERT INTO users (nama,password,divisi) VALUES (?,?,?)`,
      [nama, hash, divisi],
      function(err){

        if(err){

          return res.redirect('/daftar-admin?error=registered_exists');

        }

        // Setelah daftar, kembali ke halaman daftar admin dengan status sukses.
        res.redirect('/daftar-admin?registered=1');

      }
    );

  } catch(err) {

    console.error(err);

    res.redirect('/daftar-admin?error=server');

  }

});


/* =========================================================
   LOGIN
========================================================= */

/* =========================================================
   LOGIN
========================================================= */

app.post('/login', (req, res) => {

  const nama = String(req.body.nama || '').trim();
  const divisi = String(req.body.divisi || '').trim();

  // Prefix setiap divisi
  const prefixMap = {
    'IT': 'IT_',
    'Front Office': 'FO_',
    'House Keeping': 'HK_',
    'Engineering': 'ENG_',
    'F&B Service': 'FBS_',
    'F&BP': 'FBP_',
    'HRD': 'HRD_',
    'Accounting': 'ACC_',
    'Sales': 'SLS_'
  };

  // Pastikan divisi memang valid
  if (!prefixMap[divisi]) {
    return res.redirect(
      `/?error=user_not_found&nama=${encodeURIComponent(nama)}&divisi=${encodeURIComponent(divisi)}`
    );
  }

  /*
    Username harus benar-benar sesuai dengan
    divisi yang dipilih.

    Contoh:
    IT + dzulfi
    = IT_dzulfi

    Engineering + dzulfi
    = ENG_dzulfi
  */

  const prefix = prefixMap[divisi];

  let username = nama;

  // Pastikan username mempunyai prefix divisi yang benar
  if (!username.startsWith(prefix)) {

    // Ambil nama belakang dari username yang dikirim
    const namaBersih = username
      .replace(/^IT_/i, '')
      .replace(/^FO_/i, '')
      .replace(/^HK_/i, '')
      .replace(/^ENG_/i, '')
      .replace(/^FBS_/i, '')
      .replace(/^FBP_/i, '')
      .replace(/^HRD_/i, '')
      .replace(/^ACC_/i, '')
      .replace(/^SLS_/i, '');

    username = prefix + namaBersih;
  }

  db.get(
    `
      SELECT *
      FROM users
      WHERE nama = ?
      AND divisi = ?
      LIMIT 1
    `,
    [username, divisi],
    async (err, row) => {

      /* ==============================
         ERROR DATABASE
      ============================== */

      if (err) {

        console.error('LOGIN DATABASE ERROR:', err);

        return res.redirect(
          `/?error=server&nama=${encodeURIComponent(username)}&divisi=${encodeURIComponent(divisi)}`
        );

      }

      /* ==============================
         AKUN TIDAK DITEMUKAN
      ============================== */

      if (!row) {

        return res.redirect(
          `/?error=user_not_found&nama=${encodeURIComponent(username)}&divisi=${encodeURIComponent(divisi)}`
        );

      }

      /* ==============================
         CEK PASSWORD
      ============================== */

      const passwordBenar = await bcrypt.compare(
        String(req.body.password || ''),
        row.password
      );

      if (!passwordBenar) {

        return res.redirect(
          `/?error=wrong_password&nama=${encodeURIComponent(username)}&divisi=${encodeURIComponent(divisi)}`
        );

      }

      /* ==============================
         LOGIN BERHASIL
      ============================== */

      req.session.user = row;

      return res.redirect('/dashboard');

    }
  );

});

/* =========================================================
   DASHBOARD
========================================================= */

app.get('/dashboard', cekLogin, (req, res) => {

  const user = req.session.user;
  const divisi = user.divisi;
  const nama = user.nama;
  const namaTampil = namaTanpaPrefix(nama);
  const tersimpan = req.query.tersimpan === '1';

  db.all(
    `SELECT * FROM jurnal
     WHERE user_id=?
     ORDER BY tanggal DESC, id DESC`,
    [user.id],
    (err, rows) => {

      if(err){

        return res.send('Terjadi kesalahan saat membaca jurnal.');

      }

      const daftarKegiatan = daftarKegiatanDivisi(divisi);
      const namaDiv = namaDivisi(divisi);

      const list = rows.map(r => {

        const kegiatan = esc(r.kegiatan)
          .replace(/,\s*/g, '<br>• ');

        return `
          <label class="history-item history-select-item">

            <div class="history-check">
              <input
                type="checkbox"
                class="journal-check"
                value="${Number(r.id)}"
                onchange="ubahPilihanJurnal()"
              >
            </div>

            <div class="history-date">
              ${esc(r.tanggal)}
            </div>

            <div class="history-content">

              <div class="history-title">
                ${esc(iconDivisi(r.divisi))} ${esc(r.divisi)}
              </div>

              <div class="history-text">
                • ${kegiatan || 'Tidak ada checklist'}
              </div>

              ${
                r.kegiatan_custom
                ? `<div class="history-custom">
                     ✏️ ${esc(r.kegiatan_custom)}
                   </div>`
                : ''
              }

              ${
                r.foto
                ? `<a
                     href="/${esc(r.foto)}"
                     target="_blank"
                     class="photo-link"
                     onclick="event.stopPropagation()">
                     📷 Lihat Foto Dokumentasi
                   </a>`
                : ''
              }

            </div>

          </label>
        `;

      }).join('');

      res.send(`<!DOCTYPE html>
<html lang="id">

<head>

<meta name="viewport" content="width=device-width,initial-scale=1">

<title>Dashboard Jurnal - De Paviljoen</title>

<style>

@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

*{
  box-sizing:border-box;
  margin:0;
  padding:0
}

body{
  font-family:Poppins,sans-serif;
  background:
    radial-gradient(circle at top right,#332900 0,transparent 35%),
    #0c0c0f;
  color:#fff;
  min-height:100vh;
  overflow-x:hidden
}

/* =====================================================
   ANIMASI KURSI MASUK
===================================================== */

#chairIntro{
  position:fixed;
  inset:0;
  background:#08080a;
  z-index:99999;
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden;
  pointer-events:none;
  animation:hideIntro 1s ease 2.9s forwards
}

.chair-wrap{
  position:absolute;
  left:-330px;
  bottom:18%;
  width:240px;
  animation:pushChairIn 2.7s cubic-bezier(.2,.8,.2,1) forwards
}

.chair{
  position:relative;
  width:150px;
  height:170px;
  margin:auto;
  transform:rotate(-2deg)
}

.chair-back{
  position:absolute;
  width:105px;
  height:105px;
  left:23px;
  top:0;
  border:12px solid #d4a82d;
  border-radius:18px 18px 8px 8px;
  background:#18181b;
  box-shadow:0 0 30px rgba(255,215,0,.15)
}

.chair-seat{
  position:absolute;
  width:145px;
  height:35px;
  left:2px;
  top:105px;
  border-radius:12px;
  background:#d4a82d;
  box-shadow:0 8px 0 #80641c
}

.chair-leg{
  position:absolute;
  width:10px;
  height:65px;
  background:#8b8b8f;
  top:137px;
  border-radius:8px
}

.leg1{left:22px;transform:rotate(8deg)}
.leg2{right:22px;transform:rotate(-8deg)}

.push-person{
  position:absolute;
  width:58px;
  height:115px;
  left:178px;
  bottom:3px
}

.person-head{
  width:36px;
  height:36px;
  background:#d7a77b;
  border-radius:50%;
  margin-left:12px
}

.person-body{
  width:46px;
  height:62px;
  background:#eee;
  border-radius:18px 18px 8px 8px;
  margin-left:6px
}

.person-arm{
  position:absolute;
  width:48px;
  height:12px;
  background:#eee;
  border-radius:10px;
  top:50px;
  left:-12px;
  transform:rotate(12deg)
}

@keyframes pushChairIn{

  0%{
    left:-330px;
    transform:translateX(0)
  }

  35%{
    left:12%
  }

  70%{
    left:42%
  }

  82%{
    left:48%;
    transform:translateX(-50%) scale(1.03)
  }

  100%{
    left:50%;
    transform:translateX(-50%) scale(1)
  }

}

@keyframes hideIntro{

  0%{
    opacity:1;
    visibility:visible
  }

  100%{
    opacity:0;
    visibility:hidden
  }

}

/* =====================================================
   WELCOME INTRO
===================================================== */
.welcome-intro{
  text-align:center;
  padding:35px 45px;
  border:1px solid rgba(255,215,0,.35);
  border-radius:24px;
  background:linear-gradient(145deg,#181817,#09090b);
  box-shadow:0 0 60px rgba(255,215,0,.12);
  animation:welcomePop .9s ease both;
}
.welcome-line{
  color:#FFD700;
  letter-spacing:5px;
  font-size:11px;
  margin-bottom:14px
}
.welcome-main{
  color:#fff;
  font-size:32px;
  line-height:1.15;
  font-weight:800;
  letter-spacing:1px
}
.welcome-sub{
  color:#888;
  margin-top:14px;
  font-size:10px;
  letter-spacing:4px
}
@keyframes welcomePop{
  0%{opacity:0;transform:scale(.8) translateY(20px);filter:blur(8px)}
  60%{opacity:1;transform:scale(1.04);filter:blur(0)}
  100%{opacity:1;transform:scale(1)}
}

/* =====================================================
   LAYOUT
===================================================== */

.page{
  width:94%;
  max-width:1200px;
  margin:0 auto;
  padding:30px 0 60px
}

.topbar{
  background:rgba(25,25,29,.92);
  border:1px solid rgba(255,215,0,.15);
  border-radius:22px;
  padding:22px 25px;
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:20px;
  box-shadow:0 15px 50px rgba(0,0,0,.25)
}

.brand small{
  color:#aaa;
  letter-spacing:3px;
  font-size:10px
}

.brand h1{
  font-size:25px;
  margin-top:3px
}

.user-info{
  color:#aaa;
  font-size:12px;
  margin-top:4px
}

.division-badge{
  display:inline-block;
  margin-top:8px;
  padding:6px 13px;
  border-radius:20px;
  background:#FFD700;
  color:#000;
  font-weight:700;
  font-size:11px
}

.logout{
  text-decoration:none;
  border:none;
  background:#2a2a2f;
  border:1px solid #555;
  color:#fff;
  padding:11px 18px;
  border-radius:12px;
  cursor:pointer;
  font-weight:600
}

.logout:hover{
  background:#FFD700;
  color:#000
}

.welcome{
  margin:25px 0 18px
}

.welcome h2{
  font-size:25px
}

.welcome p{
  color:#999;
  font-size:13px;
  margin-top:5px
}

.grid{
  display:grid;
  grid-template-columns:1.1fr .9fr;
  gap:20px;
  align-items:start
}

.card{
  background:rgba(24,24,28,.95);
  border:1px solid #29292f;
  border-radius:20px;
  padding:24px;
  box-shadow:0 15px 50px rgba(0,0,0,.2)
}

.card-title{
  display:flex;
  align-items:center;
  gap:10px;
  margin-bottom:20px
}

.card-title h3{
  font-size:18px
}

.icon{
  width:38px;
  height:38px;
  border-radius:12px;
  display:flex;
  align-items:center;
  justify-content:center;
  background:#FFD700;
  color:#000
}

/* =====================================================
   TANGGAL
===================================================== */

.date-box{
  display:flex;
  align-items:center;
  gap:15px;
  padding:16px;
  border-radius:16px;
  background:linear-gradient(135deg,#201d10,#151518);
  border:1px solid #4b421f;
  margin-bottom:22px
}

.calendar-icon{
  width:52px;
  height:52px;
  border-radius:14px;
  background:#FFD700;
  color:#000;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:25px
}

.date-text small{
  color:#999;
  font-size:10px;
  letter-spacing:2px
}

.date-text strong{
  display:block;
  font-size:16px;
  margin-top:2px
}

input[type=date]{
  width:100%;
  margin-top:12px;
  padding:13px;
  border-radius:12px;
  border:1px solid #3b3b42;
  background:#111114;
  color:#fff;
  font-family:inherit;
  outline:none
}

input[type=date]:focus{
  border-color:#FFD700
}

/* =====================================================
   CHECKLIST
===================================================== */

.section-label{
  color:#aaa;
  font-size:12px;
  margin-bottom:10px;
  display:block
}

.check-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px
}

.check-item{
  position:relative
}

.check-item input{
  position:absolute;
  opacity:0
}

.check-item label{
  display:block;
  cursor:pointer;
  padding:13px 12px 13px 40px;
  border:1px solid #33343a;
  border-radius:12px;
  background:#111114;
  color:#ccc;
  font-size:11px;
  line-height:1.4;
  transition:.2s;
  position:relative
}

.check-item label::before{
  content:'';
  position:absolute;
  left:13px;
  top:50%;
  transform:translateY(-50%);
  width:17px;
  height:17px;
  border:2px solid #555;
  border-radius:5px
}

.check-item input:checked + label{
  background:rgba(255,215,0,.12);
  border-color:#FFD700;
  color:#fff
}

.check-item input:checked + label::before{
  content:'✓';
  display:flex;
  align-items:center;
  justify-content:center;
  background:#FFD700;
  color:#000;
  border-color:#FFD700;
  font-weight:900
}

/* =====================================================
   CUSTOM + FOTO
===================================================== */

textarea{
  width:100%;
  min-height:100px;
  margin-top:12px;
  padding:13px;
  resize:vertical;
  border-radius:12px;
  border:1px solid #33343a;
  background:#111114;
  color:#fff;
  font-family:inherit;
  outline:none
}

textarea:focus{
  border-color:#FFD700
}

.file-box{
  margin-top:18px;
  padding:15px;
  border:1px dashed #555;
  border-radius:14px;
  background:#111114
}

.file-box input{
  width:100%;
  margin-top:8px;
  color:#aaa;
  font-size:11px
}

.save{
  width:100%;
  padding:15px;
  margin-top:18px;
  border:0;
  border-radius:13px;
  background:#FFD700;
  color:#000;
  font-weight:800;
  cursor:pointer;
  font-family:inherit
}

.save:hover{
  transform:translateY(-1px);
  box-shadow:0 8px 25px rgba(255,215,0,.2)
}

.pdf-button{
  display:block;
  width:100%;
  padding:14px;
  margin-top:10px;
  border:1px solid #FFD700;
  border-radius:13px;
  background:#17150a;
  color:#FFD700;
  text-align:center;
  text-decoration:none;
  font-size:12px;
  font-weight:800;
  transition:.2s
}

.pdf-button:hover{
  background:#FFD700;
  color:#000
}

/* =====================================================
   PILIH JURNAL UNTUK PDF
===================================================== */

.history-toolbar{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:12px;
  margin-bottom:10px;
  border:1px solid #33343a;
  border-radius:12px;
  background:#111114
}

.select-all-box{
  display:flex;
  align-items:center;
  gap:8px;
  color:#FFD700;
  font-size:11px;
  font-weight:700;
  cursor:pointer
}

.select-all-box input,
.history-check input{
  width:17px;
  height:17px;
  accent-color:#FFD700;
  cursor:pointer
}

.selected-count{
  color:#aaa;
  font-size:10px;
  white-space:nowrap
}

.history-actions{
  display:flex;
  gap:8px;
  margin-bottom:12px
}

.history-pdf,
.history-clear{
  flex:1;
  border-radius:11px;
  padding:11px 10px;
  cursor:pointer;
  font-family:inherit;
  font-size:10px;
  font-weight:800;
  transition:.2s
}

.history-pdf{
  border:1px solid #FFD700;
  background:#FFD700;
  color:#000
}

.history-pdf:hover{
  transform:translateY(-1px);
  box-shadow:0 5px 18px rgba(255,215,0,.15)
}

.history-clear{
  border:1px solid #444;
  background:#171719;
  color:#ccc
}

.history-clear:hover{
  border-color:#FFD700;
  color:#FFD700
}

.selection-message{
  display:none;
  margin:0 0 10px;
  padding:9px 11px;
  border-radius:10px;
  background:#17150a;
  border:1px solid #4d431e;
  color:#FFD700;
  font-size:10px;
  line-height:1.5
}

.history-select-item{
  cursor:pointer;
  transition:.18s;
  border-radius:12px;
  padding:12px 8px
}

.history-select-item:hover{
  background:#15150f
}

.history-select-item:has(.journal-check:checked){
  background:#19170c;
  box-shadow:inset 3px 0 0 #FFD700
}

.history-check{
  width:22px;
  display:flex;
  align-items:flex-start;
  justify-content:center;
  padding-top:9px
}

/* =====================================================
   RIWAYAT
===================================================== */

.history{
  max-height:650px;
  overflow:auto
}

.history-item{
  display:flex;
  gap:12px;
  padding:15px 0;
  border-bottom:1px solid #2c2c31
}

.history-item:last-child{
  border-bottom:0
}

.history-date{
  min-width:82px;
  height:38px;
  border-radius:10px;
  background:#27230f;
  border:1px solid #4d431e;
  display:flex;
  align-items:center;
  justify-content:center;
  color:#FFD700;
  font-size:10px;
  font-weight:700
}

.history-content{
  flex:1
}

.history-title{
  color:#FFD700;
  font-size:11px;
  font-weight:700
}

.history-text{
  color:#ddd;
  font-size:11px;
  line-height:1.6;
  margin-top:4px
}

.history-custom{
  color:#aaa;
  font-size:11px;
  margin-top:6px
}

.photo-link{
  display:inline-block;
  color:#FFD700;
  text-decoration:none;
  font-size:10px;
  margin-top:7px
}

.empty{
  text-align:center;
  padding:50px 15px;
  color:#777;
  font-size:12px
}

.footer{
  text-align:center;
  color:#555;
  font-size:10px;
  margin-top:25px;
  letter-spacing:2px
}

/* =====================================================
   ANIMASI DASHBOARD
===================================================== */

.content-animation{
  animation:dashboardUp .8s .5s ease both
}

@keyframes dashboardUp{
  from{
    opacity:0;
    transform:translateY(30px)
  }
  to{
    opacity:1;
    transform:translateY(0)
  }
}

@media(max-width:850px){

  .grid{
    grid-template-columns:1fr
  }

}

@media(max-width:600px){

  .page{
    width:92%;
    padding-top:15px
  }

  .topbar{
    padding:17px;
    align-items:flex-start
  }

  .brand h1{
    font-size:19px
  }

  .logout{
    padding:9px 12px;
    font-size:11px
  }

  .check-grid{
    grid-template-columns:1fr
  }

  .card{
    padding:18px
  }

}

</style>

</head>

<body>


<!-- =====================================================
     ANIMASI KURSI MASUK
===================================================== -->

<div id="chairIntro">
  <div class="welcome-intro">
    <div class="welcome-line">DE PAVILJOEN BANDUNG</div>
    <div class="welcome-main">${
      tersimpan
      ? 'SELAMAT!<br>JURNAL ANDA TELAH TERSIMPAN'
      : 'WELCOME<br>TRAINEE DPB'
    }</div>
    <div class="welcome-sub">${
      tersimpan
      ? 'TERIMA KASIH TELAH MENGISI JURNAL HARI INI'
      : 'JURNAL TRAINEE SYSTEM'
    }</div>
  </div>
</div>


<div class="page content-animation">

  <!-- TOPBAR -->

  <div class="topbar">

    <div class="brand">

      <small>DE PAVILJOEN BANDUNG</small>

      <h1>JURNAL TRAINEE</h1>

      <div class="user-info">
        Login sebagai <b>${esc(namaTampil)}</b>
      </div>

      <span class="division-badge">
        ${esc(iconDivisi(divisi))} ${esc(namaDiv)}
      </span>

    </div>


    <button class="logout" onclick="keluar()">
      KELUAR
    </button>

  </div>


  <div class="welcome">

    <h2>
      Halo, ${esc(namaTampil)}
    </h2>

    <p>
      Silakan isi kegiatan PKL kamu hari ini.
    </p>

  </div>


  <div class="grid">


    <!-- =================================================
         FORM JURNAL
    ================================================= -->

    <div class="card">

      <div class="card-title">

        <div class="icon">📝</div>

        <h3>Isi Jurnal Hari Ini</h3>

      </div>


      <form
        action="/tambah-jurnal"
        method="POST"
        enctype="multipart/form-data"
      >


        <!-- TANGGAL -->

        <div class="date-box">

          <div class="calendar-icon">
            📅
          </div>

          <div class="date-text">

            <small>TANGGAL JURNAL</small>

            <strong id="tanggalUnik">
              Pilih tanggal
            </strong>

          </div>

        </div>

        <input
          type="date"
          name="tanggal"
          id="tanggal"
          required
          readonly
          onkeydown="return false"
          style="pointer-events:none"
          onchange="ubahTanggal()"
        >


        <!-- DIVISI -->

        <div style="margin-top:20px">

          <span class="section-label">
            DIVISI
          </span>

          <div
            style="
              padding:12px;
              border-radius:12px;
              background:#111114;
              border:1px solid #33343a;
              color:#FFD700;
              font-weight:700;
              font-size:12px;
            "
          >
            ${esc(iconDivisi(divisi))} ${esc(namaDiv)}
          </div>

        </div>


        <!-- CHECKLIST -->

        <div style="margin-top:22px">

          <span class="section-label">
            KEGIATAN ${esc(namaDiv)}
          </span>

          <div class="check-grid">

            ${daftarKegiatan.map((item, index) => `

              <div class="check-item">

                <input
                  type="checkbox"
                  id="k${index}"
                  name="kegiatan"
                  value="${esc(item)}"
                >

                <label for="k${index}">
                  ${esc(item)}
                </label>

              </div>

            `).join('')}

          </div>

        </div>


        <!-- KEGIATAN CUSTOM -->

        <div style="margin-top:22px">

          <span class="section-label">
            KEGIATAN LAINNYA
          </span>

          <textarea
            name="kegiatan_custom"
            placeholder="Kalau pekerjaan kamu tidak ada di checklist, tuliskan di sini..."
          ></textarea>

        </div>


        <!-- FOTO -->

        <div class="file-box">

          <span class="section-label">
            📷 FOTO DOKUMENTASI (OPSIONAL)
          </span>

          <input
            type="file"
            name="foto"
            accept="image/*"
          >

        </div>


        <button class="save" type="submit">
          💾 SIMPAN JURNAL
        </button>

       
        </a>

      </form>

    </div>


    <!-- =================================================
         RIWAYAT
    ================================================= -->

    <div class="card">

      <div class="card-title">

        <div class="icon">📚</div>

        <h3>Riwayat Jurnal</h3>

      </div>

      <div class="history-toolbar">

        <label class="select-all-box">
          <input
            type="checkbox"
            id="pilihSemuaJurnal"
            onchange="pilihSemuaJurnal(this)"
          >
          <span>PILIH SEMUA JURNAL</span>
        </label>

        <span id="jumlahPilihanJurnal" class="selected-count">0 jurnal dipilih</span>

      </div>

      <div class="history-actions">
        <button type="button" class="history-pdf" onclick="downloadJurnalTerpilih()">
          📄 DOWNLOAD PDF TERPILIH
        </button>

        <button type="button" class="history-clear" onclick="hapusPilihanJurnal()">
          HAPUS PILIHAN
        </button>
      </div>

      <div id="pesanPilihanJurnal" class="selection-message"></div>

      <div class="history">

        ${
          rows.length
          ? list
          : `
            <div class="empty">
              📖<br><br>
              Belum ada jurnal.<br>
              Jurnal yang kamu simpan akan muncul di sini.
            </div>
          `
        }

      </div>

    </div>

  </div>


  <div class="footer">
    DE PAVILJOEN BANDUNG • TRAINEE JOURNAL SYSTEM
  </div>

</div>


<script>

/* =====================================================
   TANGGAL
===================================================== */

function tanggalHariIni(){

  const d = new Date();

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');

  return yyyy + '-' + mm + '-' + dd;

}

document.getElementById('tanggal').value = tanggalHariIni();

ubahTanggal();


function ubahTanggal(){

  const value = document.getElementById('tanggal').value;

  if(!value) return;

  const d = new Date(value + 'T00:00:00');

  const namaHari = [
    'MINGGU',
    'SENIN',
    'SELASA',
    'RABU',
    'KAMIS',
    'JUMAT',
    'SABTU'
  ];

  const namaBulan = [
    'JANUARI',
    'FEBRUARI',
    'MARET',
    'APRIL',
    'MEI',
    'JUNI',
    'JULI',
    'AGUSTUS',
    'SEPTEMBER',
    'OKTOBER',
    'NOVEMBER',
    'DESEMBER'
  ];

  document.getElementById('tanggalUnik').textContent =
    namaHari[d.getDay()] + ', ' +
    d.getDate() + ' ' +
    namaBulan[d.getMonth()] + ' ' +
    d.getFullYear();

}


/* =====================================================
   PILIH JURNAL UNTUK PDF
===================================================== */

function getJournalChecks(){
  return Array.from(document.querySelectorAll('.journal-check'));
}

function updateSelectionMessage(text){
  const el = document.getElementById('pesanPilihanJurnal');
  if(!el) return;

  if(!text){
    el.style.display = 'none';
    el.textContent = '';
    return;
  }

  el.style.display = 'block';
  el.textContent = text;
}

function ubahPilihanJurnal(){

  const checks = getJournalChecks();

  const jumlah = checks.filter(c => c.checked).length;

  const total = checks.length;

  const countEl = document.getElementById('jumlahPilihanJurnal');

  const allEl = document.getElementById('pilihSemuaJurnal');

  if(countEl){
    countEl.textContent = jumlah + ' jurnal dipilih';
  }

  if(allEl){

    allEl.checked =
      total > 0 && jumlah === total;

    allEl.indeterminate =
      jumlah > 0 && jumlah < total;

  }

  updateSelectionMessage('');

}

function pilihSemuaJurnal(master){

  getJournalChecks().forEach(c => {

    c.checked = master.checked;

  });

  ubahPilihanJurnal();

}

function hapusPilihanJurnal(){

  getJournalChecks().forEach(c => {

    c.checked = false;

  });

  const allEl =
    document.getElementById('pilihSemuaJurnal');

  if(allEl){

    allEl.checked = false;

    allEl.indeterminate = false;

  }

  ubahPilihanJurnal();

}

function downloadJurnalTerpilih(){

  const selected = getJournalChecks()
    .filter(c => c.checked)
    .map(c => c.value);

  if(!selected.length){

    updateSelectionMessage(
      'Pilih minimal 1 jurnal terlebih dahulu.'
    );

    return;

  }

  const ids = selected.join(',');

  window.location.href =
    '/export-pdf?ids=' +
    encodeURIComponent(ids);

}


/* =====================================================
   LOGOUT + ANIMASI KURSI KELUAR
===================================================== */

function keluar(){

  const intro =
    document.getElementById('chairIntro');

  intro.innerHTML =
    '<div class="welcome-intro">' +
      '<div class="welcome-line">DE PAVILJOEN BANDUNG</div>' +
      '<div class="welcome-main">KAMU TELAH BERHASIL<br>LOGOUT</div>' +
      '<div class="welcome-sub">SEE YOU AGAIN, TRAINEE DPB</div>' +
    '</div>';

  intro.style.visibility = 'visible';

  intro.style.opacity = '1';

  intro.style.animation = 'none';

  setTimeout(() => {

    window.location.href = '/logout';

  }, 1800);

}

</script>

</body>
</html>`);

    }

  );

});


/* =========================================================
   SIMPAN JURNAL
========================================================= */

app.post(
  '/tambah-jurnal',
  cekLogin,
  upload.single('foto'),
  (req, res) => {

    const foto = req.file
      ? 'uploads/' + req.file.filename
      : '';

    let kegiatan = req.body.kegiatan || '';

    /*
      Karena checkbox bisa lebih dari satu,
      Express akan mengirimnya sebagai array.
      Kita gabungkan menjadi satu teks agar
      SQLite bisa menyimpannya.
    */

    if(Array.isArray(kegiatan)){

      kegiatan = kegiatan.join(', ');

    }

    /*
      Divisi diambil dari akun yang sedang login,
      bukan dari form, supaya trainee tidak bisa
      menyimpan jurnal memakai divisi lain.
    */

    const divisi =
      req.session.user.divisi;

    /*
      Tanggal jurnal SELALU diambil dari tanggal
      server saat ini, bukan dari form, supaya
      tidak bisa diubah menjadi kemarin/besok
      walaupun form diakali lewat browser.
    */

    const tanggalHariIniServer = () => {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const tanggal = tanggalHariIniServer();

    db.run(
      `
      INSERT INTO jurnal
      (user_id,tanggal,divisi,kegiatan,kegiatan_custom,foto)
      VALUES (?,?,?,?,?,?)
      `,
      [
        req.session.user.id,
        tanggal,
        divisi,
        kegiatan,
        req.body.kegiatan_custom || '',
        foto
      ],
      (err) => {

        if(err){

          console.error(err);

          return res.send(`
            <script>
              alert('Jurnal gagal disimpan');
              history.back();
            </script>
          `);

        }

        res.redirect('/dashboard?tersimpan=1');

      }
    );

  }
);


/* =========================================================
   EXPORT JURNAL KE PDF
========================================================= */

app.get('/export-pdf', cekLogin, (req, res) => {

  const user = req.session.user;

  /*
    Jika URL membawa:
    /export-pdf?ids=1,2,3

    maka hanya jurnal tersebut yang dibuat PDF.

    Jika tidak ada ids,
    semua jurnal milik akun yang sedang login
    tetap diekspor seperti sebelumnya.
  */

  const idsParam =
    typeof req.query.ids === 'string'
      ? req.query.ids.trim()
      : '';

  let selectedIds = null;

  if(idsParam){

    selectedIds = idsParam
      .split(',')
      .map(v => Number(v))
      .filter(
        v =>
          Number.isInteger(v) &&
          v > 0
      );

    selectedIds =
      [...new Set(selectedIds)];

    if(!selectedIds.length){

      return res
        .status(400)
        .send(
          'Jurnal yang dipilih tidak valid.'
        );

    }

  }

  const query = selectedIds

    ? `
      SELECT *
      FROM jurnal
      WHERE user_id=?
      AND id IN (
        ${selectedIds.map(() => '?').join(',')}
      )
      ORDER BY tanggal ASC, id ASC
    `

    : `
      SELECT *
      FROM jurnal
      WHERE user_id=?
      ORDER BY tanggal ASC, id ASC
    `;

  const params = selectedIds
    ? [user.id, ...selectedIds]
    : [user.id];

  db.all(
    query,
    params,
    (err, rows) => {

      if(err){

        return res
          .status(500)
          .send(
            'Gagal membaca jurnal untuk PDF.'
          );

      }

      if(
        selectedIds &&
        !rows.length
      ){

        return res
          .status(404)
          .send(
            'Jurnal yang dipilih tidak ditemukan.'
          );

      }

      const doc =
        new PDFDocument({
          margin:45,
          size:'A4'
        });

      const safeName =
        String(
          user.nama || 'trainee'
        ).replace(
          /[^a-z0-9_-]/gi,
          '_'
        );

      const pdfType =
        selectedIds
          ? 'terpilih'
          : 'semua';

      res.setHeader(
        'Content-Type',
        'application/pdf'
      );

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="jurnal_${pdfType}_${safeName}.pdf"`
      );

      doc.pipe(res);


      /*
        HEADER PDF
      */

      doc
        .fontSize(20)
        .fillColor('#111')
        .text(
          'DE PAVILJOEN BANDUNG',
          {
            align:'center'
          }
        );

      doc.moveDown(.3);

      doc
        .fontSize(14)
        .text(
          'JURNAL TRAINEE',
          {
            align:'center'
          }
        );

      doc.moveDown(.2);

      doc
        .fontSize(10)
        .text(
          selectedIds
            ? `JURNAL TERPILIH (${rows.length} DATA)`
            : `SEMUA JURNAL (${rows.length} DATA)`,
          {
            align:'center'
          }
        );

      doc.moveDown();

      doc
        .fontSize(10)
        .text(
          `Nama   : ${user.nama}`
        );

      doc.text(
        `Divisi : ${namaDivisi(user.divisi)}`
      );

      doc.moveDown();


      if(!rows.length){

        doc
          .fontSize(11)
          .text(
            'Belum ada jurnal yang tersimpan.'
          );

      }


      /*
        ISI SEMUA JURNAL
      */

      rows.forEach((r, i) => {

        if(i > 0){

          doc.moveDown();

        }

        doc
          .fontSize(13)
          .fillColor('#000')
          .text(
            `${i + 1}. Jurnal - ${r.tanggal}`
          );

        doc.moveDown(.2);

        doc
          .fontSize(10)
          .text(
            `Divisi: ${namaDivisi(r.divisi)}`
          );

        const kegiatan =
          r.kegiatan
            ? String(r.kegiatan)
                .split(', ')
            : [];

        doc.text('Kegiatan:');

        if(kegiatan.length){

          kegiatan.forEach(k => {

            doc.text(
              `  • ${k}`
            );

          });

        }else{

          doc.text(
            '  • Tidak ada checklist'
          );

        }


        if(r.kegiatan_custom){

          doc.text(
            `Kegiatan lainnya: ${r.kegiatan_custom}`
          );

        }


        /*
          FOTO
        */

        if(r.foto){

          const fs =
            require('fs');

          const path =
            require('path');

          const imagePath =
            path.join(
              process.cwd(),
              r.foto
            );

          if(fs.existsSync(imagePath)){

            try{

              doc.moveDown(.5);

              doc.text(
                'Foto dokumentasi:'
              );

              doc.image(
                imagePath,
                {
                  fit:[250,180],
                  align:'left'
                }
              );

              doc.moveDown();

            }catch(e){

              doc.text(
                '  [Foto tidak dapat dimasukkan ke PDF]'
              );

            }

          }

        }


        doc.moveDown(.5);

        doc
          .moveTo(45, doc.y)
          .lineTo(550, doc.y)
          .strokeColor('#cccccc')
          .stroke();

      });


      doc.end();

    }

  );

});


/* =========================================================
   LOGOUT
========================================================= */

app.get('/logout', (req, res) => {

  req.session.destroy(() => {

    res.redirect('/');

  });

});


/* =========================================================
   JALANKAN SERVER
========================================================= */

app.listen(
  port,
  '0.0.0.0',
  () => {

    console.log(
      'JURNAL DE PAVILJOEN: http://localhost:' +
      port
    );

  }
);