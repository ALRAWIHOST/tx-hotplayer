# API

## Device check
POST `/api/device/check`

```json
{"mac":"TV:AA:BB:CC:DD:EE","deviceName":"Android TV"}
```

## TV bootstrap
GET `/api/tv/bootstrap/:mac`

Returns pending, expired, no_playlist, or active with channels.

## Playlists
GET `/api/playlists`
POST `/api/playlists`

Types: `xtream`, `m3u`.
