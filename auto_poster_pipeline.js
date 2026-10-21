/**
 * Auto Poster Pipeline - SetoranNgaji
 * Menjadwalkan dan mempublikasikan postingan iklan media sosial secara otomatis.
 */

const fs = require('fs');
const path = require('path');

const QUEUE_FILE = path.join(__dirname, 'content_queue.json');
const LOG_FILE = path.join(__dirname, 'published_log.json');

// Inisialisasi antrean konten jika belum ada
function initQueue() {
  if (!fs.existsSync(QUEUE_FILE)) {
    const initialQueue = [
      {
        id: "post-001",
        title: "Masalah Rekap Manual Kertas",
        platform: ["instagram", "facebook", "tiktok"],
        status: "ready", // ready, posted, skipped
        scheduledAt: new Date(Date.now() + 1000 * 60).toISOString(),
        imageTemplate: "template_1_painpoint.png",
        caption: `Masih zaman rekap hafalan santri pakai buku kertas yang gampang rusak atau hilang? ❌📖\n\nKenalkan SetoranNgaji! Aplikasi pendamping Rumah Tahfidz & TPQ modern:\n✨ Santri bisa setor audio hafalan per ayat\n✨ Guru beri evaluasi (Lanjut / Ulang) cukup 1 klik\n✨ Rekap progres santri otomatis tersimpan rapi\n\nYuk coba kemudahannya sekarang! Link di bio 📲\n\n#SetoranNgaji #RumahTahfidz #HafidzQuran #AplikasiTahfidz #PendidikanIslam`,
      },
      {
        id: "post-002",
        title: "Ekosistem 4 Portal Lengkap",
        platform: ["instagram", "facebook"],
        status: "pending",
        scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        imageTemplate: "template_2_features.png",
        caption: `Semua pihak terhubung dalam satu aplikasi yang harmonis! 🌿\n\nDi SetoranNgaji, setiap pengguna punya portal khususnya masing-masing:\n1️⃣ Santri: Setor hafalan & buka mushaf digital\n2️⃣ Guru: Koreksi audio & nilai perkembangan santri\n3️⃣ Master Admin: Pantau performa seluruh kelas & halaqah\n4️⃣ Super Admin: Kelola multi-lembaga\n\nDesain bersih bergaya Apple yang nyaman dipandang berlama-lama. Hubungi kami untuk jadwal demo gratis! 🚀\n\n#TahfidzModern #PesantrenDigital #AplikasiMuslim #SetoranNgaji`,
      },
      {
        id: "post-003",
        title: "Akses Demo Gratis Khusus Lembaga",
        platform: ["instagram", "tiktok"],
        status: "pending",
        scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
        imageTemplate: "template_3_cta_demo.png",
        caption: `Khusus pengurus Rumah Tahfidz & TPQ di seluruh Indonesia! 📢\n\nIngin rasakan mudahnya mengelola setoran santri tanpa kertas mutaba'ah manual? Kami membuka akses DEMO GRATIS untuk lembaga Anda.\n\nKetik "DEMO" di kolom komentar atau klik link di bio untuk mendaftarkan lembaga Anda hari ini! 🌟\n\n#SetoranNgaji #RumahTahfidzIndonesia #SantriHebat #TahfidzQuran`,
      }
    ];

    fs.writeFileSync(QUEUE_FILE, JSON.stringify(initialQueue, null, 2), 'utf-8');
    console.log(`[INIT] Content queue berhasil dibuat di: ${QUEUE_FILE}`);
  }
}

function getLog() {
  if (!fs.existsSync(LOG_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function saveLog(entry) {
  const log = getLog();
  log.push(entry);
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2), 'utf-8');
}

// Simulasi / Eksekusi Publikasi
async function publishPost(post) {
  console.log(`\n======================================================`);
  console.log(`🚀 [PUBLISHING] Memproses Konten: "${post.title}" (${post.id})`);
  console.log(`📱 Platform Target: ${post.platform.join(', ').toUpperCase()}`);
  console.log(`🖼️  Aset Desain   : ${post.imageTemplate}`);
  console.log(`📝 Caption Preview:\n${post.caption.split('\n')[0]}...`);
  console.log(`======================================================`);

  // Simulasi waktu upload / request API (Meta Graph / Telegram / Webhook)
  await new Promise(res => setTimeout(res, 1200));

  const logEntry = {
    postId: post.id,
    title: post.title,
    platform: post.platform,
    publishedAt: new Date().toISOString(),
    status: "SUCCESS",
    notes: "Terkirim ke saluran publikasi."
  };

  saveLog(logEntry);
  console.log(`✅ [BERHASIL] Konten ${post.id} sukses dipublikasikan!`);
}

async function runPipeline() {
  initQueue();
  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));

  const pendingIndex = queue.findIndex(p => p.status === 'ready' || p.status === 'pending');

  if (pendingIndex === -1) {
    console.log("[INFO] Semua konten dalam antrean telah dipublikasikan.");
    return;
  }

  const postToPublish = queue[pendingIndex];
  await publishPost(postToPublish);

  // Tandai sebagai posted
  queue[pendingIndex].status = 'posted';
  queue[pendingIndex].lastPostedAt = new Date().toISOString();
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf-8');

  console.log(`[INFO] Status antrean diperbarui. Sisa antrean aktif: ${queue.filter(q => q.status !== 'posted').length} konten.\n`);
}

// Jalankan pipeline
runPipeline().catch(console.error);
