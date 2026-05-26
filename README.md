# IPTV TV Platform

A complete starter platform for a HotPlayer-style IPTV media player concept:

- TV app: MAC activation screen + server content player UI
- Backend API: device activation, playlist import, Xtream/M3U parsing endpoints
- Admin panel: manage devices and playlists

> This project is a media-player platform only. It does not include channels or copyrighted content. Connect only content/sources you are authorized to use.

## Structure

```txt
server/   Node.js + Express API
admin/    React admin dashboard
tv-app/   React TV player prototype
docs/     API and deployment notes
```

## Quick start

### 1) Server

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

### 2) Admin

```bash
cd admin
npm install
npm run dev
```

### 3) TV App

```bash
cd tv-app
npm install
npm run dev
```

Default API URL: `http://localhost:4000`

## Next production steps

- Replace JSON storage with PostgreSQL
- Package TV app as Android TV app using React Native TV or Capacitor Android
- Add authentication for admin users
- Put the backend behind HTTPS/Nginx
