/**
 * Vercel Serverless Function - Telegram Webhook Handler
 * Endpoint: /api/telegram
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8977548476:AAGR2uemEkdVv9PiF4Rxc4eWkWa_wxtrb0s';
const OWNER_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '7547492034';

async function callTelegram(method, payload = {}) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return await res.json();
}

// In-memory / Mock queue untuk Vercel Serverless
const samplePosts = [
  {
    id: "post-001",
    title: "Masalah Rekap Manual Kertas",
    status: "posted",
    image: "https://setoranngajibot.vercel.app/images/template_1.png"
  },
  {
    id: "post-002",
    title: "Ekosistem 4 Portal Lengkap",
    status: "approved",
    image: "https://setoranngajibot.vercel.app/images/template_2.png"
  },
  {
    id: "post-003",
    title: "Akses Demo Gratis Khusus Lembaga",
    status: "pending",
    image: "https://setoranngajibot.vercel.app/images/poster_ad_pro.jpg",
    caption: `Khusus pengurus Rumah Tahfidz & TPQ di seluruh Indonesia! 📢\n\nIngin rasakan mudahnya mengelola setoran santri tanpa kertas mutaba'ah manual? Kami membuka akses DEMO GRATIS untuk lembaga Anda.\n\nKetik "DEMO" di kolom komentar atau klik link di bio untuk mendaftarkan lembaga Anda hari ini! 🌟\n\n#SetoranNgaji #RumahTahfidzIndonesia #SantriHebat #TahfidzQuran`
  }
];

module.exports = async (req, res) => {
  // Health check endpoint via browser GET
  if (req.method === 'GET') {
    return res.status(200).send('✅ SetoranNgaji Telegram Webhook is ACTIVE 24/7 on Vercel!');
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const update = req.body;
  if (!update) {
    return res.status(400).send('No payload received');
  }

  try {
    // 1. Tangani pesan teks (/start, /review, /status)
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = msg.text ? msg.text.trim() : '';

      if (text === '/start' || text === '/help') {
        const welcome = `Assalamu'alaikum! 👋\n` +
          `Selamat datang di *SetoranNgaji Marketing Approval Bot* (Vercel Cloud 24/7).\n\n` +
          `*Perintah yang tersedia:*\n` +
          `• /review : Minta draf konten iklan berikutnya untuk ditinjau\n` +
          `• /status : Cek antrean postingan & status persetujuan\n` +
          `• /help : Menampilkan panduan ini`;

        await callTelegram('sendMessage', { chat_id: chatId, text: welcome, parse_mode: 'Markdown' });
      } else if (text === '/review') {
        const post = samplePosts.find(p => p.status === 'pending');
        if (!post) {
          await callTelegram('sendMessage', {
            chat_id: chatId,
            text: `🎉 Semua draf konten sudah disetujui atau diposting! Anda luar biasa.`
          });
        } else {
          const reviewText = `🎨 *DRAFT KONTEN IKLAN BARU* (${post.id})\n` +
            `📌 *Judul:* ${post.title}\n` +
            `📱 *Platform:* INSTAGRAM, TIKTOK\n\n` +
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

          if (post.image) {
            await callTelegram('sendPhoto', {
              chat_id: chatId,
              photo: post.image,
              caption: reviewText,
              parse_mode: 'Markdown',
              reply_markup: keyboard
            });
          } else {
            await callTelegram('sendMessage', {
              chat_id: chatId,
              text: reviewText,
              parse_mode: 'Markdown',
              reply_markup: keyboard
            });
          }
        }
      } else if (text === '/status') {
        let statusMsg = `📊 *Status Konten Iklan SetoranNgaji (Cloud 24/7):*\n\n` +
          `✅ *post-001*: Masalah Rekap Manual Kertas [_POSTED_]\n` +
          `🟢 *post-002*: Ekosistem 4 Portal Lengkap [_APPROVED_]\n` +
          `⏳ *post-003*: Akses Demo Gratis Khusus Lembaga [_PENDING REVIEW_]\n`;

        await callTelegram('sendMessage', { chat_id: chatId, text: statusMsg, parse_mode: 'Markdown' });
      } else {
        // Balasan pesan lainnya (misal: teks revisi)
        await callTelegram('sendMessage', {
          chat_id: chatId,
          text: `📝 Catatan revisi Anda telah dicatat: _"${text}"_.\nAI Agent akan memperbarui draf materi iklan.`,
          parse_mode: 'Markdown'
        });
      }
    }

    // 2. Tangani klik tombol inline (Approve / Revise)
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;
      const messageId = cb.message.message_id;
      const data = cb.data || '';

      if (data.startsWith('approve:')) {
        const postId = data.split(':')[1];
        const approvedCaption = `✅ *DISETUJUI (APPROVED)!*\n\nKonten *${postId}* telah Anda setujui dan siap diterbitkan ke media sosial. 🚀`;
        
        // Coba edit caption jika pesan berupa foto, atau edit text jika pesan berupa teks biasa
        const editRes = await callTelegram('editMessageCaption', {
          chat_id: chatId,
          message_id: messageId,
          caption: approvedCaption,
          parse_mode: 'Markdown'
        });

        if (!editRes.ok) {
          await callTelegram('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: approvedCaption,
            parse_mode: 'Markdown'
          });
        }
      } else if (data.startsWith('revise:')) {
        const postId = data.split(':')[1];
        await callTelegram('sendMessage', {
          chat_id: chatId,
          text: `✏️ Silakan ketik instruksi revisi Anda untuk *${postId}* (misalnya: ganti headline atau tagar):`
        });
      }

      await callTelegram('answerCallbackQuery', { callback_query_id: cb.id });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Error handling webhook:', err);
    return res.status(500).json({ error: err.message });
  }
};
