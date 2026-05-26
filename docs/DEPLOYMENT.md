# Deployment

Recommended production setup:

- Ubuntu server
- Node.js 20+
- Nginx reverse proxy
- HTTPS certificate
- PostgreSQL instead of JSON file storage
- Separate admin login and roles

Do not expose provider credentials in the TV app. Keep Xtream/M3U credentials in the backend only.
