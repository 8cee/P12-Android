package com.p12.sampler;

import android.Manifest;
import android.app.Activity;
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
    private static final int AUDIO_PERMISSION = 1002;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private final Map<String, ByteAccumulator> pending = new HashMap<>();

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR);
        web = new WebView(this);
        web.setLayoutParams(new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.setHorizontalScrollBarEnabled(true);
        web.setVerticalScrollBarEnabled(true);
        web.setOverScrollMode(WebView.OVER_SCROLL_ALWAYS);
        setContentView(web);

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

        web.addJavascriptInterface(new AndroidBridge(), "P12Android");
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                installDownloadBridge();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent i;
                try { i = params.createIntent(); }
                catch (Exception e) { i = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE); }
                try { startActivityForResult(i, FILE_CHOOSER); return true; }
                catch (Exception e) { fileCallback = null; Toast.makeText(MainActivity.this, "No file picker available", Toast.LENGTH_SHORT).show(); return false; }
            }

            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean wantsMic = false;
                    for (String r : request.getResources()) if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) wantsMic = true;
                    if (wantsMic && Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, AUDIO_PERMISSION);
                    }
                    request.grant(request.getResources());
                });
            }
        });
        web.loadUrl("file:///android_asset/P-12.html");
    }

    private void installDownloadBridge() {
        String js = "javascript:(function(){if(window.__p12AndroidDownloadBridge)return;window.__p12AndroidDownloadBridge=true;"+
            "try{let v=document.querySelector('meta[name=viewport]');if(!v){v=document.createElement('meta');v.name='viewport';document.head.appendChild(v);}v.content='width=device-width,initial-scale=1,minimum-scale=0.25,maximum-scale=5,user-scalable=yes';let st=document.getElementById('p12-android-scrollfix');if(!st){st=document.createElement('style');st.id='p12-android-scrollfix';st.textContent='html,body{overflow:auto!important;overflow-x:auto!important;overflow-y:auto!important;touch-action:pan-x pan-y pinch-zoom!important;-webkit-overflow-scrolling:touch!important;}body{min-width:max-content!important;}.sequencer-panel{overflow:visible!important;}.tracks-scroll{overflow-x:auto!important;overflow-y:auto!important;max-width:none!important;}.tracks{width:max-content!important;min-width:100%!important;}.track,.step-ruler{width:max-content!important;min-width:max-content!important;}.step{width:var(--seq-step-min,32px)!important;min-width:var(--seq-step-min,32px)!important;}';document.head.appendChild(st);}const fixSeq=function(){const tracks=document.getElementById('tracks');if(!tracks)return;tracks.style.setProperty('width','max-content','important');tracks.style.setProperty('min-width','100%','important');const sc=tracks.parentElement;if(sc){sc.style.setProperty('overflow-x','auto','important');sc.style.setProperty('overflow-y','auto','important');}tracks.querySelectorAll('.track,.step-ruler').forEach(function(row){const g=row.style.gridTemplateColumns;if(g)row.style.setProperty('grid-template-columns',g,'important');row.style.setProperty('width','max-content','important');row.style.setProperty('min-width','max-content','important');});};fixSeq();const tracks=document.getElementById('tracks');if(tracks&&!tracks.__p12SeqObserver){tracks.__p12SeqObserver=true;new MutationObserver(function(){requestAnimationFrame(fixSeq);}).observe(tracks,{childList:true,subtree:false});}window.addEventListener('resize',function(){setTimeout(fixSeq,50);},{passive:true});window.addEventListener('orientationchange',function(){setTimeout(fixSeq,150);},{passive:true});}catch(_e){}"+
            "document.querySelectorAll('input[type=file]').forEach(function(i){let ac=i.getAttribute('accept')||'';if(ac.includes('.p12proj')||ac.includes('application/json')){if(!ac.includes('.p12'))ac='.p12,'+ac;i.setAttribute('accept',ac);}});document.addEventListener('click',async function(e){let a=e.target;while(a&&a.tagName!=='A')a=a.parentElement;if(!a||!a.download||!a.href||!a.href.startsWith('blob:'))return;"+
            "e.preventDefault();e.stopPropagation();try{const b=await fetch(a.href).then(r=>r.blob());const ab=await b.arrayBuffer();const u=new Uint8Array(ab);let bin='';const chunk=0x8000;for(let i=0;i<u.length;i+=chunk){bin+=String.fromCharCode.apply(null,u.subarray(i,Math.min(i+chunk,u.length)));}"+
            "const b64=btoa(bin),id=Date.now()+'-'+Math.random();let outName=a.download||'P12-export.bin';if(/\\.p12proj\\.json$/i.test(outName)||/\\.p12proj$/i.test(outName)||/^p12-project-/i.test(outName))outName='Project.p12';P12Android.beginSave(id,outName,b.type||'application/octet-stream');const step=350000;for(let i=0;i<b64.length;i+=step)P12Android.appendSave(id,b64.slice(i,i+step));P12Android.finishSave(id);}"+
            "catch(err){console.error('Android save bridge failed',err);P12Android.toast('Save failed: '+err);}},true);})();";
        web.evaluateJavascript(js, null);
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
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
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    public class AndroidBridge {
        @JavascriptInterface public void toast(String msg) { runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show()); }
        @JavascriptInterface public synchronized void beginSave(String id, String name, String mime) { pending.put(id, new ByteAccumulator(name, mime)); }
        @JavascriptInterface public synchronized void appendSave(String id, String base64Chunk) { ByteAccumulator a=pending.get(id); if(a!=null) a.append(base64Chunk); }
        @JavascriptInterface public synchronized void finishSave(String id) {
            ByteAccumulator a=pending.remove(id); if(a==null) return;
            try { byte[] bytes=Base64.decode(a.data.toString(), Base64.DEFAULT); saveToDownloads(a.name,a.mime,bytes); }
            catch(Exception ex){ toast("Save failed: "+ex.getMessage()); }
        }
    }

    private void saveToDownloads(String rawName, String mime, byte[] data) throws Exception {
        String name = rawName.replaceAll("[\\/:*?\"<>|]", "_");
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues v=new ContentValues(); v.put(MediaStore.Downloads.DISPLAY_NAME,name); v.put(MediaStore.Downloads.MIME_TYPE,mime); v.put(MediaStore.Downloads.RELATIVE_PATH,Environment.DIRECTORY_DOWNLOADS+"/P-12");
            Uri uri=getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,v); if(uri==null) throw new Exception("Cannot create download");
            try(OutputStream os=getContentResolver().openOutputStream(uri)){ if(os==null) throw new Exception("Cannot open download"); os.write(data); }
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "Saved to Downloads/P-12/"+name, Toast.LENGTH_LONG).show());
        } else {
            File dir=new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),"P-12"); if(!dir.exists() && !dir.mkdirs()) throw new Exception("Cannot create export folder");
            File f=new File(dir,name); try(FileOutputStream os=new FileOutputStream(f)){os.write(data);} runOnUiThread(() -> Toast.makeText(MainActivity.this, "Saved: "+f.getAbsolutePath(), Toast.LENGTH_LONG).show());
        }
    }

    private static class ByteAccumulator {
        final String name,mime; final StringBuilder data=new StringBuilder();
        ByteAccumulator(String n,String m){name=n;mime=m;}
        void append(String s){data.append(s);}
    }
}
