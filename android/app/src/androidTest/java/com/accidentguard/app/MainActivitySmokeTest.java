package com.accidentguard.app;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * End-to-end smoke test for the Android shell and bundled web application.
 *
 * This test uses local app assets only; it does not request location or contact
 * any real person or emergency service.
 */
@RunWith(AndroidJUnit4.class)
public class MainActivitySmokeTest {
    private static final long WEBVIEW_TIMEOUT_MS = 15_000L;
    private static final long APP_READY_TIMEOUT_MS = 20_000L;
    private static final long POLL_INTERVAL_MS = 250L;

    @Test
    public void mainActivityLoadsBundledWebApplication() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            WebView webView = awaitWebView(scenario, WEBVIEW_TIMEOUT_MS);
            assertNotNull(
                "MainActivity did not attach a WebView within " + WEBVIEW_TIMEOUT_MS + " ms",
                webView
            );

            assertTrue(
                "The bundled web application did not render #root within "
                    + APP_READY_TIMEOUT_MS
                    + " ms. Check Capacitor asset sync, relative Vite asset paths, and WebView console errors.",
                awaitApplicationReady(scenario, APP_READY_TIMEOUT_MS)
            );
        }
    }

    private static WebView awaitWebView(
        ActivityScenario<MainActivity> scenario,
        long timeoutMs
    ) {
        long deadline = SystemClock.elapsedRealtime() + timeoutMs;
        AtomicReference<WebView> webViewRef = new AtomicReference<>();

        while (SystemClock.elapsedRealtime() < deadline) {
            scenario.onActivity(activity -> {
                View content = activity.findViewById(android.R.id.content);
                webViewRef.set(findWebView(content));
            });

            WebView webView = webViewRef.get();
            if (webView != null) {
                return webView;
            }

            SystemClock.sleep(POLL_INTERVAL_MS);
        }

        return null;
    }

    private static boolean awaitApplicationReady(
        ActivityScenario<MainActivity> scenario,
        long timeoutMs
    ) throws InterruptedException {
        long deadline = SystemClock.elapsedRealtime() + timeoutMs;

        while (SystemClock.elapsedRealtime() < deadline) {
            CountDownLatch evaluated = new CountDownLatch(1);
            AtomicReference<String> result = new AtomicReference<>("");

            scenario.onActivity(activity -> {
                WebView webView = findWebView(activity.findViewById(android.R.id.content));
                if (webView == null) {
                    result.set("missing-webview");
                    evaluated.countDown();
                    return;
                }

                webView.evaluateJavascript(
                    "(function() {"
                        + " var root = document.getElementById('root');"
                        + " return document.readyState === 'complete'"
                        + " && !!root && root.children.length > 0;"
                        + " })()",
                    value -> {
                        result.set(value == null ? "" : value);
                        evaluated.countDown();
                    }
                );
            });

            if (evaluated.await(2, TimeUnit.SECONDS) && "true".equals(result.get())) {
                return true;
            }

            SystemClock.sleep(POLL_INTERVAL_MS);
        }

        return false;
    }

    private static WebView findWebView(View view) {
        if (view == null) {
            return null;
        }
        if (view instanceof WebView) {
            return (WebView) view;
        }
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                WebView found = findWebView(group.getChildAt(i));
                if (found != null) {
                    return found;
                }
            }
        }
        return null;
    }
}
