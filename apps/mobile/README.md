# Mediabox mobile

Expo (SDK 57) app for iOS and Android: sign in, browse your library and files shared with you,
upload photos and videos (same multipart engine as the web app), view and play them, and manage
visibility and sharing.

```bash
cp .env.example .env     # pick the API URL for your device type (see comments inside)
pnpm start               # i = iOS simulator, a = Android emulator, or scan the QR code with Expo Go
```

- Architecture and structure: [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md#mobile-app-appsmobile)
- Setup per device, conventions, troubleshooting: [docs/DEVELOPMENT.md](../../docs/DEVELOPMENT.md#mobile-app)
- Why it talks to the API directly: [ADR-0006](../../docs/adr/0006-mobile-client.md)
