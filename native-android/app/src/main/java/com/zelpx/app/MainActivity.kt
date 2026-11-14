package com.zelpx.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val ZelpOrange = Color(0xFFF36B38)
private val ZelpPaper = Color(0xFFFFFBF6)
private val ZelpInk = Color(0xFF20211E)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { ZelpApp() }
    }
}

@Composable
private fun ZelpApp() {
    var role by remember { mutableStateOf("Customer") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = ZelpOrange,
            onPrimary = Color.White,
            background = ZelpPaper,
            surface = Color.White,
            onSurface = ZelpInk
        )
    ) {
        Surface(Modifier.fillMaxSize(), color = ZelpPaper) {
            Column(
                Modifier.fillMaxSize().padding(horizontal = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text("ZELPX", fontSize = 34.sp, fontWeight = FontWeight.Black, color = ZelpInk, letterSpacing = 5.sp)
                Text("Your home projects, connected.", color = Color(0xFF77736D), modifier = Modifier.padding(top = 8.dp, bottom = 28.dp))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        Text("Welcome back", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = ZelpInk)
                        Text("Choose your account", color = Color(0xFF77736D))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf("Customer", "Contractor").forEach { item ->
                                FilterChip(
                                    selected = role == item,
                                    onClick = { role = item },
                                    label = { Text(item) }
                                )
                            }
                        }
                        OutlinedTextField(
                            value = email, onValueChange = { email = it },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Email address") },
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = password, onValueChange = { password = it },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Password") },
                            visualTransformation = PasswordVisualTransformation(),
                            singleLine = true
                        )
                        Button(
                            onClick = { /* Supabase authentication is connected in the next implementation step. */ },
                            modifier = Modifier.fillMaxWidth().height(52.dp),
                            shape = RoundedCornerShape(14.dp)
                        ) { Text("Sign in as $role", fontWeight = FontWeight.Bold) }
                        Text(
                            "Native Android app • Secure account access",
                            color = Color(0xFF88837B),
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }
    }
}
