import dotenv from "dotenv";
import pkg from "pg";
import express from "express";
import cors from "cors";
import axios from "axios";

dotenv.config();

const { Pool } = pkg;
const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

let playlistCache = {};
let playlistLoading = {};

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS playlists (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      server_url TEXT,
      username TEXT,
      password TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS devices (
      id SERIAL PRIMARY KEY,
      mac TEXT UNIQUE NOT NULL,
      active BOOLEAN DEFAULT false,
      blocked BOOLEAN DEFAULT false,
      expire_at DATE,
      playlist_id INTEGER REFERENCES playlists(id),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS activation_logs (
      id SERIAL PRIMARY KEY,
      mac TEXT,
      action TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log("Database tables ready");
}

function parseM3U(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const channels = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("#EXTINF")) {
      const info = lines[i];
      const url = lines[i + 1];

      if (!url || url.startsWith("#")) continue;

      channels.push({
        id: channels.length + 1,
        name: info.split(",").pop()?.trim() || "Unknown Channel",
        logo: info.match(/tvg-logo="([^"]+)"/)?.[1] || "",
        group: info.match(/group-title="([^"]+)"/)?.[1] || "Live",
        url,
      });
    }
  }

  return channels;
}

async function getPlaylistById(id) {
  if (!id) return null;

  const result = await pool.query(
    `SELECT * FROM playlists WHERE id = $1 LIMIT 1`,
    [id]
  );

  return result.rows[0];
}

async function loadM3UChannels(playlist) {
  if (!playlist || playlist.type !== "m3u") return [];

  if (playlistCache[playlist.id]) return playlistCache[playlist.id];
  if (playlistLoading[playlist.id]) return await playlistLoading[playlist.id];

  playlistLoading[playlist.id] = (async () => {
    const response = await axios.get(playlist.server_url, {
      timeout: 60000,
      responseType: "text",
      headers: {
        "User-Agent": "VLC/3.0.18 LibVLC/3.0.18",
        "Accept": "*/*",
        "Connection": "keep-alive",
        "Referer": playlist.server_url,
      },
      validateStatus: () => true,
    });

    if (response.status !== 200) {
      throw new Error(`M3U server blocked request: ${response.status}`);
    }

    const channels = parseM3U(response.data).slice(0, 100);
    playlistCache[playlist.id] = channels;
    delete playlistLoading[playlist.id];

    return channels;
  })();

  return await playlistLoading[playlist.id];
}

app.get("/", (req, res) => {
  res.send("TX HOTPLAYER API is running");
});

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (error) {
    res.json({ ok: true, database: "not connected", error: error.message });
  }
});

app.get("/devices", async (req, res) => {
  const result = await pool.query(`
    SELECT id, mac, active, blocked, expire_at, playlist_id, created_at
    FROM devices
    ORDER BY id DESC
  `);

  res.json(result.rows);
});

app.post("/devices/activate", async (req, res) => {
  try {
    const { mac, expire_at } = req.body;

    if (!mac) {
      return res.status(400).json({ success: false, message: "MAC is required" });
    }

    const finalExpireAt = expire_at || "2026-12-31";

    await pool.query(
      `
      INSERT INTO devices (mac, active, blocked, expire_at, playlist_id)
      VALUES ($1, true, false, $2, NULL)
      ON CONFLICT (mac)
      DO UPDATE SET
        active = true,
        blocked = false,
        expire_at = EXCLUDED.expire_at
      `,
      [mac, finalExpireAt]
    );

    await pool.query(
      `INSERT INTO activation_logs (mac, action) VALUES ($1, $2)`,
      [mac, "activated"]
    );

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/devices/block", async (req, res) => {
  try {
    const { mac } = req.body;

    if (!mac) {
      return res.status(400).json({ success: false, message: "MAC is required" });
    }

    const result = await pool.query(
      `
      UPDATE devices
      SET blocked = true, active = false
      WHERE mac = $1
      RETURNING *
      `,
      [mac]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Device not found" });
    }

    await pool.query(
      `INSERT INTO activation_logs (mac, action) VALUES ($1, $2)`,
      [mac, "blocked"]
    );

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/playlists", async (req, res) => {
  const result = await pool.query(`
    SELECT id, name, type, server_url, username, created_at
    FROM playlists
    ORDER BY id DESC
  `);

  res.json(result.rows);
});

app.post("/playlists", async (req, res) => {
  try {
    const { name, type, server_url, username, password } = req.body;

    const result = await pool.query(
      `
      INSERT INTO playlists (name, type, server_url, username, password)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [name, type || "m3u", server_url, username || null, password || null]
    );

    playlistCache = {};
    playlistLoading = {};

    res.json({ success: true, playlist: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/devices/assign-playlist", async (req, res) => {
  try {
    const { mac, playlist_id } = req.body;

    if (!mac || !playlist_id) {
      return res.status(400).json({
        success: false,
        message: "MAC and playlist_id are required",
      });
    }

    const result = await pool.query(
      `
      UPDATE devices
      SET playlist_id = $2
      WHERE mac = $1
      RETURNING *
      `,
      [mac, Number(playlist_id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Device not found" });
    }

    res.json({ success: true, device: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/device/:mac", async (req, res
  try {
    const mac = req.params.mac;

    const result = await pool.query(
      `SELECT * FROM devices WHERE mac = $1 LIMIT 1`,
      [mac]
    );

    const device = result.rows[0];

    if (!device || !device.active) {
      return res.json({ active: false, message: "Device not activated" });
    }

    if (device.blocked) {
      return res.json({ active: false, message: "Device blocked" });
    }

    if (new Date() > new Date(device.expire_at)) {
      return res.json({ active: false, message: "Subscription expired" });
    }

    const playlist = await getPlaylistById(device.playlist_id);

    if (!playlist) {
      return res.json({ active: false, message: "No playlist assigned" });
    }

    res.json({
      active: true,
      expire_at: device.expire_at,
      playlist: {
        id: playlist.id,
        name: playlist.name,
        type: playlist.type,
        m3u_url: playlist.server_url
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      active: false,
      message: "Failed to load playlist",
      error: error.message,
    });
  }
});

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    await initDatabase();

    app.listen(PORT, () => {
      console.log(`API running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server failed:", error);
  }
}

startServer();