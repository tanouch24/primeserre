// Lancée automatiquement par Netlify à chaque envoi du formulaire « etude-serre ».
// 1. Alerte Telegram avec le téléphone du prospect.
// 2. Événement « Lead » envoyé à l'API Conversions de Meta, seulement si le prospect a accepté les cookies pub.
import { createHash } from 'node:crypto';

const sha256 = (v) => createHash('sha256').update(v).digest('hex');

// 06 12 34 56 78 → 33612345678 (format attendu par Meta)
export function normalizePhone(raw = '') {
  let d = String(raw).replace(/\D/g, '');
  if (d.startsWith('0033')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('0')) d = '33' + d.slice(1);
  return d;
}

const esc = (s = '') => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

export function telegramMessage(d) {
  const ligne = (label, v) => (v ? `<b>${label}</b> : ${esc(v)}\n` : '');
  const alerte = [];
  if (/^Tunnel/.test(d.type_serre || '')) alerte.push('Tunnels : isolation à vérifier');
  if (d.type_paroi === 'Simple paroi sans écran thermique') alerte.push('Couverture non isolée');
  if (d.distance_compteur === 'Pas de compteur sur le site') alerte.push('Pas de compteur sur le site');
  if (d.distance_compteur === 'Plus de 300 m') alerte.push('Compteur à plus de 300 m');
  const S = Number(d.surface_m2) || 0;
  if (S && ((d.culture === 'maraichere' && S < 5000) || (d.culture === 'horticole' && S < 7000))) alerte.push('Sous la surface minimale');

  return (
    '🌱 <b>Nouvelle demande serre</b>\n\n' +
    ligne('Nom', d.nom) +
    ligne('Exploitation', d.exploitation) +
    ligne('Téléphone', d.telephone) +
    ligne('E-mail', d.email) +
    ligne('Code postal', d.code_postal) +
    '\n' +
    ligne('Culture', d.culture === 'horticole' ? 'Horticole' : 'Maraîchère') +
    ligne('Surface', S ? `${S.toLocaleString('fr-FR')} m²` : '') +
    ligne('Type de serre', d.type_serre) +
    ligne('Chauffage actuel', d.chauffage_actuel) +
    ligne('Paroi', d.type_paroi) +
    ligne('Distance compteur', d.distance_compteur) +
    '\n' +
    ligne('Origine', d.source) +
    (alerte.length ? `\n${alerte.join('\n')}` : '')
  );
}

export function metaLeadEvent(d, createdAt) {
  const user_data = { country: [sha256('fr')] };
  const ph = normalizePhone(d.telephone);
  if (ph) user_data.ph = [sha256(ph)];
  if (d.email) user_data.em = [sha256(d.email.trim().toLowerCase())];
  if (d.code_postal) user_data.zp = [sha256(String(d.code_postal).trim())];
  if (d.ip) user_data.client_ip_address = d.ip;
  if (d.user_agent) user_data.client_user_agent = d.user_agent;
  if (d.fbp) user_data.fbp = d.fbp;
  if (d.fbc) user_data.fbc = d.fbc;
  return {
    event_name: 'Lead',
    event_time: Math.floor(new Date(createdAt || Date.now()).getTime() / 1000),
    event_id: d.event_id,
    action_source: 'website',
    event_source_url: d.referrer || undefined,
    user_data,
    custom_data: { content_name: 'etude-serre', content_category: d.culture },
  };
}

export default async (req) => {
  const { payload } = await req.json();
  if (payload?.form_name !== 'etude-serre') return new Response('ignoré');
  const d = { ...payload.data, ip: payload.data?.ip, user_agent: payload.data?.user_agent };
  const env = (k) => (typeof Netlify !== 'undefined' ? Netlify.env.get(k) : process.env[k]);
  const jobs = [];

  const tgToken = env('TELEGRAM_BOT_TOKEN');
  const tgChat = env('TELEGRAM_CHAT_ID');
  if (tgToken && tgChat) {
    jobs.push(
      fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChat, text: telegramMessage(d), parse_mode: 'HTML' }),
      }).then(async (r) => { if (!r.ok) console.error('Telegram', r.status, await r.text()); }),
    );
  }

  const pixel = env('META_PIXEL_ID');
  const capiToken = env('META_CONVERSIONS_API_TOKEN');
  if (pixel && capiToken && d.consentement_pub === 'oui') {
    jobs.push(
      fetch(`https://graph.facebook.com/v21.0/${pixel}/events?access_token=${encodeURIComponent(capiToken)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [metaLeadEvent(d, payload.created_at)] }),
      }).then(async (r) => { if (!r.ok) console.error('Meta CAPI', r.status, await r.text()); }),
    );
  }

  await Promise.allSettled(jobs);
  return new Response('ok');
};
