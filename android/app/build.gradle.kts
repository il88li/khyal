plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services") // يتطلب app/google-services.json من Firebase
}
android {
    namespace = "com.khiyal.app"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.khiyal.app"
        minSdk = 24; targetSdk = 34; versionCode = 1; versionName = "0.4.0"
        buildConfigField("String", "BASE_URL", "\"https://khiyal-web.vercel.app\"") // غيّره لنطاقك
    }
    buildFeatures { buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    buildTypes { release { isMinifyEnabled = false } }
}
dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.1")
    implementation("androidx.browser:browser:1.8.0")
    implementation(platform("com.google.firebase:firebase-bom:33.1.2"))
    implementation("com.google.firebase:firebase-messaging-ktx")
}
