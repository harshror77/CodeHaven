package com.example.codeheaven.registration

import ApiService
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.example.codeheaven.MainActivity
import com.example.codeheaven.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream


class SignupActivity : AppCompatActivity() {

    private lateinit var emailEditText: EditText
    private lateinit var usernameEditText: EditText
    private lateinit var passwordEditText: EditText
    private lateinit var pickImageBtn: Button
    private lateinit var signupBtn: Button
    private lateinit var avatarPreview: ImageView
    private lateinit var errorText: TextView
    private lateinit var progressBar: ProgressBar

    private var avatarUri: Uri? = null
    private lateinit var galleryLauncher: ActivityResultLauncher<Intent>
    private lateinit var sharedPreferences: android.content.SharedPreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_signup)

        emailEditText = findViewById(R.id.emailEditText)
        usernameEditText = findViewById(R.id.usernameEditText)
        passwordEditText = findViewById(R.id.passwordEditText)
        pickImageBtn = findViewById(R.id.pickImageBtn)
        signupBtn = findViewById(R.id.signupBtn)
        avatarPreview = findViewById(R.id.avatarPreview)
        errorText = findViewById(R.id.errorText)
        progressBar = findViewById(R.id.progressBar)
        val loginLink: TextView = findViewById(R.id.loginLink)
        loginLink.setOnClickListener {
            startActivity(Intent(this@SignupActivity, LoginActivity::class.java))
        }


        sharedPreferences = getSharedPreferences("auth_prefs", Context.MODE_PRIVATE)

        // Initialize gallery launcher
        galleryLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == Activity.RESULT_OK && result.data != null) {
                avatarUri = result.data?.data
                if (avatarUri != null) {
                    avatarPreview.visibility = View.VISIBLE
                    avatarPreview.setImageURI(avatarUri)
                }
            }
        }

        pickImageBtn.setOnClickListener {
            val intent = Intent(Intent.ACTION_GET_CONTENT)
            intent.type = "image/*"
            galleryLauncher.launch(intent)
        }

        signupBtn.setOnClickListener {
            signUp()
        }
    }

    private fun signUp() {
        val email = emailEditText.text.toString().trim()
        val username = usernameEditText.text.toString().trim()
        val password = passwordEditText.text.toString().trim()

        if (email.isEmpty() || username.isEmpty() || password.isEmpty()) {
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
            .baseUrl("http://10.0.2.2:3000/") // Emulator localhost
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        val service = retrofit.create(ApiService::class.java)

        val dataMap = mutableMapOf<String, RequestBody>().apply {
            put("email", email.toRequestBody("text/plain".toMediaTypeOrNull()))
            put("username", username.toRequestBody("text/plain".toMediaTypeOrNull()))
            put("password", password.toRequestBody("text/plain".toMediaTypeOrNull()))
        }

        val avatarPart = avatarUri?.let {
            val file = FileUtil.from(this, it)
            val requestFile = file.asRequestBody("image/*".toMediaTypeOrNull())
            MultipartBody.Part.createFormData("avatar", file.name, requestFile)
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = service.registerUser(dataMap, avatarPart)
                withContext(Dispatchers.Main) {
                    progressBar.visibility = View.GONE
                    if (response.isSuccessful) {
                        Toast.makeText(this@SignupActivity, "Signup successful!", Toast.LENGTH_SHORT).show()
                        startActivity(Intent(this@SignupActivity, LoginActivity::class.java))
                        finish()
                    } else {
                        errorText.text = "Signup failed: ${response.code()}"
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


// 🔥 FileUtil object inside same file
object FileUtil {
    fun from(context: Context, uri: Uri): File {
        val inputStream: InputStream? = context.contentResolver.openInputStream(uri)
        val file = File(context.cacheDir, "avatar_${System.currentTimeMillis()}.jpg")
        val outputStream = FileOutputStream(file)
        inputStream?.copyTo(outputStream)
        inputStream?.close()
        outputStream.close()
        return file
    }
}
