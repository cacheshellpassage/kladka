package app.kladka.guide;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // local plugin: build files opened with the app ("Open with" / "Share")
        registerPlugin(IncomingFilePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
