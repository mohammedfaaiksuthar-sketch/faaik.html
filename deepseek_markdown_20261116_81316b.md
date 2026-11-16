# THE SPIN — Truth or Dare (Multiplayer)

A premium futuristic Truth-or-Dare game with:
- Single player & Multiplayer (max 4)
- 6-digit room codes
- Synced spinning bottle
- Live Firebase chat
- WebRTC voice calling
- Black + electric-blue aesthetic

## 🚀 Deploy to Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. In the project folder run: `vercel`
3. Accept defaults. Done.

Or drag the folder into vercel.com/new.

## 🔥 Firebase Setup

1. Open Firebase Console → Realtime Database → Rules
2. Paste `database.rules.json`
3. Publish.

## 📁 Files

- `index.html` — UI
- `style.css` — styling
- `firebase-config.js` — Firebase init
- `app.js` — game logic, chat, room
- `webrtc.js` — voice calling
- `database.rules.json` — security rules
- `vercel.json` — deploy config

## ⚠️ Security

- Rotate your Firebase API key (it is public in this repo).
- For production, enable Firebase Anonymous Auth and tighten rules.
- Add scheduled cleanup of stale rooms via Cloud Functions.

## 🎮 How to Play

1. Create a room → share 6-digit code.
2. Friends join with code.
3. Tap SPIN → bottle picks a player.
4. Picked player chooses Truth or Dare.
5. Next round. Chat & voice always available.