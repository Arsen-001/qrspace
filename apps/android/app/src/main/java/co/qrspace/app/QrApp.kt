package co.qrspace.app

import android.app.Application
import android.content.Context
import co.qrspace.app.data.Api
import co.qrspace.app.data.HistoryDb
import co.qrspace.app.data.Push
import co.qrspace.app.data.Session
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.crossfade
import coil3.svg.SvgDecoder

class QrApp : Application(), SingletonImageLoader.Factory {
    val api by lazy { Api(this) }
    val history by lazy { HistoryDb.create(this) }
    val session by lazy { Session(api, Push(this)) }

    /**
     * Images go through the API client so the session cookie opens private memory photos and closed codes' drawings.
     * Coil's disk cache keeps code drawings for offline use; SVG — when a server can't make PNG.
     */
    override fun newImageLoader(context: PlatformContext): ImageLoader =
        ImageLoader.Builder(context)
            .components {
                add(OkHttpNetworkFetcherFactory(callFactory = { api.client }))
                add(SvgDecoder.Factory())
            }
            .crossfade(true)
            .build()
}

val Context.app: QrApp get() = applicationContext as QrApp
