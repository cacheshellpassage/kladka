package app.kladka.guide;

import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

/**
 * Receives build files opened with the app ("Open with" / "Share" from Telegram, Files, Downloads)
 * and hands them to the web layer, which imports them locally. Nothing leaves the device.
 */
@CapacitorPlugin(name = "IncomingFile")
public class IncomingFilePlugin extends Plugin {
    private static final long MAX_BYTES = 64L * 1024 * 1024;
    private JSObject pending;

    @Override
    public void load() {
        // file that launched the app: kept until the web layer asks for it
        pending = readIntent(getActivity().getIntent());
        if (pending != null) getActivity().setIntent(new Intent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        JSObject file = readIntent(intent);
        if (file != null) notifyListeners("incomingFile", file);
    }

    @PluginMethod
    public void getPending(PluginCall call) {
        JSObject result = new JSObject();
        if (pending != null) {
            result.put("file", pending);
            pending = null;
        }
        call.resolve(result);
    }

    private JSObject readIntent(Intent intent) {
        if (intent == null) return null;
        Uri uri = null;
        String action = intent.getAction();
        if (Intent.ACTION_VIEW.equals(action)) {
            uri = intent.getData();
        } else if (Intent.ACTION_SEND.equals(action)) {
            Object extra = intent.getExtras() != null ? intent.getExtras().get(Intent.EXTRA_STREAM) : null;
            if (extra instanceof Uri) uri = (Uri) extra;
        }
        if (uri == null) return null;
        JSObject file = new JSObject();
        file.put("name", displayName(uri));
        try {
            file.put("data", Base64.encodeToString(readAll(uri), Base64.NO_WRAP));
        } catch (Exception e) {
            file.put("error", e.getMessage() != null ? e.getMessage() : "read-failed");
        }
        return file;
    }

    private String displayName(Uri uri) {
        String name = null;
        try (Cursor c = getContext().getContentResolver().query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) name = c.getString(0);
        } catch (Exception ignored) {
            // some providers do not support queries
        }
        if (name == null) name = uri.getLastPathSegment();
        return name != null ? name : "file";
    }

    private byte[] readAll(Uri uri) throws IOException {
        ContentResolver cr = getContext().getContentResolver();
        try (InputStream in = cr.openInputStream(uri); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (in == null) throw new IOException("cannot-open");
            byte[] buf = new byte[64 * 1024];
            long total = 0;
            int n;
            while ((n = in.read(buf)) > 0) {
                total += n;
                if (total > MAX_BYTES) throw new IOException("too-big");
                out.write(buf, 0, n);
            }
            return out.toByteArray();
        }
    }
}
