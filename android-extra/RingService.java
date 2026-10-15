package com.thaijashe.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

/**
 * થઈ જશે! — એપ બંધ હોય ત્યારે નવી વિનંતીની રિંગ.
 * સૂચનાના અવાજ પર આધાર નહીં (ઘણા ફોન — Vivo/Oppo/Xiaomi — એપની સૂચનાનો અવાજ બંધ કરી દે છે),
 * એટલે આ નાની "foreground service" પોતે 60 સેકન્ડ રિંગ વગાડે (કૉલિંગ એપ જેવું), એલાર્મ અવાજ પર 80%.
 * બંધ: સૂચના પરનું "બંધ કરો" બટન, એપ ખોલો, કામ સ્વીકારો કે 60 સેકન્ડ.
 */
public class RingService extends Service {
    public static final String ACTION_STOP = "com.thaijashe.app.RING_STOP";
    public static final int NOTE_ID = 4711;
    static volatile boolean running = false;

    public static void start(Context ctx, String title, String body, String bookingId) {
        Intent i = new Intent(ctx, RingService.class);
        i.putExtra("title", title); i.putExtra("body", body); i.putExtra("bookingId", bookingId);
        if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i); else ctx.startService(i);
    }

    public static void stop(Context ctx) {
        if (!running) return;
        try { ctx.stopService(new Intent(ctx, RingService.class)); } catch (Exception ignored) {}
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) { RingtonePlugin.stopRing(this); stopSelf(); return START_NOT_STICKY; }
        running = true;
        String title = intent != null && intent.getStringExtra("title") != null ? intent.getStringExtra("title") : "નવું કામ — થઈ જશે!";
        String body = intent != null && intent.getStringExtra("body") != null ? intent.getStringExtra("body") : "નજીકમાં નવી વિનંતી";
        String bid = intent != null ? intent.getStringExtra("bookingId") : null;

        TJMessagingService.ensureChannel(this);
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        open.putExtra("bookingId", bid);
        PendingIntent pi = PendingIntent.getActivity(this, 7, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent st = new Intent(this, RingService.class); st.setAction(ACTION_STOP);
        PendingIntent ps = PendingIntent.getService(this, 8, st, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification n = new NotificationCompat.Builder(this, TJMessagingService.RING_CH)
                .setSmallIcon(getApplicationInfo().icon)
                .setContentTitle(title).setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setOngoing(true).setAutoCancel(true)
                .setContentIntent(pi).setFullScreenIntent(pi, true)
                .addAction(0, "📲 ખોલો", pi)
                .addAction(0, "🔕 રિંગ બંધ", ps)
                .setSilent(true)                      // અવાજ સૂચના નહીં — રિંગ આ service પોતે વગાડે છે
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .build();
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTE_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            else startForeground(NOTE_ID, n);
        } catch (Exception e) {
            // foreground ન થઈ શક્યું — સૂચના બતાવો અને છતાં રિંગ વગાડો
            try { ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).notify(NOTE_ID, n); } catch (Exception ignored) {}
        }
        RingtonePlugin.startRing(this, 60);   // એપની રિંગ, 80% અવાજ, 60 સેકન્ડ પછી આપમેળે બંધ (stopRing → આ service પણ બંધ)
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        RingtonePlugin.halt(this);
        try { stopForeground(true); } catch (Exception ignored) {}
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
