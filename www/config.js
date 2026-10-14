/* થઈ જશે! — લાઇવ મોડ સેટિંગ (એપ અને એડમિન બંને આ જ ફાઇલ વાપરે છે)
   1) Firebase Console → Project settings → Your apps → Web app → firebaseConfig કૉપિ કરો
   2) નીચે null ની જગ્યાએ પેસ્ટ કરો, દા.ત.
      window.TJ_FIREBASE_CONFIG = { apiKey: "....", authDomain: "....firebaseapp.com", projectId: "....", storageBucket: "....", messagingSenderId: "....", appId: "...." };
   3) GitHub પર સેવ (Commit) કરો — વેબસાઇટ અને નવી APK આપમેળે અપડેટ થશે.
   null રહે ત્યાં સુધી એપ "ડેમો મોડ" માં ચાલે (ડેટા ફક્ત એ જ ફોનમાં). */
window.TJ_FIREBASE_CONFIG = null;

/* APK ડાઉનલોડ લિંક — ખાલી રાખો તો GitHub Releases ની "latest" APK આપમેળે વપરાશે.
   પોતાનું ડોમેન હોય કે APK બીજે મૂકો તો અહીં પૂરી લિંક લખો. */
window.TJ_APK_URL = '';

/* મફત સર્વર (Cloudflare Worker) ની લિંક — Push સૂચના, રિંગ, SOS સૂચના અને સાચો IP માટે.
   દા.ત. window.TJ_WORKER_URL = 'https://thaijashe.તમારું-નામ.workers.dev';  ખાલી રહે તો એપ ચાલે, પણ એપ બંધ હોય ત્યારે સૂચના નહીં આવે. */
window.TJ_WORKER_URL = '';
