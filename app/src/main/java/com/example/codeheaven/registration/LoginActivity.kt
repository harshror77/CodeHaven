package com.example.codeheaven.registration

import ApiService
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.example.codeheaven.MainActivity
import com.example.codeheaven.R
import kotlinx.coroutines.*
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class LoginActivity : AppCompatActivity() {

    private lateinit var emailEditText: EditText
    private lateinit var passwordEditText: EditText
    private lateinit var loginBtn: Button
    private lateinit var errorText: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var registerLink: TextView

    private lateinit var sharedPreferences: android.content.SharedPreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        emailEditText = findViewById(R.id.emailEditText)
        passwordEditText = findViewById(R.id.passwordEditText)
        loginBtn = findViewById(R.id.loginBtn)
        errorText = findViewById(R.id.errorText)
        progressBar = findViewById(R.id.progressBar)
        registerLink = findViewById(R.id.registerLink)

        sharedPreferences = getSharedPreferences("auth_prefs", Context.MODE_PRIVATE)

        // 💡 Check if already logged in
        if (sharedPreferences.getBoolean("is_logged_in", false)) {
            startActivity(Intent(this@LoginActivity, MainActivity::class.java))
            finish()
            return
        }

        loginBtn.setOnClickListener {
            login()
        }

        registerLink.setOnClickListener {
            startActivity(Intent(this@LoginActivity, SignupActivity::class.java))
        }
    }

    private fun login() {
        val email = emailEditText.text.toString().trim()
        val password = passwordEditText.text.toString().trim()

        if (email.isEmpty() || password.isEmpty()) {
            errorText.text = "All fields are required"
            errorText.visibility = View.VISIBLE
            return
        }

        errorText.visibility = View.GONE
        progressBar.visibility = View.VISIBLE

        val cookiePrefs = sharedPreferences

        val client = OkHttpClient.Builder()
            .addInterceptor { chain ->
                val request = chain.request()
                val response = chain.proceed(request)
                val cookies = response.headers("Set-Cookie")
                if (cookies.isNotEmpty()) {
                    cookiePrefs.edit().putString("session_cookie", cookies[0]).apply()
                }
                response
            }
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl("http://10.0.2.2:3000/") // Change to your backend
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        val service = retrofit.create(ApiService::class.java)

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = service.loginUser(email, password)
                withContext(Dispatchers.Main) {
                    progressBar.visibility = View.GONE
                    if (response.isSuccessful) {
                        // ✅ Save login state
                        sharedPreferences.edit().apply {
                            putBoolean("is_logged_in", true)
                            putString("email", email)
                            apply()
                        }

                        Toast.makeText(this@LoginActivity, "Login successful!", Toast.LENGTH_SHORT).show()
                        startActivity(Intent(this@LoginActivity, MainActivity::class.java))
                        finish()
                    } else {
                        errorText.text = "Login failed: ${response.code()}"
                        errorText.visibility = View.VISIBLE
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    progressBar.visibility = View.GONE
                    errorText.text = "Error: ${e.localizedMessage}"
                    errorText.visibility = View.VISIBLE
                }
            }
        }
    }
}
