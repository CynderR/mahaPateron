package ca.fourthstate.shyamakaash.playback;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "BackgroundPlayback",
    permissions = {
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class BackgroundPlaybackPlugin extends Plugin {
    private static BackgroundPlaybackPlugin instance;
    private boolean askedNotifications;

    public static void emit(String event) {
        BackgroundPlaybackPlugin plugin = instance;
        if (plugin == null) return;
        plugin.notifyListeners(event, new JSObject());
    }

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) {
            instance = null;
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void update(PluginCall call) {
        startOrUpdate(call);
        if (
            Build.VERSION.SDK_INT >= 33 &&
            !askedNotifications &&
            getPermissionState("notifications") != PermissionState.GRANTED
        ) {
            askedNotifications = true;
            requestPermissionForAlias("notifications", call, "onNotificationPermission");
            return;
        }
        call.resolve();
    }

    @PermissionCallback
    private void onNotificationPermission(PluginCall call) {
        startOrUpdate(call);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), PlaybackService.class);
        intent.setAction(PlaybackService.ACTION_STOP);
        getContext().stopService(intent);
        call.resolve();
    }

    private void startOrUpdate(PluginCall call) {
        Intent intent = new Intent(getContext(), PlaybackService.class);
        intent.setAction(PlaybackService.ACTION_UPDATE);
        intent.putExtra(PlaybackService.EXTRA_TITLE, call.getString("title", "Episode"));
        intent.putExtra(PlaybackService.EXTRA_ARTIST, call.getString("artist", ""));
        intent.putExtra(PlaybackService.EXTRA_REMAINING, call.getString("remainingLabel", ""));
        intent.putExtra(PlaybackService.EXTRA_PLAYING, Boolean.TRUE.equals(call.getBoolean("playing", false)));
        intent.putExtra(PlaybackService.EXTRA_SHOW_EXTEND, Boolean.TRUE.equals(call.getBoolean("showExtend", false)));
        try {
            ContextCompat.startForegroundService(getContext(), intent);
        } catch (Exception error) {
            // Android 12+ can block a new FGS start once the activity is backgrounded.
            // The existing service still receives later UPDATE intents if it is already running.
        }
    }
}
