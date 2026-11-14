package com.zelpx.app.calls

import android.app.Activity
import android.os.Bundle

class TokenRegistrationActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val accessToken = intent?.data?.getQueryParameter("access_token").orEmpty()
        if (accessToken.isNotBlank() && accessToken.length < 8192) TokenRegistration.saveSessionAndRegister(this, accessToken)
        finish()
    }
}