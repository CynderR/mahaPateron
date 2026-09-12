package ca.fourthstate.shyamakaash.playback;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import ca.fourthstate.shyamakaash.MainActivity;
import ca.fourthstate.shyamakaash.R;

public class PlaybackService extends Service {
    public static final String ACTION_UPDATE = "ca.fourthstate.shyamakaash.playback.UPDATE";
    public static final String ACTION_PLAY = "ca.fourthstate.shyamakaash.playback.PLAY";
    public static final String ACTION_PAUSE = "ca.fourthstate.shyamakaash.playback.PAUSE";
    public static final String ACTION_EXTEND = "ca.fourthstate.shyamakaash.playback.EXTEND";
    public static final String ACTION_STOP = "ca.fourthstate.shyamakaash.playback.STOP";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_PLAYING = "playing";
    public static final String EXTRA_REMAINING = "remaining";
    public static final String EXTRA_SHOW_EXTEND = "showExtend";

    private static final String CHANNEL_ID = "playback";
    private static final int NOTIFICATION_ID = 4201;
    private static final String CUSTOM_EXTEND = "extend";

    private static volatile boolean active;

    private MediaSessionCompat mediaSession;
    private String title = "Shyam Akaash";
    private String artist = "";
    private String remaining = "";
    private boolean playing;
    private boolean showExtend;

    public static boolean isActive() {
        return active;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        ensureChannel();
        mediaSession = new MediaSessionCompat(this, "ShyamAkaashPlayback");
        mediaSession.setCallback(
            new MediaSessionCompat.Callback() {
                @Override
                public void onPlay() {
                    BackgroundPlaybackPlugin.emit("play");
                }

                @Override
                public void onPause() {
                    BackgroundPlaybackPlugin.emit("pause");
                }

                @Override
                public void onStop() {
                    BackgroundPlaybackPlugin.emit("pause");
                }

                @Override
                public void onCustomAction(String action, android.os.Bundle extras) {
                    if (CUSTOM_EXTEND.equals(action)) {
                        BackgroundPlaybackPlugin.emit("extend");
                    }
                }
            }
        );
        mediaSession.setActive(true);
        active = true;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            publish();
            return START_STICKY;
        }

        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (ACTION_PLAY.equals(action)) {
            BackgroundPlaybackPlugin.emit("play");
        } else if (ACTION_PAUSE.equals(action)) {
            BackgroundPlaybackPlugin.emit("pause");
        } else if (ACTION_EXTEND.equals(action)) {
            BackgroundPlaybackPlugin.emit("extend");
        }

        if (intent.hasExtra(EXTRA_TITLE)) {
            title = intent.getStringExtra(EXTRA_TITLE);
        }
        if (intent.hasExtra(EXTRA_ARTIST)) {
            artist = intent.getStringExtra(EXTRA_ARTIST);
        }
        if (intent.hasExtra(EXTRA_REMAINING)) {
            remaining = intent.getStringExtra(EXTRA_REMAINING);
        }
        if (intent.hasExtra(EXTRA_PLAYING)) {
            playing = intent.getBooleanExtra(EXTRA_PLAYING, false);
        }
        if (intent.hasExtra(EXTRA_SHOW_EXTEND)) {
            showExtend = intent.getBooleanExtra(EXTRA_SHOW_EXTEND, false);
        }

        publish();
        return START_STICKY;
    }

    private void publish() {
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        updateMediaSession();
    }

    private void updateMediaSession() {
        MediaMetadataCompat.Builder metadata = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artistLabel())
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "Shyam Akaash");
        mediaSession.setMetadata(metadata.build());

        long actions =
            PlaybackStateCompat.ACTION_PLAY |
            PlaybackStateCompat.ACTION_PAUSE |
            PlaybackStateCompat.ACTION_PLAY_PAUSE |
            PlaybackStateCompat.ACTION_STOP;
        PlaybackStateCompat.Builder state = new PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(
                playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN,
                1f
            );
        if (showExtend) {
            state.addCustomAction(
                new PlaybackStateCompat.CustomAction.Builder(CUSTOM_EXTEND, "+15 min", R.drawable.ic_playback_extend)
                    .build()
            );
        }
        mediaSession.setPlaybackState(state.build());
    }

    private Notification buildNotification() {
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            0,
            new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            pendingFlags()
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_playback_play)
            .setContentTitle(title)
            .setContentText(artistLabel())
            .setContentIntent(contentIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setOngoing(playing)
            .setDeleteIntent(actionIntent(ACTION_PAUSE, 3));

        if (playing) {
            builder.addAction(R.drawable.ic_playback_pause, "Pause", actionIntent(ACTION_PAUSE, 1));
        } else {
            builder.addAction(R.drawable.ic_playback_play, "Play", actionIntent(ACTION_PLAY, 0));
        }
        if (showExtend) {
            builder.addAction(R.drawable.ic_playback_extend, "+15 min", actionIntent(ACTION_EXTEND, 2));
        }

        MediaStyle style = new MediaStyle().setMediaSession(mediaSession.getSessionToken());
        if (showExtend) {
            style.setShowActionsInCompactView(0, 1);
        } else {
            style.setShowActionsInCompactView(0);
        }
        builder.setStyle(style);
        return builder.build();
    }

    private String artistLabel() {
        if (remaining != null && !remaining.isEmpty()) {
            return remaining;
        }
        return artist != null ? artist : "";
    }

    private PendingIntent actionIntent(String action, int requestCode) {
        Intent intent = new Intent(this, PlaybackService.class).setAction(action);
        return PendingIntent.getService(this, requestCode, intent, pendingFlags());
    }

    private int pendingFlags() {
        return Build.VERSION.SDK_INT >= 23
            ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            : PendingIntent.FLAG_UPDATE_CURRENT;
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Playback", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Podcast playback controls");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    @Override
    public void onDestroy() {
        active = false;
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
