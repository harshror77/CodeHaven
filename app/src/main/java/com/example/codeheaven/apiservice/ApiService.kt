import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    @Multipart
    @POST("api/users/register")
    suspend fun registerUser(
        @PartMap data: Map<String, @JvmSuppressWildcards RequestBody>,
        @Part avatar: MultipartBody.Part?
    ): Response<Any>

    @FormUrlEncoded
    @POST("api/users/login")
    suspend fun loginUser(
        @Field("email") email: String,
        @Field("password") password: String
    ): Response<Any>

}
