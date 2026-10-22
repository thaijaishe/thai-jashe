// થઈ જશે! — `npx cap add android` પછી: Java ફાઇલો, AndroidManifest (પરમિશન, સૂચના સર્વિસ) અને build.gradle માં ફેરફાર
const fs = require('fs'), path = require('path');
const A = 'android/app', JAVA = path.join(A, 'src/main/java/com/thaijashe/app');
fs.mkdirSync(JAVA, {recursive:true});
for(const f of ['RingtonePlugin.java', 'TJMessagingService.java', 'MainActivity.java', 'RingService.java']) fs.copyFileSync(path.join(__dirname, f), path.join(JAVA, f));
// થઈ જશે! ની પોતાની રિંગ → res/raw/tj_ring.ogg
const RAW = path.join(A, 'src/main/res/raw'); fs.mkdirSync(RAW, {recursive:true}); fs.copyFileSync(path.join(__dirname, 'tj_ring.ogg'), path.join(RAW, 'tj_ring.ogg'));
// AndroidManifest
const MP = path.join(A, 'src/main/AndroidManifest.xml'); let m = fs.readFileSync(MP, 'utf8');
if(!/xmlns:tools=/.test(m)) m = m.replace('<manifest ', '<manifest xmlns:tools="http://schemas.android.com/tools" ');
const perms = ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'POST_NOTIFICATIONS', 'VIBRATE', 'WAKE_LOCK', 'USE_FULL_SCREEN_INTENT', 'MODIFY_AUDIO_SETTINGS', 'FOREGROUND_SERVICE', 'CAMERA'];
const add = perms.filter(p => !m.includes('android.permission.' + p)).map(p => `    <uses-permission android:name="android.permission.${p}" />`).join('\n');
if(add) m = m.replace('</manifest>', add + '\n    <uses-feature android:name="android.hardware.location.gps" android:required="false" />\n</manifest>');
if(!m.includes('TJMessagingService')) m = m.replace('</application>', `
        <!-- Capacitor નું મૂળ સૂચના સર્વિસ હટાવી, રિંગ વાળું ઉમેર્યું -->
        <service android:name="com.capacitorjs.plugins.pushnotifications.MessagingService" tools:node="remove" />
        <service android:name=".TJMessagingService" android:exported="false">
            <intent-filter><action android:name="com.google.firebase.MESSAGING_EVENT" /></intent-filter>
        </service>
        <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="tj_alert" />
    </application>`);
// રિંગ service (એપ બંધ હોય ત્યારે રિંગ વગાડે)
if(!m.includes('.RingService')) m = m.replace('</application>', `    <service android:name=".RingService" android:exported="false" android:foregroundServiceType="shortService" />
    </application>`);
// રેફરલ લિંક: thaijashe://ref/CODE — વેબ પેજનું "એપમાં ખોલો" બટન એપ ખોલે અને કોડ ફોર્મમાં આપમેળે ભરાય
if(!m.includes('android:scheme="thaijashe"')) m = m.replace(/(<activity[^>]*MainActivity[\s\S]*?)(\s*<\/activity>)/, (a, b, c) => b + `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="thaijashe" android:host="ref" />
            </intent-filter>` + c);
// જૂના બિલ્ડમાંથી mediaPlayback રહી ગયું હોય તો shortService કરો (Play Store નિયમ)
m = m.replace(/(\.RingService"[^>]*foregroundServiceType=")mediaPlayback/, '$1shortService').replace(/\s*<uses-permission android:name="android\.permission\.FOREGROUND_SERVICE_MEDIA_PLAYBACK" \/>/g, '');
fs.writeFileSync(MP, m);
// રિંગ ફાઇલ build વખતે ન કપાય (shrinkResources)
fs.writeFileSync(path.join(RAW, 'keep.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources xmlns:tools="http://schemas.android.com/tools" tools:keep="@raw/tj_ring" />\n');
// build.gradle: firebase-messaging (TJMessagingService માટે)
const GP = path.join(A, 'build.gradle'); let g = fs.readFileSync(GP, 'utf8');
if(!g.includes('firebase-messaging')) g = g.replace(/dependencies\s*\{/, m0 => m0 + '\n    implementation "com.google.firebase:firebase-messaging:25.0.1"');
fs.writeFileSync(GP, g);
// Google લૉગિન (Capacitor Firebase Authentication) માટે Google Play Services ઉમેરો
const VP = 'android/variables.gradle'; let v = fs.readFileSync(VP, 'utf8');
if(!v.includes('rgcfaIncludeGoogle')) v = v.replace(/ext\s*\{/, m0 => m0 + '\n    rgcfaIncludeGoogle = true'); fs.writeFileSync(VP, v);
console.log('Android patched:', fs.readdirSync(JAVA).join(', '));
console.log(m.split('\n').filter(l => /permission|service|meta-data/.test(l)).join('\n'));
