package com.sqdfirecontrol.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;
import android.widget.FrameLayout;
import android.widget.Toast;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final String HOST = "app.sqdfirecontrol.local";
    private static final String ENTRY = "https://" + HOST + "/index.html";
    private static final int PICK_FILE = 100, SAVE_PLAN = 101;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingPlan;

    @Override public void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xff111618);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        web = new WebView(this);
        web.setBackgroundColor(0xff111618);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        root.requestApplyInsets();
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportZoom(false);
        settings.setSafeBrowsingEnabled(true);
        web.addJavascriptInterface(new Bridge(), "AndroidApp");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!HOST.equals(uri.getHost()) || !"https".equals(uri.getScheme())) return null;
                String relative = uri.getPath();
                if (relative == null || relative.contains("..") || relative.contains("\\")) return missing();
                if (relative.equals("/")) relative = "/index.html";
                try { return new WebResourceResponse(mime(relative), "UTF-8", getAssets().open("web" + relative)); }
                catch (IOException error) { return missing(); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (ENTRY.equals(uri.toString())) return false;
                if (HOST.equals(uri.getHost()) && uri.getPath().startsWith("/licenses/")) {
                    showLicense(uri.getPath());
                    return true;
                }
                if ("https".equals(uri.getScheme()) && !HOST.equals(uri.getHost())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception error) { message("无法打开外部链接"); }
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                String[] types = params.getAcceptTypes();
                intent.setType(types.length > 0 && types[0].startsWith("image/") ? "image/*" : "*/*");
                try { startActivityForResult(intent, PICK_FILE); }
                catch (Exception error) { fileCallback.onReceiveValue(null); fileCallback = null; message("未找到系统文件选择器"); }
                return true;
            }
            @Override public boolean onJsAlert(WebView view, String url, String text, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(text).setPositiveButton("确定", (d, w) -> result.confirm()).setOnCancelListener(d -> result.cancel()).show();
                return true;
            }
        });
        web.loadUrl(ENTRY);
    }

    private static WebResourceResponse missing() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }
    private static String mime(String name) {
        name = name.toLowerCase(Locale.ROOT);
        if (name.endsWith(".html")) return "text/html";
        if (name.endsWith(".js")) return "application/javascript";
        if (name.endsWith(".css")) return "text/css";
        if (name.endsWith(".webp")) return "image/webp";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".json")) return "application/json";
        return "text/plain";
    }
    private void message(String text) { Toast.makeText(this, text, Toast.LENGTH_LONG).show(); }
    private void showLicense(String path) {
        if (path.contains("..") || path.contains("\\")) return;
        try (InputStream stream = getAssets().open("web" + path)) {
            ByteArrayOutputStream data = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096]; int read;
            while ((read = stream.read(buffer)) != -1) data.write(buffer, 0, read);
            new AlertDialog.Builder(this).setTitle("开源许可").setMessage(data.toString("UTF-8")).setPositiveButton("关闭", null).show();
        } catch (IOException error) { message("无法读取许可文件"); }
    }
    public class Bridge {
        @JavascriptInterface public void savePlan(String content) {
            if (content == null || content.length() > 1024 * 1024) return;
            runOnUiThread(() -> {
                if (!ENTRY.equals(web.getUrl()) || pendingPlan != null) return;
                pendingPlan = content;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE, "sqd-fire-plan.json");
                try { startActivityForResult(intent, SAVE_PLAN); }
                catch (Exception error) { pendingPlan = null; message("未找到系统文件保存器"); }
            });
        }
        @JavascriptInterface public void copyText(String text) {
            if (text == null || text.length() > 100000) return;
            runOnUiThread(() -> {
                if (!ENTRY.equals(web.getUrl())) return;
                ClipboardManager clipboard = (ClipboardManager)getSystemService(CLIPBOARD_SERVICE);
                clipboard.setPrimaryClip(ClipData.newPlainText("SQD 射击方案", text));
                message("已复制射击口令");
            });
        }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(result == RESULT_OK && data != null && data.getData() != null ? new Uri[] {data.getData()} : null);
            fileCallback = null;
        }
        if (request == SAVE_PLAN) {
            String content = pendingPlan; pendingPlan = null;
            if (result == RESULT_OK && data != null && data.getData() != null && content != null) {
                try (OutputStream stream = getContentResolver().openOutputStream(data.getData(), "wt")) {
                    if (stream == null) throw new IOException("No output stream");
                    stream.write(content.getBytes(StandardCharsets.UTF_8)); message("计划已保存");
                } catch (IOException error) { message("保存失败，请重试"); }
            }
        }
    }
    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        if (web != null) { web.removeJavascriptInterface("AndroidApp"); web.destroy(); }
        super.onDestroy();
    }
}
