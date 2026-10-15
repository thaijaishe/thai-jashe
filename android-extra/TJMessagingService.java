package com.thaijashe.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * થઈ જશે! — એપ બંધ / પાછળ હોય ત્યારે નવી વિનંતી આવે તો ફોનની રિંગ 60 સેકન્ડ (FLAG_INSISTENT + 60 સેકન્ડ પછી આપમેળે બંધ).
 * સર્વર data-only સંદેશ મોકલે છે: type=request, bookingId, title, body.
 * બાકીના સંદેશ Capacitor PushNotifications plugin ને આગળ મોકલાય છે.
 */
public class TJMessagingService extends MessagingService {
    public static final String RING_CH = "tj_ring_v2";   // v2: વાઇબ્રેશન વગર (Android માં જૂની ચેનલનું વાઇબ્રેશન બદલાતું નથી, એટલે નવી ચેનલ)

    @Override
    public void onMessageReceived(@NonNull RemoteMessage msg) {
        Map<String, String> d = msg.getData();
        if ("request".equals(d.get("type")) && !MainActivity.visible) showRing(this, d);
        super.onMessageReceived(msg);
    }

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;
        try { nm.deleteNotificationChannel("tj_ring_v1"); } catch (Exception ignored) {}
        if (nm.getNotificationChannel(RING_CH) != null) return;
        NotificationChannel ch = new NotificationChannel(RING_CH, "નવી વિનંતી (રિંગ)", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("નવા કામની વિનંતી — ફોનની રિંગ 1 મિનિટ (વાઇબ્રેશન વગર)");
        Uri u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        ch.setSound(u, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        ch.enableVibration(false);
        ch.setVibrationPattern(null);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    static void showRing(Context ctx, Map<String, String> d) {
        ensureChannel(ctx);
        Intent i = new Intent(ctx, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        i.putExtra("bookingId", d.get("bookingId"));
        PendingIntent pi = PendingIntent.getActivity(ctx, 7, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String title = d.containsKey("title") ? d.get("title") : "નવું કામ — થઈ જશે!";
        String body = d.containsKey("body") ? d.get("body") : "નજીકમાં નવી વિનંતી";
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, RING_CH)
                .setSmallIcon(ctx.getApplicationInfo().icon)
                .setContentTitle(title).setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setAutoCancel(true).setContentIntent(pi).setFullScreenIntent(pi, true)
                .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE))
                .setVibrate(null)
                .setDefaults(0)
                .setTimeoutAfter(60000)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        Notification n = b.build();
        n.flags |= Notification.FLAG_INSISTENT;   // સૂચના ખોલો/હટાવો ત્યાં સુધી (મહત્તમ 60 સેકન્ડ) રિંગ ચાલુ
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        String id = d.get("bookingId");
        try { nm.notify(id != null ? id.hashCode() : 1001, n); } catch (SecurityException ignored) {}
    }
}
