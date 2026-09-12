package ca.fourthstate.shyamakaash;

import android.os.Bundle;
import android.webkit.WebView;
import ca.fourthstate.shyamakaash.playback.BackgroundPlaybackPlugin;
import ca.fourthstate.shyamakaash.playback.PlaybackService;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackgroundPlaybackPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onPause() {
        super.onPause();
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null && PlaybackService.isActive()) {
            webView.resumeTimers();
            webView.onResume();
        }
    }
}
