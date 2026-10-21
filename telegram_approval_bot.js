/**
 * Telegram Approval Bot - SetoranNgaji Marketing
 * 
 * Bot ini menghubungkan alur kerja AI Agent dengan Telegram Anda:
 * 1. Mengirim draf konten iklan (gambar & teks) ke Telegram Anda.
 * 2. Memberikan tombol interaktif: [Setujui] dan [Minta Revisi].
 * 3. Jika disetujui -> masuk antrean jadwal publikasi.
 * 4. Jika ditolak/revisi -> menerima catatan revisi dari Anda untuk diperbaiki.
 */

const fs = require('fs');
const path = require('path');

const QUEUE_FILE = path.join(__dirname, 'content_queue.json');
const ENV_FILE = path.join(__dirname, '.env');
const CONFIG_FILE = path.join(__dirname, 'telegram_config.json');

// Membaca Token & Chat ID dari .env atau telegram_config.json
function loadConfig() {
  let token = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = process.env.TELEGRAM_CHAT_ID;

  if (fs.existsSync(ENV_FILE)) {
    const lines = fs.readFileSync(ENV_FILE, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('TELEGRAM_BOT_TOKEN=')) token = trimmed.split('=')[1].trim();
      if (trimmed.startsWith('TELEGRAM_CHAT_ID=')) chatId = trimmed.split('=')[1].trim();
    }
  }

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      if (cfg.botToken && !token) token = cfg.botToken;
      if (cfg.chatId && !chatId) chatId = cfg.chatId;
    } catch (e) {}
  }

  return { token, chatId };
}

let { token: BOT_TOKEN, chatId: OWNER_CHAT_ID } = loadConfig();

async function callTelegram(method, payload = {}) {
  if (!BOT_TOKEN || BOT_TOKEN.includes('ISI_BOT_TOKEN')) {
    throw new Error('TELEGRAM_BOT_TOKEN belum diisi.');
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API Error: ${data.description}`);
  }
  return data.result;
}

function getQueue() {
  if (!fs.existsSync(QUEUE_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function saveQueue(queue) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf-8');
}

// Mengirim draft konten berikutnya ke pengguna untuk di-review
async function sendDraftForReview(targetChatId, post) {
  const text = `🎨 *DRAFT KONTEN IKLAN BARU* (${post.id})\n` +
    `📌 *Judul:* ${post.title}\n` +
    `📱 *Platform:* ${post.platform.join(', ').toUpperCase()}\n` +
    `🖼️ *Template Desain:* \`${post.imageTemplate || 'Standard'}\`\n\n` +
    `📝 *Naskah Caption:*\n${post.caption}\n\n` +
    `Silakan tinjau draf di atas:`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Setujui & Jadwalkan', callback_data: `approve:${post.id}` },
        { text: '✏️ Minta Revisi', callback_data: `revise:${post.id}` }
      ]
    ]
  };

  return await callTelegram('sendMessage', {
    chat_id: targetChatId,
    text: text,
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

// State untuk melacak pengguna yang sedang mengetik instruksi revisi
const pendingRevisions = new Map();

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text ? msg.text.trim() : '';

  // Simpan Chat ID jika belum ada
  if (!OWNER_CHAT_ID || OWNER_CHAT_ID.includes('ISI_CHAT_ID')) {
    OWNER_CHAT_ID = chatId.toString();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ botToken: BOT_TOKEN, chatId: OWNER_CHAT_ID }, null, 2), 'utf-8');
    console.log(`[CONFIG] Chat ID tersimpan otomatis: ${OWNER_CHAT_ID}`);
  }

  // Jika sedang menunggu teks revisi dari user
  if (pendingRevisions.has(chatId)) {
    const postId = pendingRevisions.get(chatId);
    pendingRevisions.delete(chatId);

    const queue = getQueue();
    const item = queue.find(q => q.id === postId);
    if (item) {
      item.status = 'need_revision';
      item.revisionNotes = text;
      item.revisedAt = new Date().toISOString();
      saveQueue(queue);

      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: `📝 *Catatan Revisi Diterima untuk ${postId}!* \n\n_"${text}"_\n\n🤖 AI Agent akan merevisi desain & copy sesuai instruksi ini.`,
        parse_mode: 'Markdown'
      });
      console.log(`[REVISI] ${postId} mendapat instruksi revisi: ${text}`);
      return;
    }
  }

  if (text === '/start' || text === '/help') {
    const welcome = `Assalamu'alaikum! 👋\n` +
      `Selamat datang di *SetoranNgaji Marketing Approval Bot*.\n\n` +
      `Bot ini bertugas mengirimkan materi iklan yang dibuat oleh AI Agent untuk Anda tinjau sebelum dipublikasikan.\n\n` +
      `*Perintah yang tersedia:*\n` +
      `• /review : Minta draf konten iklan berikutnya untuk ditinjau\n` +
      `• /status : Cek antrean postingan & status persetujuan\n` +
      `• /help : Menampilkan panduan ini`;

    await callTelegram('sendMessage', { chat_id: chatId, text: welcome, parse_mode: 'Markdown' });
    return;
  }

  if (text === '/review') {
    const queue = getQueue();
    const pendingPost = queue.find(q => q.status === 'pending' || q.status === 'draft' || q.status === 'ready');

    if (!pendingPost) {
      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: `🎉 Tidak ada draf yang perlu ditinjau saat ini! Semua konten sudah disetujui atau diposting.`
      });
      return;
    }

    await sendDraftForReview(chatId, pendingPost);
    return;
  }

  if (text === '/status') {
    const queue = getQueue();
    let msgText = `📊 *Status Antrean Konten Iklan SetoranNgaji:*\n\n`;
    queue.forEach(q => {
      const icon = q.status === 'posted' ? '✅' :
                   q.status === 'approved' ? '🟢' :
                   q.status === 'need_revision' ? '🔴' : '⏳';
      msgText += `${icon} *${q.id}*: ${q.title} [_${q.status.toUpperCase()}_]\n`;
      if (q.revisionNotes) msgText += `   ↳ _Revisi:_ ${q.revisionNotes}\n`;
    });

    await callTelegram('sendMessage', { chat_id: chatId, text: msgText, parse_mode: 'Markdown' });
    return;
  }
}

async function handleCallback(cb) {
  const chatId = cb.message.chat.id;
  const data = cb.data || '';
  const messageId = cb.message.message_id;

  if (data.startsWith('approve:')) {
    const postId = data.split(':')[1];
    const queue = getQueue();
    const item = queue.find(q => q.id === postId);

    if (item) {
      item.status = 'approved';
      item.approvedAt = new Date().toISOString();
      saveQueue(queue);

      await callTelegram('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: `✅ *DISETUJUI (APPROVED)!*\n\nKonten *${item.title}* (${postId}) telah Anda setujui dan dijadwalkan untuk auto-post. 🚀`,
        parse_mode: 'Markdown'
      });
      console.log(`[APPROVAL] ${postId} disetujui oleh user.`);
    }
  } else if (data.startsWith('revise:')) {
    const postId = data.split(':')[1];
    pendingRevisions.set(chatId, postId);

    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: `✏️ Silakan ketik dan kirimkan instruksi revisi Anda untuk *${postId}* (misalnya: warna background, teks headline, atau gaya tulisan):`,
      parse_mode: 'Markdown'
    });
  }

  await callTelegram('answerCallbackQuery', { callback_query_id: cb.id });
}

// Long Polling Bot Updates
async function startBot() {
  console.log("==================================================");
  console.log("🤖 Telegram Approval Bot - SetoranNgaji");
  console.log("==================================================");

  if (!BOT_TOKEN || BOT_TOKEN.includes('ISI_BOT_TOKEN')) {
    console.log("\n⚠️  TELEGRAM_BOT_TOKEN belum disetel!");
    console.log("Panduan aktivasi:");
    console.log("1. Buka Telegram, cari @BotFather");
    console.log("2. Ketik /newbot, beri nama bot Anda (misal: SetoranNgajiBot)");
    console.log("3. Salin API Token yang diberikan ke file .env atau telegram_config.json");
    console.log("4. Jalankan kembali skrip ini: node telegram_approval_bot.js\n");
    return;
  }

  try {
    const me = await callTelegram('getMe');
    console.log(`✅ Terhubung dengan Bot: @${me.username} (${me.first_name})`);
    console.log(`📡 Menunggu interaksi review dari Telegram...\n`);
  } catch (err) {
    console.error("❌ Gagal terhubung ke Telegram API:", err.message);
    return;
  }

  let offset = 0;
  while (true) {
    try {
      const updates = await callTelegram('getUpdates', { offset, timeout: 30 });
      for (const update of updates) {
        offset = update.update_id + 1;
        if (update.message) {
          await handleMessage(update.message);
        } else if (update.callback_query) {
          await handleCallback(update.callback_query);
        }
      }
    } catch (err) {
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}

startBot();
