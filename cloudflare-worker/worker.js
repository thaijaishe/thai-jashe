/* થઈ જશે! — મફત સર્વર (Cloudflare Worker) — Firebase Blaze / Cloud Functions ની જગ્યાએ
 *
 *  POST /log     — લૉગિન/એપ ખોલવાનો સમય અને સાચો IP (Cloudflare જુએ તે) Firestore માં: users/{uid}/logins
 *  POST /notify  — Push સૂચના (FCM): નવી વિનંતી → ત્રિજ્યામાંના ઓનલાઇન કારીગરો (એપ બંધ હોય તો 60 સેકન્ડ રિંગ),
 *                  બુકિંગ સ્થિતિ → ગ્રાહક/કારીગર, SOS અને ફરિયાદ → એડમિન
 *  દરરોજ રાત્રે (Cron) — 1 વર્ષથી જૂના લોકેશન/લૉગિન લૉગ અને સમય પૂરો થયેલ KYC ભૂંસે
 *
 *  Cloudflare માં જરૂરી:  Secret  FIREBASE_SA  = Firebase service account ની આખી JSON કી
 *                         (વૈકલ્પિક) Variable FIREBASE_PROJECT_ID — ન મૂકો તો JSON માંથી લેવાય
 *                         Cron trigger: "45 21 * * *"  (ભારતમાં રાત્રે 3:15)
 *  દરેક વિનંતી એપના Firebase ID token થી ચકાસાય છે — કોઈ બહારનો વ્યક્તિ સૂચના મોકલી શકે નહીં.
 */

const catT = c => CAT[c] || (String(c || '').startsWith('x:') ? String(c).slice(2) : '');
const CAT = {ac:'એસી રિપેર', plumber:'પ્લમ્બર', electrician:'ઇલેક્ટ્રિશિયન', carpenter:'સુથાર', painter:'કલરકામ', cleaning:'ઘર સફાઈ', mason:'કડિયા', welder:'વેલ્ડર',
  mechanic:'બાઇક/કાર મિકેનિક', appliance:'ફ્રિજ/વોશિંગ મશીન', ro:'RO રિપેર', cctv:'CCTV/કમ્પ્યુટર', tailor:'દરજી', cobbler:'મોચી', gardener:'માળી', pest:'પેસ્ટ કંટ્રોલ',
  cook:'રસોઇયા', beauty:'બ્યુટીશિયન', locksmith:'ચાવીવાળો', roofing:'છત/પતરાં', glass:'કાચકામ', tiles:'ટાઇલ્સ', generator:'ઇન્વર્ટર/જનરેટર', solar:'સોલાર',
  movers:'ઘરવખરી શિફ્ટિંગ', pop:'ઇન્ટિરિયર/POP', maid:'ઘરકામ', driver:'ડ્રાઇવર', other:'અન્ય કામ', agent:'એજન્ટ', puncture:'ઘર બેઠા પંચર'};
/* વિસ્તાર: કોઈ તૈયાર શહેર-યાદી નથી — નકશા/GPS થી પસંદ થયેલ areaGeo વપરાય */
const CUST_MSG = {accepted:'✅ કારીગરે કામ સ્વીકાર્યું', onway:'🛵 કારીગર રસ્તામાં છે', arrived:'📍 કારીગર પહોંચી ગયા — OTP આપો', billed:'🧾 બિલ તૈયાર છે',
  done:'✔ કામ પૂરું — રેટિંગ આપો', rejected:'કારીગર હાલ આવી શકે તેમ નથી — બીજાને મોકલો', cancelled:'બુકિંગ રદ થયું'};
const DAY = 86400000;
const areaLL = g => g && isFinite(g.lat) && isFinite(g.lng) ? {lat:+g.lat, lng:+g.lng} : null;
function km(a, b){ const R = 6371, r = x => x * Math.PI / 180, dLa = r(b.lat - a.lat), dLo = r(b.lng - a.lng);
  const q = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(q)); }

/* ---------- base64url / crypto helpers ---------- */
const te = new TextEncoder();
const b64u = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uBuf = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while(s.length % 4) s += '='; const bin = atob(s); const u = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const decJson = s => JSON.parse(new TextDecoder().decode(unb64u(s)));
const pem = p => unb64u(p.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '').replace(/\+/g, '-').replace(/\//g, '_'));

const SA = env => { if(!env.__sa) env.__sa = JSON.parse(env.FIREBASE_SA); return env.__sa; };
const PID = env => env.FIREBASE_PROJECT_ID || SA(env).project_id;

/* ---------- Google service-account access token (Firestore + FCM) ---------- */
let TOKEN = null;
async function accessToken(env){
  const now = Math.floor(Date.now() / 1000); if(TOKEN && TOKEN.exp > now + 60) return TOKEN.t;
  const sa = SA(env);
  const head = b64u(JSON.stringify({alg:'RS256', typ:'JWT'}));
  const claim = b64u(JSON.stringify({iss:sa.client_email, scope:'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging',
    aud:'https://oauth2.googleapis.com/token', iat:now, exp:now + 3600}));
  const key = await crypto.subtle.importKey('pkcs8', pem(sa.private_key), {name:'RSASSA-PKCS1-v1_5', hash:'SHA-256'}, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, te.encode(head + '.' + claim));
  const r = await fetch('https://oauth2.googleapis.com/token', {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + head + '.' + claim + '.' + b64uBuf(sig)});
  const j = await r.json(); if(!j.access_token) throw new Error('google token: ' + JSON.stringify(j));
  TOKEN = {t:j.access_token, exp:now + (j.expires_in || 3600)}; return TOKEN.t;
}

/* ---------- Firebase ID token (એપના વપરાશકાર) ચકાસણી ---------- */
let JWKS = null;
async function verifyUser(req, env){
  const t = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''); const [h, p, s] = t.split('.'); if(!s) throw new Error('no token');
  const head = decJson(h), pl = decJson(p), pid = PID(env), now = Date.now() / 1000;
  if(pl.aud !== pid || pl.iss !== 'https://securetoken.google.com/' + pid || !pl.sub || pl.exp < now || pl.iat > now + 300) throw new Error('bad token');
  if(!JWKS || JWKS.exp < Date.now()){ const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'); JWKS = {keys:(await r.json()).keys, exp:Date.now() + 3600e3}; }
  const jwk = JWKS.keys.find(k => k.kid === head.kid); if(!jwk) throw new Error('unknown key');
  const key = await crypto.subtle.importKey('jwk', jwk, {name:'RSASSA-PKCS1-v1_5', hash:'SHA-256'}, false, ['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64u(s), te.encode(h + '.' + p))) throw new Error('bad signature');
  return pl.sub;
}

/* ---------- Firestore REST ---------- */
function toV(v){ if(v === null || v === undefined) return {nullValue:null}; if(typeof v === 'boolean') return {booleanValue:v};
  if(typeof v === 'number') return Number.isInteger(v) ? {integerValue:String(v)} : {doubleValue:v}; if(typeof v === 'string') return {stringValue:v};
  if(Array.isArray(v)) return {arrayValue:{values:v.map(toV)}}; return {mapValue:{fields:toF(v)}}; }
const toF = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, toV(v)]));
function fromV(v){ if('nullValue' in v) return null; if('booleanValue' in v) return v.booleanValue; if('integerValue' in v) return Number(v.integerValue); if('doubleValue' in v) return v.doubleValue;
  if('stringValue' in v) return v.stringValue; if('timestampValue' in v) return Date.parse(v.timestampValue); if('arrayValue' in v) return (v.arrayValue.values || []).map(fromV);
  if('mapValue' in v) return fromF(v.mapValue.fields || {}); return null; }
const fromF = f => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, fromV(v)]));
const docsBase = env => `https://firestore.googleapis.com/v1/projects/${PID(env)}/databases/(default)/documents`;
const docName = (env, path) => `projects/${PID(env)}/databases/(default)/documents/${path}`;
async function fsFetch(env, url, opt = {}){ const r = await fetch(url, {...opt, headers:{'Content-Type':'application/json', Authorization:'Bearer ' + await accessToken(env)}});
  if(r.status === 404) return null; const j = await r.json(); if(!r.ok) throw new Error('firestore ' + r.status + ': ' + JSON.stringify(j).slice(0, 300)); return j; }
async function getDocU(env, path){ const j = await fsFetch(env, docsBase(env) + '/' + path); return j ? {id:path.split('/').pop(), name:j.name, updateTime:j.updateTime, d:fromF(j.fields)} : null; }
async function getDoc(env, path){ const j = await fsFetch(env, docsBase(env) + '/' + path); return j ? {id:path.split('/').pop(), ...fromF(j.fields)} : null; }
async function addDoc(env, col, data){ return fsFetch(env, docsBase(env) + '/' + col, {method:'POST', body:JSON.stringify({fields:toF(data)})}); }
async function setMerge(env, path, data){ const mask = Object.keys(data).map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
  return fsFetch(env, docsBase(env) + '/' + path + '?' + mask, {method:'PATCH', body:JSON.stringify({fields:toF(data)})}); }
async function query(env, sq, parent = ''){ const j = await fsFetch(env, docsBase(env) + (parent ? '/' + parent : '') + ':runQuery', {method:'POST', body:JSON.stringify({structuredQuery:sq})});
  return (j || []).filter(x => x.document).map(x => ({id:x.document.name.split('/').pop(), name:x.document.name, ...fromF(x.document.fields)})); }
const eq = (f, v) => ({fieldFilter:{field:{fieldPath:f}, op:'EQUAL', value:toV(v)}});
const and = (...fs) => ({compositeFilter:{op:'AND', filters:fs}});
async function commit(env, writes){ if(!writes.length) return; return fsFetch(env, `https://firestore.googleapis.com/v1/projects/${PID(env)}/databases/(default)/documents:commit`, {method:'POST', body:JSON.stringify({writes})}); }

/* ---------- FCM (HTTP v1) ---------- */
async function tokensOf(env, col, ids){ const out = []; for(const id of [...new Set(ids)].filter(Boolean)){ const d = await getDoc(env, `${col}/${id}`); (d && d.fcm || []).forEach(t => out.push({col, id, t})); } return out; }
let LASTERR = '';
async function push(env, list, data, ring, validateOnly){
  const str = {}; for(const k in data) str[k] = String(data[k] == null ? '' : data[k]); let sent = 0; const dead = []; LASTERR = '';
  for(const x of list){
    const message = ring ? {token:x.t, data:str, android:{priority:'HIGH', ttl:'60s'}}   // data-only: એપનો TJMessagingService 60 સેકન્ડ ફોનની રિંગ વગાડે
      : {token:x.t, data:str, notification:{title:str.title, body:str.body}, android:{priority:'HIGH', notification:{channel_id:'tj_alert', sound:'default'}}};
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${PID(env)}/messages:send`, {method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer ' + await accessToken(env)}, body:JSON.stringify(validateOnly ? {message, validate_only:true} : {message})});
    if(r.ok) sent++; else { const j = await r.json().catch(() => ({})); LASTERR = r.status + ' ' + String((j.error && (j.error.status + ': ' + j.error.message)) || '').slice(0, 300); if(r.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(JSON.stringify(j))) dead.push(x); }
  }
  if(dead.length) await commit(env, dead.map(x => ({transform:{document:docName(env, `${x.col}/${x.id}`), fieldTransforms:[{fieldPath:'fcm', removeAllFromArray:{values:[toV(x.t)]}}]}}))).catch(() => {});
  return sent;
}
async function notifyAdmins(env, data){ const A = await query(env, {from:[{collectionId:'admins'}]}); const list = []; A.forEach(a => (a.fcm || []).forEach(t => list.push({col:'admins', id:a.id, t}))); return push(env, list, data); }
async function notifyNearby(env, id, b){
  const st = await getDoc(env, 'settings/main') || {}, R = +st.radiusKm || 25, bp = b.geoR || areaLL(b.areaGeo), skip = new Set(b.rejectedBy || []);
  // કારીગરના એક થી વધુ કામ (cats); "અન્ય કામ" ની વિનંતી જાતે લખેલા કામ (x:...) વાળાને પણ
  const has = k => (Array.isArray(k.cats) && k.cats.length ? k.cats : [k.cat]).some(c => c === b.cat || (b.cat === 'other' && (c === 'other' || String(c || '').startsWith('x:'))));
  const ks = (await query(env, {from:[{collectionId:'karigars'}], where:and(eq('status', 'approved'), eq('online', true))})).filter(has);
  const ids = [];
  for(const k of ks){ if(skip.has(k.id)) continue; const p = await getDoc(env, `karigars/${k.id}/private/main`) || {};
    const kp = p.loc && Date.now() - p.loc.ts < 30 * 60000 ? p.loc : areaLL(k.areaGeo); if(!bp || !kp || km(bp, kp) <= R) ids.push(k.id); }
  return push(env, await tokensOf(env, 'users', ids), {type:'request', bookingId:id, title:'🔔 નવું કામ: ' + (catT(b.cat) || 'કામ'), body:`${String(b.area || '').slice(0, 40)} · ${String(b.problem || '').slice(0, 60)}`}, true);
}

/* ---------- endpoints ---------- */
async function doLog(env, uid, d, req){
  const ip = req.headers.get('CF-Connecting-IP') || '', now = Date.now(), cf = req.cf || {};
  let role = null; if(d.role === 'admin' && await getDoc(env, 'admins/' + uid)) role = 'admin'; else { const u = await getDoc(env, 'users/' + uid); role = u ? u.role : null; }
  const e = {ts:now, ev:String(d.ev || 'login').slice(0, 20), ip, dev:String(d.dev || '').slice(0, 120), did:String(d.did || '').slice(0, 40), net:String(d.net || '').slice(0, 10),
    lang:String(d.lang || '').slice(0, 20), ua:String(req.headers.get('User-Agent') || '').slice(0, 200), city:cf.city || '', region:cf.region || '', role:role || '', server:true};
  await addDoc(env, `users/${uid}/logins`, e);
  const last = {lastIp:ip, lastDev:e.dev, lastLogin:now};
  if(role === 'karigar') await setMerge(env, `karigars/${uid}/private/main`, last);
  if(role === 'customer') await setMerge(env, `customers/${uid}`, last);
  if(role === 'admin' && e.ev !== 'open') await addDoc(env, 'audit', {action:'એડમિન લૉગિન', target:'', note:`IP ${ip} · ${e.dev}`, ts:now, server:true});
  return {ok:true, ip};
}
async function doNotify(env, uid, d, ctx){
  const {type, id} = d || {}; if(type !== 'test' && (!id || !/^[\w-]{1,80}$/.test(id))) throw new Error('bad id');
  if(type === 'request' || type === 'status'){
    const b = await getDoc(env, 'bookings/' + id); if(!b) return {ok:false};
    const party = uid === b.custId || uid === b.karigarId || (b.rejectedBy || []).includes(uid); if(!party) throw new Error('not allowed');
    if(type === 'request'){
      if(b.status === 'searching') return {ok:true, sent:await notifyNearby(env, id, b)};
      if(b.status === 'requested' && b.karigarId) return {ok:true, sent:await push(env, await tokensOf(env, 'users', [b.karigarId]),
        {type:'request', bookingId:id, title:'🔔 ખાસ તમને વિનંતી: ' + (catT(b.cat) || 'કામ'), body:`${String(b.area || '').slice(0, 40)} · ${String(b.problem || '').slice(0, 60)}`}, true)};
      return {ok:true, sent:0};
    }
    const to = uid === b.karigarId ? b.custId : b.karigarId; const msg = CUST_MSG[b.status]; if(!to || !msg) return {ok:true, sent:0};
    return {ok:true, sent:await push(env, await tokensOf(env, 'users', [to]), {type:'status', bookingId:id, title:'થઈ જશે! — ' + catT(b.cat), body:msg})};
  }
  if(type === 'refer'){   // રેફર એન્ડ અર્ન: કામ પૂરું થાય ત્યારે ઇનામ (ફક્ત સર્વર લખી શકે — કોઈ ગ્રાહક જાતે બેલેન્સ વધારી ન શકે)
    const b = await getDoc(env, 'bookings/' + id); if(!b) return {ok:false};
    if(uid !== b.custId && uid !== b.karigarId) throw new Error('not allowed');
    if(b.status !== 'done') return {ok:true, skip:'not done'};
    const st = await getDoc(env, 'settings/main') || {}, out = {};
    const inc = (path, field, n) => ({transform:{document:docName(env, path), fieldTransforms:[{fieldPath:field, increment:toV(n)}]}});
    const upd = (path, data, ut) => ({update:{name:docName(env, path), fields:toF(data)}, updateMask:{fieldPaths:Object.keys(data)}, ...(ut ? {currentDocument:{updateTime:ut}} : {})});
    // ૧) બુકિંગમાં વાપરેલું બેલેન્સ ઓછું કરો (એક જ વાર)
    const bu = await getDocU(env, 'bookings/' + id);
    if(b.coupon && b.coupon.ref === 'bal' && !b.balUsed){ const c = await getDoc(env, 'customers/' + b.custId) || {}; const use = Math.min(+(b.bill && b.bill.discount) || 0, +c.refBal || 0);
      try{ await commit(env, [upd('bookings/' + id, {balUsed:true}, bu.updateTime), ...(use > 0 ? [inc('customers/' + b.custId, 'refBal', -use)] : [])]); out.balUsed = use; }catch(e){ out.balErr = String(e.message).slice(0, 80); } }
    // ૨) ગ્રાહક રેફરલ: મિત્રનું પહેલું કામ પૂરું → મોકલનારને બેલેન્સ
    const cu = await getDocU(env, 'customers/' + b.custId);
    if(st.refOn !== false && cu && cu.d.referredBy && !cu.d.refDone && cu.d.referredBy !== b.custId){ const amt = Math.max(0, +(st.refMe ?? 50));
      const ref = await getDoc(env, 'customers/' + cu.d.referredBy);
      try{ await commit(env, [upd('customers/' + b.custId, {refDone:true}, cu.updateTime), ...(ref && amt ? [inc('customers/' + cu.d.referredBy, 'refBal', amt)] : []),
        upd('referrals/' + b.custId, {status:'rewarded', amt:ref ? amt : 0, doneAt:Date.now(), bookingId:id})]); out.custReward = ref ? amt : 0; }catch(e){ out.custErr = String(e.message).slice(0, 80); } }
    // ૩) કારીગર રેફરલ: નવો કારીગર N કામ પૂરાં કરે → જૂના કારીગરનું કમીશન માફ
    const ku = b.karigarId ? await getDocU(env, 'karigars/' + b.karigarId) : null, need = Math.max(1, +(st.kRefJobs ?? 5));
    if(st.kRefOn !== false && ku && ku.d.referredBy && !ku.d.refDone && (+ku.d.jobs || 0) >= need && ku.d.referredBy !== b.karigarId){ const amt = Math.max(0, +(st.kRefWaive ?? 100));
      const ref = await getDoc(env, `karigars/${ku.d.referredBy}/private/main`);
      try{ await commit(env, [upd('karigars/' + b.karigarId, {refDone:true}, ku.updateTime), ...(ref && amt ? [inc(`karigars/${ku.d.referredBy}/private/main`, 'commissionDue', -amt)] : []),
        upd('referrals/' + b.karigarId, {status:'rewarded', amt:ref ? amt : 0, doneAt:Date.now(), bookingId:id})]); out.kWaive = ref ? amt : 0; }catch(e){ out.kErr = String(e.message).slice(0, 80); } }
    return {ok:true, ...out};
  }
  if(type === 'test'){   // સૂચના ચકાસણી: પહેલા token ચકાસે, પછી 8 સેકન્ડ પછી ખરેખર મોકલે (એપ બંધ કરવાનો સમય)
    const role = d.role === 'admin' ? 'admins' : 'users'; const u = await getDoc(env, `${role}/${uid}`); const list = (u && u.fcm || []).map(t => ({col:role, id:uid, t}));
    if(!list.length) return {ok:false, tokens:0, error:'ફોનનો token સર્વર પર નથી'};
    const ring = d.ring === true, msg = ring ? {type:'request', bookingId:'test', title:'🔔 ટેસ્ટ રિંગ — થઈ જશે!', body:'સૂચના બરાબર ચાલે છે ✔'} : {type:'status', bookingId:'', title:'🔔 ટેસ્ટ — થઈ જશે!', body:'સૂચના બરાબર ચાલે છે ✔'};
    const ok = await push(env, list, msg, ring, true); const err = LASTERR;
    if(ok && ctx) ctx.waitUntil(new Promise(r => setTimeout(r, 8000)).then(() => push(env, list, msg, ring)));
    return {ok:ok > 0, tokens:list.length, valid:ok, error:ok ? '' : err};
  }
  if(type === 'sos'){ const a = await getDoc(env, 'alerts/' + id); if(!a || a.userId !== uid) throw new Error('not allowed');
    return {ok:true, sent:await notifyAdmins(env, {type:'sos', alertId:id, bookingId:a.bookingId || '', title:'🆘 SOS: ' + (a.name || ''), body:`${a.mobile || ''} · ${a.role === 'karigar' ? 'કારીગર' : 'ગ્રાહક'} — તરત સંપર્ક કરો`})}; }
  if(type === 'ticket'){ const t = await getDoc(env, 'tickets/' + id); if(!t || t.userId !== uid) throw new Error('not allowed');
    return {ok:true, sent:await notifyAdmins(env, {type:'ticket', ticketId:id, title:'🎧 નવી ફરિયાદ ' + (t.no || ''), body:`${t.userName || ''}: ${String(t.topic || '')}`})}; }
  throw new Error('bad type');
}
async function cleanup(env){
  const cut = Date.now() - 365 * DAY, out = {};
  for(const col of ['locations', 'logins']){ let n = 0;
    for(let i = 0; i < 20; i++){ const rows = await query(env, {from:[{collectionId:col, allDescendants:true}], where:{fieldFilter:{field:{fieldPath:'ts'}, op:'LESS_THAN', value:toV(cut)}}, limit:300});
      if(!rows.length) break; await commit(env, rows.map(r => ({delete:r.name}))); n += rows.length; if(rows.length < 300) break; }
    out[col] = n; }
  const old = await query(env, {from:[{collectionId:'kyc'}], where:{fieldFilter:{field:{fieldPath:'deleteAfter'}, op:'LESS_THAN', value:toV(Date.now())}}, limit:200});
  await commit(env, old.map(r => ({delete:r.name}))); out.kyc = old.length;   // KYC ફોટા એ જ દસ્તાવેજમાં છે, એટલે સાથે ભૂંસાય
  return out;
}

/* સુરક્ષા: ફક્ત તમારી વેબસાઇટ અને એપ જ આ સર્વરને બોલાવી શકે (બીજી સાઇટ નહીં). વધારાની સાઇટ: Cloudflare માં ALLOWED_ORIGINS variable (અલ્પવિરામથી) */
const ORIGINS = ['https://thaijaishe.github.io', 'https://localhost', 'capacitor://localhost', 'http://localhost'];
let ORIGIN = '';
const allowOrigin = (req, env) => { const o = req.headers.get('Origin') || ''; const list = ORIGINS.concat(String(env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean)); return list.includes(o) ? o : ''; };
const CORS = () => ({'Access-Control-Allow-Origin':ORIGIN || 'https://thaijaishe.github.io', 'Vary':'Origin', 'Access-Control-Allow-Methods':'POST, GET, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type, Authorization', 'Access-Control-Max-Age':'86400',
  'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer'});
const json = (o, s = 200) => new Response(JSON.stringify(o), {status:s, headers:{...CORS(), 'Content-Type':'application/json; charset=utf-8'}});

export default {
  async fetch(req, env, ctx){
    ORIGIN = allowOrigin(req, env); const hasOrigin = !!req.headers.get('Origin');
    if(req.method === 'OPTIONS') return new Response(null, {status:ORIGIN ? 204 : 403, headers:CORS()});
    if(req.method === 'POST' && hasOrigin && !ORIGIN) return json({error:'origin not allowed'}, 403); // બીજી વેબસાઇટ પરથી આવેલી વિનંતી બંધ
    if(req.method === 'POST' && +(req.headers.get('Content-Length') || 0) > 20000) return json({error:'too large'}, 413);
    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    if(req.method === 'GET') return json({ok:true, app:'થઈ જશે! સર્વર', project:env.FIREBASE_SA ? PID(env) : 'FIREBASE_SA નથી'});
    if(!env.FIREBASE_SA) return json({error:'FIREBASE_SA secret ઉમેરો'}, 500);
    let uid; try{ uid = await verifyUser(req, env); }catch(e){ return json({error:'unauthorized'}, 401); }
    let body = {}; try{ body = await req.json(); }catch(e){}
    try{
      if(path === '/log') return json(await doLog(env, uid, body, req));
      if(path === '/notify') return json(await doNotify(env, uid, body, ctx));
      return json({error:'not found'}, 404);
    }catch(e){ return json({error:String(e.message || e)}, /not allowed|bad/.test(e.message) ? 403 : 500); }
  },
  async scheduled(event, env, ctx){ if(env.FIREBASE_SA) ctx.waitUntil(cleanup(env).then(r => console.log('cleanup', JSON.stringify(r)))); }
};
export const _test = {verifyUser, accessToken, toF, fromF, doNotify, doLog, cleanup, km};
