package com.thaijashe.app;

import android.app.NotificationManager;
import android.content.Context;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /** એપ સામે ખુલ્લી હોય ત્યારે રિંગ એપ પોતે (JS) વગાડે છે, એટલે સૂચનાની રિંગ નહીં */
    public static volatile boolean visible = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RingtonePlugin.class);
        super.onCreate(savedInstanceState);
        TJMessagingService.ensureChannel(this);
    }

    @Override
    public void onResume() {
        super.onResume();
        visible = true;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancelAll();   // એપ ખૂલી — સૂચનાની રિંગ બંધ, વિનંતી એપમાં જ દેખાશે
    }

    @Override
    public void onPause() {
        super.onPause();
        visible = false;
    }
}
