package com.p12.sampler;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import java.io.FileInputStream;
import java.util.ArrayDeque;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER = 1001;
    private static final int AUDIO_PERMISSION = 1002, SAVE_DOCUMENT = 1003;
    private PermissionRequest microphoneRequest;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final ArrayDeque<ByteAccumulator> saveQueue = new ArrayDeque<>();
    private boolean choosingSave;
    private final AndroidBridge bridge = new AndroidBridge();
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private final Map<String, ByteAccumulator> pending = new HashMap<>();

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setRequestedOrientation(getPreferences(MODE_PRIVATE).getInt("orientation", ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR));
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        web.setLayoutParams(new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.setHorizontalScrollBarEnabled(true);
        web.setVerticalScrollBarEnabled(true);
        web.setOverScrollMode(WebView.OVER_SCROLL_ALWAYS);
        setContentView(web);
        web.post(this::enableImmersiveMode);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setSupportZoom(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(false);
        s.setTextZoom(100);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) s.setSafeBrowsingEnabled(true);

        web.addJavascriptInterface(bridge, "P12Android");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !"file:///android_asset/P-12.html".equals(request.getUrl().toString());
            }
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                enableImmersiveMode();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent i;
                try { i = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE); i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE); }
                catch (Exception e) { i = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE); }
                try { startActivityForResult(i, FILE_CHOOSER); return true; }
                catch (Exception e) { fileCallback = null; Toast.makeText(MainActivity.this, "No file picker available", Toast.LENGTH_SHORT).show(); return false; }
            }

            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean wantsMic = false;
                    for (String r : request.getResources()) if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) wantsMic = true;
                    if (!wantsMic || !"file".equals(request.getOrigin().getScheme())) { request.deny(); return; }
                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                        if (microphoneRequest != null) microphoneRequest.deny();
                        microphoneRequest = request;
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, AUDIO_PERMISSION);
                    } else request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                });
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) {
                if (microphoneRequest == request) microphoneRequest = null;
            }
        });
        web.loadUrl("file:///android_asset/P-12.html");
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == AUDIO_PERMISSION && microphoneRequest != null) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED)
                microphoneRequest.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            else microphoneRequest.deny();
            microphoneRequest = null;
        }
    }

    private void enableImmersiveMode() {
        if (Build.VERSION.SDK_INT >= 30) {
            // getDecorView initializes the decor; Window.getInsetsController can
            // dereference an absent decor before setContentView on some Android builds.
            WindowInsetsController controller = getWindow().getDecorView().getWindowInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.systemBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
            return;
        }
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    @Override protected void onResume() {
        super.onResume();
        enableImmersiveMode();
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enableImmersiveMode();
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == SAVE_DOCUMENT) {
            choosingSave=false; ByteAccumulator a=saveQueue.poll();
            if (a != null) {
                if (resultCode==RESULT_OK && data!=null && data.getData()!=null) {
                    Uri uri=data.getData(); io.execute(() -> {
                        try { copyToUri(a.file,uri); bridge.toast("Saved "+a.name); }
                        catch(Exception e) { bridge.toast("Save failed: "+e.getMessage()); }
                        finally { a.file.delete(); }
                    });
                } else { a.file.delete(); bridge.toast("Save cancelled"); }
            }
            chooseSave();
        }

        if (requestCode == FILE_CHOOSER && fileCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n=data.getClipData().getItemCount(); result=new Uri[n]; for(int i=0;i<n;i++) result[i]=data.getClipData().getItemAt(i).getUri();
                } else if (data.getData()!=null) result=new Uri[]{data.getData()};
            }
            fileCallback.onReceiveValue(result); fileCallback=null;
        }
    }

    @Override public void onBackPressed() {
        web.evaluateJavascript("Boolean(window.p12AndroidBack && window.p12AndroidBack())", handled -> {
            if (!"true".equals(handled)) new AlertDialog.Builder(this).setTitle("Close P-12?")
                .setMessage("Save your project before closing to keep your changes.")
                .setNegativeButton("Keep working", null).setPositiveButton("Close", (d, w) -> finish()).show();
        });
    }

    public class AndroidBridge {
        @JavascriptInterface public void toast(String msg) { runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show()); }
        @JavascriptInterface public void rotate() {
            runOnUiThread(() -> {
                boolean landscape = getResources().getConfiguration().orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE;
                int value = landscape ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT : ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;
                getPreferences(MODE_PRIVATE).edit().putInt("orientation", value).apply(); setRequestedOrientation(value);
            });
        }
        @JavascriptInterface public synchronized boolean beginSave(String id, String name, String mime) {
            if (pending.size() >= 4 || pending.containsKey(id)) return false;
            try { pending.put(id, new ByteAccumulator(name, mime)); return true; } catch (Exception e) { return false; }
        }
        @JavascriptInterface public synchronized boolean appendSave(String id, String chunk) {
            ByteAccumulator a = pending.get(id); if (a == null) return false;
            try {
                if (chunk.length() > 350000) throw new Exception("Chunk too large");
                byte[] bytes = Base64.decode(chunk, Base64.DEFAULT); a.size += bytes.length;
                if (a.size > 512L * 1024 * 1024) throw new Exception("Export too large");
                a.stream.write(bytes); return true;
            } catch (Exception e) { cancelSave(id); return false; }
        }
        @JavascriptInterface public synchronized void cancelSave(String id) {
            ByteAccumulator a = pending.remove(id); if (a == null) return;
            try { a.stream.close(); } catch (Exception ignored) {} a.file.delete();
        }
        @JavascriptInterface public synchronized boolean finishSave(String id) {
            ByteAccumulator a = pending.remove(id); if (a == null) return false;
            try { a.stream.close(); } catch (Exception e) { a.file.delete(); return false; }
            if (Build.VERSION.SDK_INT >= 29) io.execute(() -> saveToDownloads(a));
            else runOnUiThread(() -> { saveQueue.add(a); chooseSave(); });
            return true;
        }
        synchronized void dispose() { for (String id : pending.keySet().toArray(new String[0])) cancelSave(id); }
    }
    private void copyToUri(File file, Uri uri) throws Exception {
        try (FileInputStream in = new FileInputStream(file); OutputStream out = getContentResolver().openOutputStream(uri, "w")) {
            if (out == null) throw new Exception("Cannot open destination");
            byte[] buffer = new byte[65536]; int n; while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
        }
    }
    @android.annotation.TargetApi(29)
    private void saveToDownloads(ByteAccumulator a) {
        Uri uri = null;
        try {
            ContentValues v = new ContentValues(); v.put(MediaStore.Downloads.DISPLAY_NAME,a.name);
            v.put(MediaStore.Downloads.MIME_TYPE,a.mime); v.put(MediaStore.Downloads.RELATIVE_PATH,Environment.DIRECTORY_DOWNLOADS+"/P-12");
            v.put(MediaStore.Downloads.IS_PENDING,1);
            uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,v);
            if (uri == null) throw new Exception("Cannot create download");
            copyToUri(a.file, uri); v.clear(); v.put(MediaStore.Downloads.IS_PENDING,0); getContentResolver().update(uri,v,null,null);
            bridge.toast("Saved to Downloads/P-12/"+a.name);
        } catch (Exception e) {
            if (uri != null) { try { getContentResolver().delete(uri,null,null); } catch (Exception ignored) {} }
            bridge.toast("Save failed: "+e.getMessage());
        } finally { a.file.delete(); }
    }
    private void chooseSave() {
        if (choosingSave || saveQueue.isEmpty() || isFinishing()) return;
        ByteAccumulator a = saveQueue.peek();
        try {
            choosingSave = true;
            startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                .setType(a.mime).putExtra(Intent.EXTRA_TITLE,a.name), SAVE_DOCUMENT);
        } catch (Exception e) { choosingSave=false;saveQueue.remove().file.delete();bridge.toast("No document saver available");chooseSave(); }
    }
    private class ByteAccumulator {
        final String name,mime; final File file; final OutputStream stream; long size;
        ByteAccumulator(String n,String m) throws Exception {
            String clean = n == null ? "" : n.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
            name = clean.isEmpty() || clean.equals(".") || clean.equals("..") ? "P12-export.bin" : clean;
            mime = m == null || m.isEmpty() ? "application/octet-stream" : m;
            file = File.createTempFile("p12-export-", ".tmp", getCacheDir()); stream = new FileOutputStream(file);
        }
    }
    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        if (microphoneRequest != null) microphoneRequest.deny();
        if (web != null) { web.removeJavascriptInterface("P12Android"); web.destroy(); }
        bridge.dispose(); for (ByteAccumulator a : saveQueue) a.file.delete(); saveQueue.clear(); io.shutdown(); super.onDestroy();
    }
}
