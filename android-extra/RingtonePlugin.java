package com.thaijashe.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** થઈ જશે! — નવી વિનંતી વખતે ફોનનો પોતાનો રિંગટોન (Settings માં જે હોય તે) 60 સેકન્ડ વગાડે. JS: Capacitor.Plugins.Ringtone.start({seconds:60}) / stop() */
@CapacitorPlugin(name = "Ringtone")
public class RingtonePlugin extends Plugin {
    private static Ringtone ring;
    private static final Handler handler = new Handler(Looper.getMainLooper());
    private static Runnable stopper, looper;

    @PluginMethod
    public void start(PluginCall call) {
        int sec = call.getInt("seconds", 60);
        startRing(getContext(), Math.max(3, Math.min(sec, 120)));
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopRing(getContext());
        call.resolve();
    }

    public static synchronized void startRing(Context ctx, int seconds) {
        stopRing(ctx);
        Context app = ctx.getApplicationContext();
        Uri uri = RingtoneManager.getActualDefaultRingtoneUri(app, RingtoneManager.TYPE_RINGTONE);
        if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        ring = RingtoneManager.getRingtone(app, uri);
        if (ring != null) {
            ring.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            if (Build.VERSION.SDK_INT >= 28) ring.setLooping(true);
            ring.play();
            if (Build.VERSION.SDK_INT < 28) {
                looper = new Runnable() {
                    public void run() {
                        if (ring != null && !ring.isPlaying()) ring.play();
                        handler.postDelayed(this, 1000);
                    }
                };
                handler.postDelayed(looper, 1000);
            }
        }
        vibrate(app);
        stopper = new Runnable() { public void run() { stopRing(app); } };
        handler.postDelayed(stopper, seconds * 1000L);
    }

    public static synchronized void stopRing(Context ctx) {
        if (ring != null) { try { ring.stop(); } catch (Exception ignored) {} ring = null; }
        if (looper != null) handler.removeCallbacks(looper);
        if (stopper != null) handler.removeCallbacks(stopper);
        looper = null; stopper = null;
        // વાઇબ્રેશન પૂરેપૂરું બંધ: બધા vibrator + રિંગ વાળી સૂચના પણ હટાવો
        try {
            if (Build.VERSION.SDK_INT >= 31) {
                VibratorManager vm = (VibratorManager) ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) vm.cancel();
            }
        } catch (Exception ignored) {}
        Vibrator v = vib(ctx);
        if (v != null) { try { v.cancel(); } catch (Exception ignored) {} }
        try {
            android.app.NotificationManager nm = (android.app.NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancelAll();
        } catch (Exception ignored) {}
    }

    private static Vibrator vib(Context ctx) {
        if (Build.VERSION.SDK_INT >= 31) {
            VibratorManager vm = (VibratorManager) ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return vm != null ? vm.getDefaultVibrator() : null;
        }
        return (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
    }

    private static void vibrate(Context ctx) {
        Vibrator v = vib(ctx);
        if (v == null || !v.hasVibrator()) return;
        long[] p = {0, 800, 600};
        if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(p, 1));
        else v.vibrate(p, 1);
    }
}
