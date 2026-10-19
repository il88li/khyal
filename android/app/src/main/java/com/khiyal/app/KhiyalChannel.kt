package com.khiyal.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build

/** قناة إشعارات خيال (Android 8+) — تُنشأ عند بدء التطبيق وعند وصول الرسائل */
object KhiyalChannel {
    const val ID = "khiyal"
    fun ensure(ctx: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(ID) != null) return
        nm.createNotificationChannel(NotificationChannel(ID, "خيال", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "الإعجابات والمتابعات والتعليقات"
            enableVibration(true)
        })
    }
}
