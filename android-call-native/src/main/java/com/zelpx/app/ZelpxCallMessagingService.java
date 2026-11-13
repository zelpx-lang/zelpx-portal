package com.zelpx.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
 * Receives high-priority call invitations.
 * The backend must send a data message with type=zelpx_call and call_id.
 */
public final class ZelpxCallMessagingService extends FirebaseMessagingService {
    private static final String CHANNEL_ID = "zelpx_incoming_calls";
    private static final int NOTIFICATION_ID = 7301;

    @Override
    public void onMessageReceived(RemoteMessage message) {
        if (message == null || !"zelpx_call".equals(message.getData().get("type"))) return;
        String callId = message.getData().get("call_id");
        if (callId == null || callId.trim().isEmpty()) return;

        String caller = message.getData().get("caller_name");
        if (caller == null || caller.trim().isEmpty()) caller = "ZELPX user";

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Incoming ZELPX calls", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Voice call invitations");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            manager.createNotificationChannel(channel);
        }

        Intent open = new Intent(this, IncomingCallActivity.class);
        open.putExtra("call_id", callId);
        open.putExtra("caller_name", caller);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent fullScreen = PendingIntent.getActivity(this, callId.hashCode(), open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(com.zelpx.app.R.drawable.ic_notification_icon)
            .setContentTitle("Incoming ZELPX voice call")
            .setContentText(caller + " is calling")
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(fullScreen, true)
            .setContentIntent(fullScreen)
            .setAutoCancel(true)
            .build();
        manager.notify(NOTIFICATION_ID, notification);
    }
}
