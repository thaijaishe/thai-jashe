package com.thaijashe.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.Vibrator;
import android.os.VibratorManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * થઈ જશે! — નવી વિનંતી વખતે એપની પોતાની રિંગ (res/raw/tj_ring) 80% અવાજે, વાઇબ્રેશન વગર.
 * ફોનનો અવાજ ઓછો હોય તો પણ રિંગ સંભળાય: રિંગ વખતે "એલાર્મ" અવાજ 80% કરે, રિંગ બંધ થાય એટલે પહેલાં જેટલો હતો તેટલો પાછો.
 * JS: Capacitor.Plugins.Ringtone.start({seconds:60}) / stop()
 */
@CapacitorPlugin(name = "Ringtone")
public class RingtonePlugin extends Plugin {
    public static final int VOLUME_PCT = 80;
    private static MediaPlayer mp;
    private static final Handler handler = new Handler(Looper.getMainLooper());
    private static Runnable stopper;

    @PluginMethod
    public void start(PluginCall call) {
        int sec = call.getInt("seconds", 60);
        RingService.stop(getContext());   // એપ ખૂલી ગઈ — બહારની (service) રિંગ બંધ, એપ પોતે વગાડશે
        startRing(getContext(), Math.max(3, Math.min(sec, 120)));
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopRing(getContext());
        call.resolve();
    }

    /** res/raw/tj_ring નો સરનામો (notification channel અને MediaPlayer બંને માટે) */
    public static Uri ringUri(Context ctx) {
        int id = ctx.getResources().getIdentifier("tj_ring", "raw", ctx.getPackageName());
        return Uri.parse("android.resource://" + ctx.getPackageName() + "/" + id);
    }

    public static AudioAttributes ringAttrs() {
        return new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
    }

    /** એલાર્મ અવાજ 80% — જૂનો અવાજ યાદ રાખે (એપ બંધ થઈ જાય તો પણ, SharedPreferences માં) */
    public static synchronized void boost(Context ctx) {
        try {
            Context app = ctx.getApplicationContext();
            AudioManager am = (AudioManager) app.getSystemService(Context.AUDIO_SERVICE);
            if (am == null) return;
            SharedPreferences sp = app.getSharedPreferences("tj_ring", Context.MODE_PRIVATE);
            if (!sp.contains("vol")) sp.edit().putInt("vol", am.getStreamVolume(AudioManager.STREAM_ALARM)).apply();
            int max = am.getStreamMaxVolume(AudioManager.STREAM_ALARM);
            am.setStreamVolume(AudioManager.STREAM_ALARM, Math.max(1, Math.round(max * VOLUME_PCT / 100f)), 0);
        } catch (Exception ignored) {}   // "ખલેલ પાડશો નહીં (DND)" ચાલુ હોય તો ફોન મંજૂરી ન આપે — તો જેમ છે તેમ
    }

    /** અવાજ પાછો પહેલાં જેટલો */
    public static synchronized void restore(Context ctx) {
        try {
            Context app = ctx.getApplicationContext();
            SharedPreferences sp = app.getSharedPreferences("tj_ring", Context.MODE_PRIVATE);
            if (!sp.contains("vol")) return;
            AudioManager am = (AudioManager) app.getSystemService(Context.AUDIO_SERVICE);
            if (am != null) am.setStreamVolume(AudioManager.STREAM_ALARM, sp.getInt("vol", 0), 0);
            sp.edit().remove("vol").apply();
        } catch (Exception ignored) {}
    }

    public static boolean playing() { return mp != null; }

    public static synchronized void startRing(Context ctx, int seconds) {
        halt(ctx);
        final Context app = ctx.getApplicationContext();
        boost(app);
        try {
            mp = new MediaPlayer();
            mp.setAudioAttributes(ringAttrs());
            mp.setDataSource(app, ringUri(app));
            mp.setLooping(true);
            mp.setVolume(1f, 1f);
            mp.prepare();
            mp.start();
        } catch (Exception e) {
            if (mp != null) { try { mp.release(); } catch (Exception ignored) {} }
            mp = null;
        }
        stopper = new Runnable() { public void run() { stopRing(app); } };
        handler.postDelayed(stopper, seconds * 1000L);
    }

    /** ફક્ત અવાજ બંધ + અવાજ પાછો (service અને સૂચનાને અડે નહીં) */
    public static synchronized void halt(Context ctx) {
        if (mp != null) { try { mp.stop(); } catch (Exception ignored) {} try { mp.release(); } catch (Exception ignored) {} mp = null; }
        if (stopper != null) handler.removeCallbacks(stopper);
        stopper = null;
        restore(ctx);
    }

    /** બધું બંધ: રિંગ, service, સૂચના */
    public static synchronized void stopRing(Context ctx) {
        halt(ctx);
        RingService.stop(ctx);
        // જૂની APK નું વાઇબ્રેશન ચાલુ રહી ગયું હોય તો તે પણ બંધ + રિંગ વાળી સૂચના હટાવો
        try {
            if (Build.VERSION.SDK_INT >= 31) {
                VibratorManager vm = (VibratorManager) ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) vm.cancel();
            } else {
                Vibrator v = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null) v.cancel();
            }
        } catch (Exception ignored) {}
        try {
            android.app.NotificationManager nm = (android.app.NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancelAll();
        } catch (Exception ignored) {}
    }
}
