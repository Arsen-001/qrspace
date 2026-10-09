package co.qrspace.app

import android.app.Application
import android.content.Context
import co.qrspace.app.data.Api
import co.qrspace.app.data.HistoryDb
import co.qrspace.app.data.Session
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.crossfade

class QrApp : Application(), SingletonImageLoader.Factory {
    val api by lazy { Api(this) }
    val history by lazy { HistoryDb.create(this) }
    val session by lazy { Session(api) }

    /** Images go through the API client so the session cookie opens private memory photos. */
    override fun newImageLoader(context: PlatformContext): ImageLoader =
        ImageLoader.Builder(context)
            .components { add(OkHttpNetworkFetcherFactory(callFactory = { api.client })) }
            .crossfade(true)
            .build()
}

val Context.app: QrApp get() = applicationContext as QrApp
