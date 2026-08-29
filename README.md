# Agora Video Call Prototype

A standalone proof of concept for real-time video and audio communication between an Android user and a remote helper. It was developed separately from WalkBuddy to test Agora-based calling before integrating the approach into the main accessibility project.

## Features

- Real-time two-way audio and video
- Agora RTC channel creation and joining
- Secure server-side token generation
- Android camera and microphone permission handling
- Join, mute, camera and leave-call controls
- Browser-based helper interface
- Automatically generated public development URLs using Cloudflare Quick Tunnels

## Technology Stack

- **React Native** — Android mobile application
- **Expo Development Build** — supports native modules unavailable in Expo Go
- **Expo Router** — application navigation
- **React Native Agora (`react-native-agora`)** — real-time audio and video communication
- **Node.js and Express.js** — session and token backend
- **Agora Token Builder (`agora-token`)** — generates RTC access tokens from the App ID and App Certificate
- **HTML and JavaScript** — browser-based helper interface
- **Cloudflare Quick Tunnels** — provides temporary HTTPS URLs for development testing
- **CORS** — allows communication between the clients and backend
- **dotenv** — loads private backend credentials

## Important Requirement

This project does not run in Expo Go because `react-native-agora` contains native Android code. Install and use an Expo Development Build.

The current prototype supports Android only.

## Repository Structure

```text
agora-webview-test/
├── AWVT/                       # Expo React Native Android application
├── WalkBuddyHelper/            # Browser-based helper interface
│   └── index.html
├── WalkBuddySessionServer/     # Express session and Agora token server
│   ├── server.js
│   └── package.json
└── README.md
```

## Prerequisites

- Node.js and npm
- Git
- An Agora account and project
- Cloudflare Tunnel (`cloudflared`)
- An Android phone with USB debugging enabled, or an Android emulator

## 1. Clone the Repository

```bash
git clone https://github.com/JohanJoe2121/agora-webview-test.git
cd agora-webview-test
```

## 2. Install Dependencies

Install the Android application's dependencies:

```bash
cd AWVT
npm install
```

Return to the repository root and install the session server's dependencies:

```bash
cd ..
cd WalkBuddySessionServer
npm install
```

The helper is a static HTML page and does not require its own dependency installation. The development script uses `npx serve` to host it.

## 3. Create an Agora Project

1. Sign in to the [Agora Console](https://console.agora.io/).
2. Open **Project Management** and select **Create a Project**.
3. Enter a project name, such as `Agora Video Call Prototype`.
4. Select the secured authentication option that uses an **App ID and App Certificate**.
5. Open the project and copy its **App ID**.
6. Enable the primary **App Certificate** if necessary.
7. Copy the App Certificate and keep it private.

Agora may take a few minutes to enable a new certificate.

### How authentication works

The prototype uses the Agora **App ID and App Certificate**. The mobile application requests access to a call from `WalkBuddySessionServer`. The server uses those Agora credentials to generate the RTC access token required to join the requested channel and returns the session information to the client.

This token generation happens automatically through the backend. Users do not manually create or copy temporary tokens from the Agora Console. Keeping token generation on the server prevents the App Certificate from being exposed in the Android application or GitHub repository.

## 4. Configure the Session Server

Create this file:

```text
WalkBuddySessionServer/.env
```

Add your Agora credentials:

```env
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate
PORT=3001
```

Do not add spaces around the values.

## 5. Create the Android Development Build

From the `AWVT` directory, connect an Android phone with USB debugging enabled or start an emulator. Then run:

```bash
npx expo prebuild
npx expo run:android
```

The initial Gradle build may take several minutes. A new native build is generally required after adding or changing native dependencies.

If the Android development build is already installed and the native dependencies have not changed, you do not need to rebuild it for ordinary TypeScript or JavaScript changes.

## 6. Start the Complete Development Environment

From the `AWVT` directory, run:

```bash
npm run dev
```

The development script:

1. Starts `WalkBuddySessionServer/server.js` on port `3001`.
2. Serves `WalkBuddyHelper/index.html` on port `3002`.
3. Creates a Cloudflare Quick Tunnel for the backend.
4. Creates another Cloudflare Quick Tunnel for the helper page.
5. Writes the generated URLs to `AWVT/.env.local`.
6. Starts Expo with the development client and clears the Metro cache.

Wait until the terminal displays both Cloudflare URLs and confirms that Expo has started. Then open the installed development build on the Android device.

Do not run the project through Expo Go.

### Run individual services for troubleshooting

From the repository root:

```bash
node WalkBuddySessionServer/server.js
npx serve WalkBuddyHelper -l 3002
```

Start Expo separately from `AWVT` with:

```bash
npx expo start --dev-client --clear
```

When Expo is started separately, the required public URLs must already exist in `AWVT/.env.local`.

## 7. Test a Call

1. Run `npm run dev` from `AWVT`.
2. Wait for the backend, helper page, Cloudflare tunnels and Expo to start.
3. Open the installed development build on the Android device.
4. Allow camera and microphone access.
5. Start a call to create a session and helper invitation.
6. Open the generated helper link on the second device.
7. Join the session from the helper page.
8. Confirm that both participants can see and hear each other.
9. Test the mute, camera and leave-call controls.

## Environment Variables

| Variable | Location | Purpose |
| --- | --- | --- |
| `AGORA_APP_ID` | `WalkBuddySessionServer/.env` | Identifies the Agora project |
| `AGORA_APP_CERTIFICATE` | `WalkBuddySessionServer/.env` | Signs RTC tokens and must remain private |
| `PORT` | `WalkBuddySessionServer/.env` | Selects the backend port; normally `3001` |
| `EXPO_PUBLIC_BACKEND_URL` | Generated in `AWVT/.env.local` | Public Cloudflare URL for the session backend |
| `EXPO_PUBLIC_HELPER_PAGE_URL` | Generated in `AWVT/.env.local` | Public Cloudflare URL for the helper page |

`AWVT/.env.local` is regenerated whenever `npm run dev` creates new Cloudflare Quick Tunnel URLs. It must remain ignored by Git.

Never place `AGORA_APP_CERTIFICATE` in a variable beginning with `EXPO_PUBLIC_` because public Expo variables are included in the client bundle.

## Recommended Root `.gitignore`

```gitignore
node_modules/
.expo/
.env
.env.*
!.env.example
.tools/
.tools-test/
cloudflared.exe
dist/
npm-debug.log*
```

Keeping `.gitignore` in the repository root ensures that it covers `AWVT`, `WalkBuddyHelper` and `WalkBuddySessionServer`.

## Security Notes

- Store the Agora App Certificate only in `WalkBuddySessionServer/.env`.
- Do not commit `.env`, `.env.local`, active tokens or downloaded tunnel executables.
- Generate RTC access tokens through the backend using the App ID and App Certificate.
- Validate channel names and UIDs before generating production tokens.
- Use an authenticated and deployed HTTPS backend for production.
- Replace in-memory session storage with persistent storage before production use.

## Current Limitations

- Android only
- Expo Go is not supported
- Cloudflare Quick Tunnel URLs change when the development environment restarts
- Sessions stored in memory disappear when the backend restarts
- Backend-generated Agora RTC access tokens expire and must be regenerated when required
- The prototype does not provide production-level authentication, persistent call records or complete error recovery

## Troubleshooting

### `expo` is not recognized

```bash
npm install
npx expo start --dev-client
```

### `EXPO_PUBLIC_BACKEND_URL is not configured`

Run `npm run dev` from `AWVT`. Wait until the script creates the Cloudflare URLs and writes `AWVT/.env.local`. Fully restart the Android application if it was connected to an older Metro session.

### The helper or backend folder cannot be found

Confirm that `AWVT`, `WalkBuddyHelper` and `WalkBuddySessionServer` are siblings inside the repository root. In `AWVT/scripts/start-dev.js`, `ROOT_DIRECTORY` should resolve one level above `AWVT`.

### The phone cannot connect

- Confirm that both Cloudflare tunnels started successfully.
- Use the current URLs printed by `npm run dev`.
- Restart the complete environment if a quick-tunnel URL has expired.
- Confirm that the development build is connected to the current Metro server.

### Agora joins without audio or video

- Grant camera and microphone permissions.
- Confirm that both participants use the same Agora project and channel.
- Ensure the participants use different UIDs where required.
- Restart the session if its token has expired.
- Check the Android and server logs for Agora error codes.

### Native Agora module is missing

The application is running in Expo Go or an outdated development build. Rebuild it:

```bash
npx expo prebuild
npx expo run:android
```

## Project Status

This repository is an educational prototype for evaluating Agora-based real-time assistance. It is not a production-ready communication system.
