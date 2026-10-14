# થઈ જશે! (Thai Jashe!) — Android એપ પ્રોજેક્ટ

આ ફોલ્ડરમાં વેબસાઇટ, અલગ એડમિન પેનલ, Android એપ અને Firebase નિયમો અને મફત Cloudflare સર્વર છે.
પૂરી સ્ટેપ-બાય-સ્ટેપ માર્ગદર્શિકા: **`ThaiJashe_Live_Karvani_Rit.docx` (આવૃત્તિ 3 — સંપૂર્ણ મફત)**.

## ફોલ્ડર
| ફાઇલ | શું છે |
|---|---|
| `www/index.html` | આખી એપ (વેબસાઇટ પણ આ જ) |
| `www/privacy.html` | પ્રાઇવસી પોલિસી (Play Store માટે ફરજિયાત) — [કૌંસ] વાળી જગ્યા ભરો |
| `www/delete-account.html` | ખાતું ડિલીટ કરવાની રીત (Play Store માટે ફરજિયાત) |
| `www/terms.html`, `karigar-terms.html`, `refund-policy.html` | ગ્રાહક શરતો, કારીગર શરતો, રદ/રિફંડ નીતિ |
| `www/contact.html`, `grievance.html`, `about.html`, `safety.html` | સંપર્ક, ફરિયાદ અધિકારી (IT નિયમો 2021), અમારા વિશે, સલામતી |

> એપની અંદર પણ આ બધાં પેજ છે. એડમિન → વધુ → સેટિંગમાં "કંપની / પોલિસી વિગત" ભરશો એટલે એપમાંનાં પેજમાં આપમેળે આવી જશે. વેબસાઇટ વાળી `.html` ફાઇલોમાં પીળી [કૌંસ] વાળી જગ્યા હાથે ભરો.
>
> **લોકેશન:** કારીગર ઓનલાઇન હોય ત્યારે GPS લેવાય છે. Play Console → Data safety માં "Location — Precise, App functionality + Fraud prevention, Not shared" અને "Device or other IDs" ઉમેરવું. Background location વપરાતું નથી.
| `www/manifest.webmanifest`, `www/sw.js` | ફોનમાં "Install" થાય તેવી વેબ એપ (PWA) |
| `assets/` | આઇકન અને સ્પ્લેશ — એપ બનતી વખતે બધાં કદ આપમેળે બને છે |
| `capacitor.config.json` | એપ ID `com.thaijashe.app` (Play Store પર મૂક્યા પછી બદલી શકાતું નથી) |
| `.github/workflows/build-android.yml` | GitHub પર જ APK અને AAB બનાવે |
| `.github/workflows/create-keystore.yml` | Play Store માટે upload key (એક જ વાર) |
| `.github/workflows/website.yml` | `www` ફોલ્ડરને GitHub Pages વેબસાઇટ તરીકે લાઇવ કરે |

## ટૂંકમાં પગલાં
1. આ આખું ફોલ્ડર નવા GitHub repository માં અપલોડ કરો (ફોલ્ડર અંદરની ફાઇલો, `.github` સહિત).
2. `www/config.js` માં `window.TJ_FIREBASE_CONFIG` ભરો (લાઇવ ડેટા માટે) — વિગત નીચે v8 વિભાગમાં.
3. Settings → Pages → Build and deployment → Source: **GitHub Actions** પસંદ કરો. પછી Actions → **વેબસાઇટ લાઇવ કરો** આપમેળે ચાલશે અને વેબસાઇટ `https://<તમારું-username>.github.io/<repo-નામ>/` પર લાઇવ થશે.
4. Actions → **Android એપ બનાવો** → Run workflow → 6–10 મિનિટ પછી Artifacts માંથી `ThaiJashe-test-apk` ડાઉનલોડ કરી ફોનમાં ઇન્સ્ટોલ કરો.
5. Play Store માટે: Actions → **Upload key બનાવો (એક જ વાર)** → ZIP સાચવો → Settings → Secrets → 4 secrets ઉમેરો:
   `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS` (= `thaijashe`), `KEY_PASSWORD`.
6. ફરી **Android એપ બનાવો** ચલાવો → `ThaiJashe-playstore-aab` માંથી `.aab` Play Console માં અપલોડ કરો.

## જાતે કમ્પ્યુટર પર બનાવવી હોય તો
Node 22, Java 21 અને Android Studio જોઈએ:
```
npm install
npx cap add android
npm run assets
npx cap sync android
npx cap open android
```

## નવું (v5): ભાષા + PDF / Excel રિપોર્ટ

- **ગુજરાતી / English:** દરેક સ્ક્રીનના ઉપરના જમણા ખૂણે 🌐 બટન. પોલિસી પેજ પણ બંને ભાષામાં (`*-en.html`).
- **ડેટા રિપોર્ટ:** એડમિન → વધુ → "ડેટા રિપોર્ટ (PDF / Excel)", અથવા કોઈ પણ કારીગર / ગ્રાહકની વિગતમાં 📄 PDF / 📊 Excel.
  ફોટા, પ્રોફાઇલ, KYC, બધા ઓર્ડર, નકશો, લોકેશન ઇતિહાસ (Google Maps લિંક), IP/ડિવાઇસ લૉગ, ચૂકવણી, ફરિયાદ, SOS.
- લાઇબ્રેરી `www/lib/` માં છે (ExcelJS, jsPDF, html2canvas), એટલે એપમાં ઇન્ટરનેટ વગર પણ રિપોર્ટ બને.
- Android એપમાં ફાઇલ `@capacitor/filesystem` + `@capacitor/share` થી "શેર" મેનુ દ્વારા સેવ / WhatsApp / Drive માં મોકલાય છે (package.json માં ઉમેર્યા છે, GitHub બિલ્ડ આપમેળે ઇન્સ્ટોલ કરશે).

## નવું (v6): એડમિન પેનલ અલગ

- **ગ્રાહક + કારીગર એપ** (`www/`) માં હવે એડમિનનું બટન કે એડમિનનો કોડ નથી. Play Store પર આ જ એપ જાય છે.
- **એડમિન પેનલ** (`admin-web/`) અલગ વેબ એપ છે. GitHub Pages પર `https://<તમારું-નામ>.github.io/<repo>/admin/` પર ખૂલશે.
  ફોનમાં Chrome માં ખોલી મેનુ → "Add to Home screen" કરો એટલે એપની જેમ આઇકન આવી જશે (નામ: TJ Admin).
- બંને એક જ Firebase ડેટાબેઝ વાપરે છે, એટલે કારીગરની નોંધણી, બુકિંગ, SOS તરત એડમિનમાં દેખાય.
- એડમિનનું લૉગિન અલગ રહે છે — એક જ ફોનમાં ગ્રાહક/કારીગર એપ અને એડમિન બંને ચાલુ રાખી શકાય.
- **સુરક્ષા:** એડમિન PIN બ્રાઉઝરમાં ચકાસાય છે. લાઇવ કરતાં પહેલાં Firebase Authentication (એડમિન ઈમેલ લૉગિન) અને Firestore Security Rules જરૂરથી મૂકો, જેથી ફક્ત એડમિન જ બધો ડેટા વાંચી શકે.

## Play Store વગર ચાલુ કરવાની રીત (v7)

હાલ Play Store પર મૂકવાની જરૂર નથી. એપ બે રીતે લોકો સુધી પહોંચે છે:

1. **વેબસાઇટ / હોમ સ્ક્રીન એપ (PWA):** `https://<તમારું-નામ>.github.io/<repo>/` — Android અને iPhone બંનેમાં "Add to Home screen" થી આઇકન. એપમાં પહેલા પાને "📲 ફોનમાં એપ રાખો" કાર્ડ આવે છે. અપડેટ આપમેળે.
2. **APK ફાઇલ:** "Android એપ બનાવો" workflow દરેક વખતે APK બનાવી **GitHub Releases** માં મૂકે છે. વેબસાઇટનું `download.html` પેજ આપમેળે નવી APK ની લિંક, ઇન્સ્ટોલ કરવાની રીત અને QR કોડ બતાવે છે.

### એક વાર કરવાનું
| પગલું | ક્યાં |
|---|---|
| GitHub પર repo બનાવી આ ફાઇલો મૂકો | github.com → New repository |
| Pages ચાલુ કરો | Settings → Pages → Source: **GitHub Actions** |
| Firebase config મૂકો (લાઇવ મોડ) | `www/config.js` માં `window.TJ_FIREBASE_CONFIG = {...}` — એપ અને એડમિન બંને આ જ ફાઇલ વાપરે |
| Keystore બનાવો (APK અપડેટ સીધું ઇન્સ્ટોલ થાય તે માટે જરૂરી) | Actions → "Upload key બનાવો (એક જ વાર)" → 4 secrets ઉમેરો |
| APK બનાવો | Actions → "Android એપ બનાવો" → Run workflow |
| (વૈકલ્પિક) APK હંમેશાં વેબસાઇટનું નવું વર્ઝન ખોલે | Settings → Secrets and variables → Actions → **Variables** → `SITE_URL` = તમારી વેબસાઇટ લિંક |

**લિંક:** એપ `…/` , એડમિન `…/admin/` , ડાઉનલોડ `…/download.html`

> Keystore વગરની debug APK દરેક બિલ્ડમાં જુદી સહીવાળી હોય છે, એટલે નવી APK જૂની ઉપર ઇન્સ્ટોલ નહીં થાય (પહેલાં જૂની કાઢવી પડે). તેથી keystore જરૂરથી બનાવો અને એ secrets ક્યારેય બદલશો નહીં.

### Firebase નિયમો
`firestore.rules` ફાઇલનું લખાણ Firebase Console → Firestore Database → Rules માં પેસ્ટ કરી Publish કરો. (ટ્રાયલ માટે — 31 માર્ચ 2027 સુધી.)
પૂરી સ્ટેપ-બાય-સ્ટેપ રીત: "ThaiJashe_Live_Karvani_Rit.docx".


## નવું (v8): સંપૂર્ણ મફત લાઇવ — Google લૉગિન, Firebase Spark, Cloudflare સર્વર

**ખર્ચ ₹0, કાર્ડ નહીં.** Firebase Blaze ની જરૂર નથી.

| ફાઇલ | શું છે |
|---|---|
| `firestore.rules` | કડક નિયમો: દરેક ફક્ત પોતાનો ડેટા; લૉગ/લોકેશન/આધાર ફક્ત એડમિન; OTP અને રેટિંગ પણ નિયમોથી ચકાસાય (સર્વર વગર) — Firebase Console → Firestore → Rules માં પેસ્ટ |
| `firestore.indexes.json` | indexes (contact, logins, locations ના `ts` — collection group) |
| `cloudflare-worker/worker.js` | મફત સર્વર: `/log` (સાચો IP), `/notify` (Push: નવી વિનંતી 25 કિમીમાં + 60 સેકન્ડ રિંગ, સ્થિતિ, SOS, ફરિયાદ), રોજ રાત્રે 1 વર્ષ જૂના લૉગની સફાઈ. Secret: `FIREBASE_SA` |
| `android-extra/` | Android: `RingtonePlugin` (ફોનની રિંગ 60 સેકન્ડ), `TJMessagingService` (એપ બંધ હોય ત્યારે રિંગ), `MainActivity`, `patch-android.js` |
| `blaze-optional/` | ભવિષ્યમાં Blaze લો ત્યારે માટે Cloud Functions અને Storage નિયમો (હાલ વપરાતા નથી) |

**config.js:** `window.TJ_FIREBASE_CONFIG` (Firebase web config) અને `window.TJ_WORKER_URL` (Cloudflare Worker લિંક).
**GitHub Secrets:** `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`, `GOOGLE_SERVICES_JSON`. (વૈકલ્પિક: `FIREBASE_SERVICE_ACCOUNT` + Variable `FIREBASE_PROJECT_ID` — નિયમો deploy workflow; `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` — Worker deploy workflow.)

**Firebase (Spark) માં:** Firestore (asia-south1) · Authentication → Google + Email/Password · Authorized domains: `USERNAME.github.io` · Android એપ `com.thaijashe.app` + SHA-1 `53:34:2E:74:F2:8E:DB:12:1F:8D:A8:0F:74:DF:99:B0:5C:6D:D1:B1` · `admins/<તમારો UID>`.

**ફોટા:** આધાર/પોલીસ ફોટા આશરે 200 KB કરી `kyc/{uid}` દસ્તાવેજમાં (Storage નહીં); પ્રોફાઇલ ફોટો નાનો કરી કારીગર દસ્તાવેજમાં.

**ડેટા માળખું:** `users/{uid}` (ભૂમિકા, fcm) + `users/{uid}/logins` · `customers/{uid}` · `karigars/{uid}` (જાહેર) + `karigars/{uid}/private/main` (મોબાઇલ, લોકેશન, આધાર છેલ્લા 4, IP) + `karigars/{uid}/locations` (1 વર્ષ) · `kyc/{uid}` · `bookings/{id}` + `contact/main` + `otp/main` · `tickets`, `alerts`, `payments`, `audit`, `settings/main`, `admins/{uid}`.

**લૉગિન:** ગ્રાહક/કારીગર Google ખાતાથી (APK માં `@capacitor-firebase/authentication`). SMS OTP સ્વિચ મૂળથી બંધ (મફત પ્લાનમાં ચાલતું નથી). એપ ID `com.thaijashe.app`.

**એડમિન સ્વિચ (સેટિંગ):** કમીશન, UPI, SMS OTP, કૂપન — ચારેય મૂળથી બંધ. અંતર મર્યાદા મૂળ 25 કિમી.

**ભાષા:** ગુજરાતી / हिन्दी / English. નવું ગુજરાતી લખાણ ઉમેરો ત્યારે `EN` અને `HI` શબ્દકોશમાં પણ ઉમેરો; `node tools/i18n-check.js en` અને `hi` ખૂટતા શબ્દો બતાવે છે (મુખ્ય સ્રોત ફોલ્ડરમાં).
