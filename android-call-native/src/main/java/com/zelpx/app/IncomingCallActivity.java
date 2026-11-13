package com.zelpx.app;

import android.app.Activity;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.content.Intent;
import android.net.Uri;

/**
 * Native incoming-call surface. Accept/reject signaling is intentionally delegated
 * to the authenticated web call flow until the call backend and Firebase are configured.
 */
public final class IncomingCallActivity extends Activity {
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        String caller = getIntent().getStringExtra("caller_name");
        if (caller == null) caller = "ZELPX user";
        String callId = getIntent().getStringExtra("call_id");

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(32, 48, 32, 48);
        root.setBackgroundColor(0xFF171717);

        TextView brand = new TextView(this);
        brand.setText("ZELPX");
        brand.setTextColor(0xFFFF8A24);
        brand.setTextSize(28);
        brand.setGravity(Gravity.CENTER);
        root.addView(brand, new LinearLayout.LayoutParams(-1, -2));

        TextView status = new TextView(this);
        status.setText("Incoming voice call\n" + caller);
        status.setTextColor(0xFFFFFFFF);
        status.setTextSize(22);
        status.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams statusParams = new LinearLayout.LayoutParams(-1, -2);
        statusParams.topMargin = 56;
        statusParams.bottomMargin = 64;
        root.addView(status, statusParams);

        Button accept = new Button(this);
        accept.setText("Open ZELPX to answer");
        accept.setOnClickListener(v -> openCall(callId));
        root.addView(accept, new LinearLayout.LayoutParams(-1, -2));

        Button reject = new Button(this);
        reject.setText("Dismiss");
        reject.setOnClickListener(v -> finish());
        LinearLayout.LayoutParams rejectParams = new LinearLayout.LayoutParams(-1, -2);
        rejectParams.topMargin = 16;
        root.addView(reject, rejectParams);

        setContentView(root);
    }

    private void openCall(String callId) {
        String path = "/portal";
        Intent intent = new Intent(Intent.ACTION_VIEW,
            Uri.parse("https://app.zelpx.com" + path + (callId == null ? "" : "?call_id=" + Uri.encode(callId))));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
        finish();
    }
}
