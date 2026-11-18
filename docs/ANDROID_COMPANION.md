# RemoteView Android Companion App

## Overview

The RemoteView Android Companion App enables secure screen sharing from an Android device to a remote viewer through the RemoteView web platform. It uses Android's official **MediaProjection API** for screen capture and **WebRTC** for real-time streaming.

> **Note**: The web-based invitation page (`/invite/[token]`) handles screen sharing via the browser's `getDisplayMedia()` API for quick sessions. This native Android companion app provides a superior experience with better performance, persistent notifications, and tighter OS integration.

---

## Architecture

```
┌─────────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Android Device    │  WebRTC │  Signaling Server │ WebRTC  │  Web Viewer     │
│                     │◄───────►│  (WebSocket)      │◄───────►│  (Browser)      │
│  MediaProjection    │         │                   │         │  <video> elem   │
│  Screen Capture     │         │  STUN/TURN        │         │                 │
│  WebRTC Peer        │         │  Coordination     │         │  RTCPeerConn    │
└─────────────────────┘         └──────────────────┘         └─────────────────┘
```

---

## Prerequisites

- Android Studio Hedgehog (2023.1) or later
- Android SDK 21+ (Lollipop) — MediaProjection requires API 21+
- Kotlin 1.9+
- Gradle 8.0+

---

## Project Setup

### 1. Create New Android Project

```
File → New → New Project → Empty Activity
- Name: RemoteView Companion
- Package: com.remoteview.companion
- Language: Kotlin
- Minimum SDK: API 21 (Android 5.0)
```

### 2. Dependencies (build.gradle.kts - app level)

```kotlin
dependencies {
    // Core Android
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0")

    // WebRTC
    implementation("io.getstream:stream-webrtc-android:1.1.1")

    // WebSocket (OkHttp)
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // JSON parsing
    implementation("com.google.code.gson:gson:2.10.1")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    // Deep link handling
    implementation("androidx.navigation:navigation-fragment-ktx:2.7.6")
    implementation("androidx.navigation:navigation-ui-ktx:2.7.6")
}
```

### 3. Permissions (AndroidManifest.xml)

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
        android:name=".RemoteViewApp"
        android:allowBackup="false"
        android:icon="@mipmap/ic_launcher"
        android:label="RemoteView"
        android:theme="@style/Theme.RemoteView">

        <!-- Main Activity with deep link support -->
        <activity
            android:name=".ui.MainActivity"
            android:exported="true"
            android:launchMode="singleTask">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <!-- Deep link for invitation URLs -->
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data
                    android:scheme="https"
                    android:host="your-domain.com"
                    android:pathPrefix="/invite/" />
            </intent-filter>
        </activity>

        <!-- Screen Capture Foreground Service -->
        <service
            android:name=".service.ScreenCaptureService"
            android:foregroundServiceType="mediaProjection"
            android:exported="false" />

    </application>
</manifest>
```

---

## Core Implementation

### 4. Screen Capture Service

```kotlin
// service/ScreenCaptureService.kt
package com.remoteview.companion.service

import android.app.*
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.remoteview.companion.R
import com.remoteview.companion.webrtc.WebRTCClient

class ScreenCaptureService : Service() {

    companion object {
        const val CHANNEL_ID = "screen_capture_channel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_STOP = "com.remoteview.companion.STOP_SHARING"

        var isRunning = false
            private set
    }

    private var mediaProjection: MediaProjection? = null
    private var webRTCClient: WebRTCClient? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopScreenSharing()
            return START_NOT_STICKY
        }

        val resultCode = intent?.getIntExtra("resultCode", Activity.RESULT_CANCELED)
            ?: Activity.RESULT_CANCELED
        val resultData = intent?.getParcelableExtra<Intent>("resultData")
        val sessionId = intent?.getStringExtra("sessionId") ?: ""
        val serverUrl = intent?.getStringExtra("serverUrl") ?: ""

        if (resultCode == Activity.RESULT_CANCELED || resultData == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        // Start as foreground service with persistent notification
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        isRunning = true

        // Get MediaProjection
        val projectionManager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        mediaProjection = projectionManager.getMediaProjection(resultCode, resultData)

        // Initialize WebRTC and start streaming
        webRTCClient = WebRTCClient(this, serverUrl, sessionId)
        webRTCClient?.startScreenCapture(mediaProjection!!)

        return START_STICKY
    }

    private fun buildNotification(): Notification {
        val stopIntent = Intent(this, ScreenCaptureService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 0, stopIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("RemoteView - Screen Sharing Active")
            .setContentText("Your screen is being shared. Tap to stop.")
            .setSmallIcon(R.drawable.ic_screen_share)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .addAction(R.drawable.ic_stop, "Stop Sharing", stopPendingIntent)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Screen Sharing",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Shows when your screen is being shared"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun stopScreenSharing() {
        isRunning = false
        webRTCClient?.disconnect()
        webRTCClient = null
        mediaProjection?.stop()
        mediaProjection = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopScreenSharing()
        super.onDestroy()
    }
}
```

### 5. WebRTC Client

```kotlin
// webrtc/WebRTCClient.kt
package com.remoteview.companion.webrtc

import android.content.Context
import android.media.projection.MediaProjection
import android.util.Log
import com.google.gson.Gson
import okhttp3.*
import org.webrtc.*
import java.util.concurrent.TimeUnit

class WebRTCClient(
    private val context: Context,
    private val serverUrl: String,
    private val sessionId: String
) {
    companion object {
        private const val TAG = "WebRTCClient"
    }

    private val gson = Gson()
    private var peerConnectionFactory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var webSocket: WebSocket? = null
    private var videoCapturer: ScreenCapturerAndroid? = null
    private var localVideoSource: VideoSource? = null
    private var localVideoTrack: VideoTrack? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null
    private val eglBase = EglBase.create()

    init {
        initPeerConnectionFactory()
        connectSignaling()
    }

    private fun initPeerConnectionFactory() {
        val options = PeerConnectionFactory.InitializationOptions.builder(context)
            .setEnableInternalTracer(false)
            .createInitializationOptions()
        PeerConnectionFactory.initialize(options)

        val encoderFactory = DefaultVideoEncoderFactory(
            eglBase.eglBaseContext, true, true
        )
        val decoderFactory = DefaultVideoDecoderFactory(eglBase.eglBaseContext)

        peerConnectionFactory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(encoderFactory)
            .setVideoDecoderFactory(decoderFactory)
            .createPeerConnectionFactory()
    }

    fun startScreenCapture(mediaProjection: MediaProjection) {
        // Create video capturer from MediaProjection
        videoCapturer = ScreenCapturerAndroid(mediaProjection, object : MediaProjection.Callback() {
            override fun onStop() {
                Log.d(TAG, "MediaProjection stopped")
                disconnect()
            }
        })

        // Create video source and track
        surfaceTextureHelper = SurfaceTextureHelper.create("CaptureThread", eglBase.eglBaseContext)
        localVideoSource = peerConnectionFactory?.createVideoSource(videoCapturer!!.isScreencast)
        videoCapturer?.initialize(surfaceTextureHelper, context, localVideoSource?.capturerObserver)
        videoCapturer?.startCapture(1280, 720, 30) // 720p at 30fps

        localVideoTrack = peerConnectionFactory?.createVideoTrack("screen_track", localVideoSource)

        // Create peer connection and add track
        createPeerConnection()
        localVideoTrack?.let { track ->
            peerConnection?.addTrack(track, listOf("screen_stream"))
        }
    }

    private fun createPeerConnection() {
        val iceServers = listOf(
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
            PeerConnection.IceServer.builder("stun:stun1.l.google.com:19302").createIceServer()
        )

        val config = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
        }

        peerConnection = peerConnectionFactory?.createPeerConnection(config, object : PeerConnection.Observer {
            override fun onIceCandidate(candidate: IceCandidate) {
                val msg = SignalingMessage(
                    type = "ice-candidate",
                    candidate = candidate.sdp,
                    sdpMid = candidate.sdpMid,
                    sdpMLineIndex = candidate.sdpMLineIndex
                )
                sendSignalingMessage(msg)
            }

            override fun onConnectionChange(newState: PeerConnection.PeerConnectionState) {
                Log.d(TAG, "Connection state: $newState")
                if (newState == PeerConnection.PeerConnectionState.DISCONNECTED ||
                    newState == PeerConnection.PeerConnectionState.FAILED) {
                    // Handle disconnection
                }
            }

            override fun onSignalingChange(state: PeerConnection.SignalingState) {}
            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {}
            override fun onIceConnectionReceivingChange(receiving: Boolean) {}
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) {}
            override fun onAddStream(stream: MediaStream) {}
            override fun onRemoveStream(stream: MediaStream) {}
            override fun onDataChannel(channel: DataChannel) {}
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(receiver: RtpReceiver, streams: Array<MediaStream>) {}
        })
    }

    private fun connectSignaling() {
        val wsUrl = serverUrl.replace("http", "ws") + "?sessionId=$sessionId&role=sharer"
        val client = OkHttpClient.Builder()
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .build()

        val request = Request.Builder().url(wsUrl).build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d(TAG, "Signaling connected")
                val joinMsg = SignalingMessage(type = "join", sessionId = sessionId, role = "sharer")
                sendSignalingMessage(joinMsg)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                handleSignalingMessage(text)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "Signaling error: ${t.message}")
            }
        })
    }

    private fun handleSignalingMessage(text: String) {
        val message = gson.fromJson(text, SignalingMessage::class.java)

        when (message.type) {
            "offer" -> {
                // Viewer sent an offer, set remote description and create answer
                val sdp = SessionDescription(SessionDescription.Type.OFFER, message.sdp)
                peerConnection?.setRemoteDescription(object : SdpObserver {
                    override fun onSetSuccess() {
                        createAnswer()
                    }
                    override fun onSetFailure(error: String?) {
                        Log.e(TAG, "Set remote description failed: $error")
                    }
                    override fun onCreateSuccess(sdp: SessionDescription?) {}
                    override fun onCreateFailure(error: String?) {}
                }, sdp)
            }
            "ice-candidate" -> {
                val candidate = IceCandidate(
                    message.sdpMid ?: "",
                    message.sdpMLineIndex ?: 0,
                    message.candidate ?: ""
                )
                peerConnection?.addIceCandidate(candidate)
            }
            "viewer-ready" -> {
                // Viewer is ready, create offer as sharer
                createOffer()
            }
        }
    }

    private fun createOffer() {
        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "false"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "false"))
        }

        peerConnection?.createOffer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription) {
                peerConnection?.setLocalDescription(object : SdpObserver {
                    override fun onSetSuccess() {
                        val msg = SignalingMessage(type = "offer", sdp = sdp.description)
                        sendSignalingMessage(msg)
                    }
                    override fun onSetFailure(error: String?) {}
                    override fun onCreateSuccess(sdp: SessionDescription?) {}
                    override fun onCreateFailure(error: String?) {}
                }, sdp)
            }
            override fun onCreateFailure(error: String?) {
                Log.e(TAG, "Create offer failed: $error")
            }
            override fun onSetSuccess() {}
            override fun onSetFailure(error: String?) {}
        }, constraints)
    }

    private fun createAnswer() {
        val constraints = MediaConstraints()

        peerConnection?.createAnswer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription) {
                peerConnection?.setLocalDescription(object : SdpObserver {
                    override fun onSetSuccess() {
                        val msg = SignalingMessage(type = "answer", sdp = sdp.description)
                        sendSignalingMessage(msg)
                    }
                    override fun onSetFailure(error: String?) {}
                    override fun onCreateSuccess(sdp: SessionDescription?) {}
                    override fun onCreateFailure(error: String?) {}
                }, sdp)
            }
            override fun onCreateFailure(error: String?) {
                Log.e(TAG, "Create answer failed: $error")
            }
            override fun onSetSuccess() {}
            override fun onSetFailure(error: String?) {}
        }, constraints)
    }

    private fun sendSignalingMessage(message: SignalingMessage) {
        webSocket?.send(gson.toJson(message))
    }

    fun disconnect() {
        videoCapturer?.stopCapture()
        videoCapturer?.dispose()
        localVideoTrack?.dispose()
        localVideoSource?.dispose()
        surfaceTextureHelper?.dispose()
        peerConnection?.close()
        peerConnection?.dispose()
        peerConnectionFactory?.dispose()
        webSocket?.close(1000, "Screen sharing stopped")
        eglBase.release()
    }

    data class SignalingMessage(
        val type: String,
        val sdp: String? = null,
        val candidate: String? = null,
        val sdpMid: String? = null,
        val sdpMLineIndex: Int? = null,
        val sessionId: String? = null,
        val role: String? = null
    )
}
```

### 6. Main Activity (Invitation Handler)

```kotlin
// ui/MainActivity.kt
package com.remoteview.companion.ui

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.remoteview.companion.R
import com.remoteview.companion.service.ScreenCaptureService

class MainActivity : AppCompatActivity() {

    private var pendingSessionId: String? = null
    private var serverUrl: String = "https://your-server.com"

    private val mediaProjectionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            startScreenCaptureService(result.resultCode, result.data!!)
        } else {
            Toast.makeText(this, "Screen capture permission denied", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        handleDeepLink(intent)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        intent?.let { handleDeepLink(it) }
    }

    private fun handleDeepLink(intent: Intent) {
        val data: Uri? = intent.data
        if (data != null && data.pathSegments.size >= 2 && data.pathSegments[0] == "invite") {
            val token = data.pathSegments[1]
            pendingSessionId = token
            showPermissionDialog(token)
        }
    }

    private fun showPermissionDialog(token: String) {
        AlertDialog.Builder(this)
            .setTitle("Screen Sharing Request")
            .setMessage(
                "Someone has invited you to share your screen.\n\n" +
                "What will be shared:\n" +
                "• Everything visible on your screen\n" +
                "• Real-time screen content\n\n" +
                "Your privacy:\n" +
                "• You can stop sharing at any time\n" +
                "• A notification will always be visible\n" +
                "• No data is recorded or stored\n\n" +
                "Do you want to start sharing your screen?"
            )
            .setPositiveButton("Start Sharing") { _, _ ->
                requestScreenCapture()
            }
            .setNegativeButton("Decline") { dialog, _ ->
                dialog.dismiss()
            }
            .setCancelable(true)
            .show()
    }

    private fun requestScreenCapture() {
        val projectionManager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val captureIntent = projectionManager.createScreenCaptureIntent()
        mediaProjectionLauncher.launch(captureIntent)
    }

    private fun startScreenCaptureService(resultCode: Int, data: Intent) {
        val serviceIntent = Intent(this, ScreenCaptureService::class.java).apply {
            putExtra("resultCode", resultCode)
            putExtra("resultData", data)
            putExtra("sessionId", pendingSessionId)
            putExtra("serverUrl", serverUrl)
        }
        startForegroundService(serviceIntent)
        Toast.makeText(this, "Screen sharing started", Toast.LENGTH_SHORT).show()
    }
}
```

---

## Building & Running

### Debug Build
```bash
./gradlew assembleDebug
```

### Install on Device
```bash
./gradlew installDebug
# or
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Release Build
```bash
./gradlew assembleRelease
```

---

## Configuration

### Server URL
Update the server URL in the app before building:

```kotlin
// In MainActivity.kt or a config file
private var serverUrl: String = "https://your-remoteview-server.com"
```

### STUN/TURN Servers
For production, configure your own TURN server for reliable NAT traversal:

```kotlin
// In WebRTCClient.kt
val iceServers = listOf(
    PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
    PeerConnection.IceServer.builder("turn:your-turn-server.com:3478")
        .setUsername("username")
        .setPassword("password")
        .createIceServer()
)
```

We recommend [coturn](https://github.com/coturn/coturn) as an open-source TURN server.

---

## Web-Based Alternative

For quick sessions without installing the companion app, the web platform includes a browser-based sharing page at `/invite/[token]`. This uses the browser's `getDisplayMedia()` API, which works on:

- **Chrome for Android** (version 72+)
- **Firefox for Android** (version 66+)
- **Samsung Internet** (version 13+)

The browser-based approach works well but has limitations compared to the native app:
- Requires keeping the browser tab active
- May be interrupted by Android's battery optimization
- Cannot capture system UI elements (status bar, navigation bar)
- Performance may vary by device

---

## Security Considerations

1. **MediaProjection Permission**: Always requested through Android's official system dialog
2. **Persistent Notification**: Users always know when screen sharing is active
3. **One-tap Stop**: Users can stop sharing instantly from the notification
4. **No Background Start**: Screen capture cannot start without explicit user consent
5. **Session Tokens**: Each sharing session uses a unique, one-time token
6. **Encrypted Transport**: All WebRTC media streams use SRTP encryption by default
7. **Signaling Security**: WebSocket connections should use WSS (TLS) in production

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Black screen in stream | Ensure MediaProjection permission is granted; some devices require a restart |
| Connection fails | Check STUN/TURN server configuration; verify firewall allows UDP traffic |
| High latency | Reduce capture resolution; ensure stable internet connection |
| App crashes on API < 29 | Use `startForeground()` without service type parameter |
| Notification not showing | Ensure notification channel is created and app has POST_NOTIFICATIONS permission (API 33+) |

---

## License

This companion app is part of the RemoteView platform. See the main project LICENSE file for details.
