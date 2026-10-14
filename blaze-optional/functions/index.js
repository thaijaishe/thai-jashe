/* થઈ જશે! — Cloud Functions (સર્વર કોડ)
 *  logLogin        : લૉગિન વખતે સાચો IP અને સમય સર્વર પર નોંધે (ફોન ખોટો IP મોકલી ન શકે)
 *  verifyOtp       : કારીગરે લખેલો OTP સર્વર પર ચકાસે, પછી જ "કામ ચાલુ" (5 ખોટા પ્રયત્ન પછી લૉક)
 *  onBookingCreated / onBookingUpdated : નજીકના (25–30 કિમી) કારીગરોને Push સૂચના (એપ બંધ હોય તો પણ 1 મિનિટ રિંગ),
 *                    ગ્રાહકને સ્થિતિની સૂચના, રેટિંગ ગણતરી
 *  onAlertCreated  : SOS — બધા એડમિનને તરત સૂચના
 *  onTicketCreated : નવી ફરિયાદ — એડમિનને સૂચના
 *  onKarigarDeleted: ખાતું ડિલીટ થાય તો ખાનગી ડેટા અને 30 દિવસ પછી આધાર ફોટા ભૂંસવા
 *  dailyCleanup    : રોજ રાત્રે — 1 વર્ષથી જૂના લોકેશન/લૉગિન લૉગ અને સમય પૂરો થયેલ KYC ભૂંસે
 */
const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {onDocumentCreated, onDocumentUpdated, onDocumentDeleted} = require('firebase-functions/v2/firestore');
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {setGlobalOptions, logger} = require('firebase-functions/v2');
const {initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {getMessaging} = require('firebase-admin/messaging');
const {getStorage} = require('firebase-admin/storage');

initializeApp();
const db = getFirestore();
setGlobalOptions({region:'asia-south1', maxInstances:10});

const DAY = 86400000, YEAR = 365 * DAY;
const CAT = {ac:'એસી રિપેર', plumber:'પ્લમ્બર', electrician:'ઇલેક્ટ્રિશિયન', carpenter:'સુથાર', painter:'કલરકામ', cleaning:'ઘર સફાઈ', mason:'કડિયા', welder:'વેલ્ડર',
  mechanic:'બાઇક/કાર મિકેનિક', appliance:'ફ્રિજ/વોશિંગ મશીન', ro:'RO રિપેર', cctv:'CCTV/કમ્પ્યુટર', tailor:'દરજી', cobbler:'મોચી', gardener:'માળી', pest:'પેસ્ટ કંટ્રોલ',
  cook:'રસોઇયા', beauty:'બ્યુટીશિયન', locksmith:'ચાવીવાળો', roofing:'છત/પતરાં', glass:'કાચકામ', tiles:'ટાઇલ્સ', generator:'ઇન્વર્ટર/જનરેટર', solar:'સોલાર',
  movers:'ઘરવખરી શિફ્ટિંગ', pop:'ઇન્ટિરિયર/POP', maid:'ઘરકામ', driver:'ડ્રાઇવર', other:'અન્ય કામ'};
const AREAS = {alkapuri:['અલકાપુરી', 22.3106, 73.1700], akota:['અકોટા', 22.2960, 73.1680], sayajigunj:['સયાજીગંજ', 22.3160, 73.1810], fatehgunj:['ફતેહગંજ', 22.3240, 73.1830],
  karelibaug:['કારેલીબાગ', 22.3200, 73.2040], nizampura:['નિઝામપુરા', 22.3380, 73.1800], gotri:['ગોત્રી', 22.3110, 73.1390], vasna:['વાસણા-ભાયલી', 22.2860, 73.1350],
  manjalpur:['માંજલપુર', 22.2700, 73.1900], makarpura:['મકરપુરા', 22.2570, 73.1960], waghodia:['વાઘોડિયા રોડ', 22.3000, 73.2270], harni:['હરણી', 22.3450, 73.2120],
  sama:['સમા', 22.3410, 73.1920], gorwa:['ગોરવા', 22.3310, 73.1530], tarsali:['તરસાલી', 22.2580, 73.2180], ajwa:['આજવા રોડ', 22.3110, 73.2330],
  subhanpura:['સુભાનપુરા', 22.3250, 73.1570], chhani:['છાણી', 22.3610, 73.1690]};
const areaLL = a => AREAS[a] ? {lat:AREAS[a][1], lng:AREAS[a][2]} : null;
function km(a, b){ const R = 6371, r = x => x * Math.PI / 180, dLa = r(b.lat - a.lat), dLo = r(b.lng - a.lng);
  const q = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(q)); }
const settings = async () => (await db.doc('settings/main').get()).data() || {};
const clientIp = req => { const f = req.rawRequest.headers['x-forwarded-for']; return String(f ? String(f).split(',')[0] : (req.rawRequest.ip || '')).trim(); };

/* ---------- Push સૂચના ---------- */
async function tokensOf(col, ids){ const out = []; for(const id of [...new Set(ids)].filter(Boolean)){ const d = await db.doc(`${col}/${id}`).get(); ((d.exists && d.data().fcm) || []).forEach(t => out.push({col, id, t})); } return out; }
async function send(list, data, opt = {}){
  if(!list.length) return 0; const str = {}; for(const k in data) str[k] = String(data[k] == null ? '' : data[k]);
  const base = opt.ring
    ? {data:str, android:{priority:'high', ttl:60000}}   // data-only: એપનો TJMessagingService 60 સેકન્ડ ફોનની રિંગ વગાડે
    : {data:str, notification:{title:str.title, body:str.body}, android:{priority:'high', notification:{channelId:'tj_alert', sound:'default'}}};
  const res = await getMessaging().sendEachForMulticast({...base, tokens:list.map(x => x.t)});
  const dead = []; res.responses.forEach((r, i) => { if(!r.success && /registration-token-not-registered|invalid-argument|invalid-registration-token/.test((r.error && r.error.code) || '')) dead.push(list[i]); });
  for(const x of dead) await db.doc(`${x.col}/${x.id}`).update({fcm:FieldValue.arrayRemove(x.t)}).catch(() => {});
  logger.info('push', {sent:res.successCount, failed:res.failureCount, type:data.type}); return res.successCount;
}
async function notifyAdmins(data){ const a = await db.collection('admins').get(); const list = []; a.forEach(d => (d.data().fcm || []).forEach(t => list.push({col:'admins', id:d.id, t}))); return send(list, data); }

/* નજીકના (ત્રિજ્યા અંદરના) ઓનલાઇન કારીગરોને નવી વિનંતી */
async function notifyNearby(id, b){
  const st = await settings(), R = +st.radiusKm || 25, bp = b.geoR || areaLL(b.area), skip = new Set(b.rejectedBy || []);
  const ks = await db.collection('karigars').where('status', '==', 'approved').where('online', '==', true).where('cat', '==', b.cat).get();
  const ids = [];
  for(const d of ks.docs){ if(skip.has(d.id)) continue; const p = (await db.doc(`karigars/${d.id}/private/main`).get()).data() || {};
    const kp = p.loc && Date.now() - p.loc.ts < 30 * 60000 ? p.loc : areaLL(d.data().area);
    if(!bp || !kp || km(bp, kp) <= R) ids.push(d.id); }
  const area = (AREAS[b.area] || [''])[0];
  return send(await tokensOf('users', ids), {type:'request', bookingId:id, title:'🔔 નવું કામ: ' + (CAT[b.cat] || 'કામ'), body:`${area} · ${String(b.problem || '').slice(0, 60)}`}, {ring:true});
}
async function notifyKarigar(id, b){ return send(await tokensOf('users', [b.karigarId]), {type:'request', bookingId:id, title:'🔔 ખાસ તમને વિનંતી: ' + (CAT[b.cat] || 'કામ'), body:`${(AREAS[b.area] || [''])[0]} · ${String(b.problem || '').slice(0, 60)}`}, {ring:true}); }

/* ---------- લૉગિન: સર્વર IP + સમય ---------- */
exports.logLogin = onCall(async req => {
  if(!req.auth) throw new HttpsError('unauthenticated', 'લૉગિન જરૂરી');
  const uid = req.auth.uid, d = req.data || {}, ip = clientIp(req), now = Date.now();
  let role = null;
  if((await db.doc('admins/' + uid).get()).exists && d.role === 'admin') role = 'admin';
  else { const u = await db.doc('users/' + uid).get(); role = u.exists ? u.data().role : null; }
  const e = {ts:now, ev:String(d.ev || 'login').slice(0, 20), ip, dev:String(d.dev || '').slice(0, 120), did:String(d.did || '').slice(0, 40), net:String(d.net || '').slice(0, 10),
    lang:String(d.lang || '').slice(0, 20), ua:String(req.rawRequest.headers['user-agent'] || '').slice(0, 200), role:role || '', server:true};
  await db.collection(`users/${uid}/logins`).add(e);
  const last = {lastIp:ip, lastDev:e.dev, lastLogin:now};
  if(role === 'karigar') await db.doc(`karigars/${uid}/private/main`).set(last, {merge:true});
  if(role === 'customer') await db.doc(`customers/${uid}`).set(last, {merge:true});
  if(role === 'admin' && e.ev !== 'open') await db.collection('audit').add({action:'એડમિન લૉગિન', target:'', note:`IP ${ip} · ${e.dev}`, ts:now, server:true});
  return {ip, ts:now};
});

/* ---------- OTP ચકાસણી (કારીગર OTP જોઈ શકતો નથી) ---------- */
exports.verifyOtp = onCall(async req => {
  if(!req.auth) throw new HttpsError('unauthenticated', 'લૉગિન જરૂરી');
  const {bookingId, otp} = req.data || {}; if(!bookingId) throw new HttpsError('invalid-argument', 'bookingId');
  const ref = db.doc('bookings/' + bookingId), oref = db.doc(`bookings/${bookingId}/otp/main`);
  return db.runTransaction(async t => {
    const b = await t.get(ref); if(!b.exists) throw new HttpsError('not-found', 'બુકિંગ નથી');
    const x = b.data(); if(x.karigarId !== req.auth.uid) throw new HttpsError('permission-denied', 'આ કામ તમારું નથી');
    if(x.status !== 'arrived') return {ok:false, reason:'status'};
    if((x.otpFails || 0) >= 5) return {ok:false, locked:true};
    const o = await t.get(oref); const good = o.exists && String(o.data().otp) === String(otp || '').trim();
    if(!good){ t.update(ref, {otpFails:FieldValue.increment(1)}); return {ok:false}; }
    t.update(ref, {status:'working', 'timeline.working':Date.now()}); return {ok:true};
  });
});

/* ---------- બુકિંગ: નવી વિનંતી ---------- */
exports.onBookingCreated = onDocumentCreated('bookings/{id}', async ev => {
  const b = ev.data && ev.data.data(); if(!b) return;
  if(b.status === 'searching') await notifyNearby(ev.params.id, b);
  else if(b.status === 'requested' && b.karigarId) await notifyKarigar(ev.params.id, b);
});

const CUST_MSG = {accepted:'✅ કારીગરે કામ સ્વીકાર્યું', onway:'🛵 કારીગર રસ્તામાં છે', arrived:'📍 કારીગર પહોંચી ગયા — OTP આપો', billed:'🧾 બિલ તૈયાર છે', done:'✔ કામ પૂરું — રેટિંગ આપો', rejected:'કારીગર હાલ આવી શકે તેમ નથી — બીજાને મોકલો'};
exports.onBookingUpdated = onDocumentUpdated('bookings/{id}', async ev => {
  const a = ev.data.before.data() || {}, b = ev.data.after.data() || {}, id = ev.params.id, jobs = [];
  // ફરી "બધાને" મોકલ્યું
  if(b.status === 'searching' && a.status !== 'searching') jobs.push(notifyNearby(id, b));
  if(b.status === 'requested' && (a.status !== 'requested' || a.karigarId !== b.karigarId) && b.karigarId) jobs.push(notifyKarigar(id, b));
  // ગ્રાહકને સ્થિતિ
  if(a.status !== b.status && CUST_MSG[b.status]) jobs.push(tokensOf('users', [b.custId]).then(l => send(l, {type:'status', bookingId:id, title:'થઈ જશે! — ' + (CAT[b.cat] || ''), body:CUST_MSG[b.status]})));
  // રેટિંગ ગણતરી (ગ્રાહક કારીગરનો દસ્તાવેજ બદલી શકતો નથી, તેથી અહીં)
  if(!a.rating && b.rating && b.karigarId) jobs.push(db.doc('karigars/' + b.karigarId).update({ratingSum:FieldValue.increment(+b.rating), ratingCount:FieldValue.increment(1)}).catch(e => logger.warn(e)));
  if(!a.kRating && b.kRating && b.custId) jobs.push(db.doc('customers/' + b.custId).update({ratingSum:FieldValue.increment(+b.kRating), ratingCount:FieldValue.increment(1)}).catch(e => logger.warn(e)));
  await Promise.all(jobs);
});

/* ---------- SOS અને ફરિયાદ ---------- */
exports.onAlertCreated = onDocumentCreated('alerts/{id}', async ev => { const a = ev.data && ev.data.data(); if(!a) return;
  await notifyAdmins({type:'sos', alertId:ev.params.id, bookingId:a.bookingId || '', title:'🆘 SOS: ' + (a.name || ''), body:`${a.mobile || ''} · ${a.role === 'karigar' ? 'કારીગર' : 'ગ્રાહક'} — તરત સંપર્ક કરો`}); });
exports.onTicketCreated = onDocumentCreated('tickets/{id}', async ev => { const t = ev.data && ev.data.data(); if(!t) return;
  await notifyAdmins({type:'ticket', ticketId:ev.params.id, title:'🎧 નવી ફરિયાદ ' + (t.no || ''), body:`${t.userName || ''}: ${String(t.topic || '')}`}); });

/* ---------- ખાતું ડિલીટ ---------- */
exports.onKarigarDeleted = onDocumentDeleted('karigars/{id}', async ev => { const id = ev.params.id;
  await db.doc(`karigars/${id}/private/main`).delete().catch(() => {});
  await db.doc('kyc/' + id).set({deleteAfter:Date.now() + 30 * DAY}, {merge:true}).catch(() => {}); });

/* ---------- રોજ સફાઈ: 1 વર્ષથી જૂના લોકેશન/લૉગિન લૉગ, સમય પૂરો થયેલ KYC ---------- */
async function purge(q){ let n = 0; for(;;){ const s = await q.limit(400).get(); if(s.empty) break; const bt = db.batch(); s.docs.forEach(d => bt.delete(d.ref)); await bt.commit(); n += s.size; if(s.size < 400) break; } return n; }
exports.dailyCleanup = onSchedule({schedule:'every day 03:15', timeZone:'Asia/Kolkata'}, async () => {
  const cut = Date.now() - YEAR;
  const a = await purge(db.collectionGroup('locations').where('ts', '<', cut));
  const b = await purge(db.collectionGroup('logins').where('ts', '<', cut));
  let k = 0; const old = await db.collection('kyc').where('deleteAfter', '<', Date.now()).get();
  for(const d of old.docs){ await getStorage().bucket().deleteFiles({prefix:`kyc/${d.id}/`}).catch(() => {}); await d.ref.delete(); k++; }
  logger.info('cleanup', {locations:a, logins:b, kyc:k});
});
