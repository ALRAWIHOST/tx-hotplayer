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
  ssl: { rejectUnauthorized: false },
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
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
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

async function getActiveDevice(mac) {
  const result = await pool.query(
    `SELECT * FROM devices WHERE mac = $1 LIMIT 1`,
    [mac]
  );

  const device = result.rows[0];

  if (!device || !device.active) return { error: "Device not activated" };
  if (device.blocked) return { error: "Device blocked" };
  if (device.expire_at && new Date() > new Date(device.expire_at)) {
    return { error: "Subscription expired" };
  }

  return { device };
}

async function loadM3UChannels(playlist) {
  if (!playlist || playlist.type !== "m3u") return [];

  if (playlistCache[playlist.id]) return playlistCache[playlist.id];
  if (playlistLoading[playlist.id]) return await playlistLoading[playlist.id];

  playlistLoading[playlist.id] = (async () => {
    const response = await axios({
      method: "get",
      url: playlist.server_url,
      responseType: "stream",
      timeout: 120000,
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "*/*",
        Connection: "keep-alive",
      },
      maxRedirects: 5,
      decompress: true,
      validateStatus: () => true,
    });

    if (response.status !== 200) {
      throw new Error(`M3U server blocked request: ${response.status}`);
    }

    return await new Promise((resolve, reject) => {
      let raw = "";
      let finished = false;

      response.data.on("data", chunk => {
        if (finished) return;

        raw += chunk.toString();
        const found = (raw.match(/#EXTINF/g) || []).length;

        if (found >= 300) {
          finished = true;
          response.data.destroy();

          const channels = parseM3U(raw).slice(0, 300);
          playlistCache[playlist.id] = channels;
          delete playlistLoading[playlist.id];

          resolve(channels);
        }
      });

      response.data.on("end", () => {
        if (finished) return;

        const channels = parseM3U(raw).slice(0, 300);
        playlistCache[playlist.id] = channels;
        delete playlistLoading[playlist.id];

        resolve(channels);
      });

      response.data.on("error", err => {
        delete playlistLoading[playlist.id];
        reject(err);
      });
    });
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
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/devices/unblock", async (req, res) => {
  try {
    const { mac } = req.body;

    if (!mac) {
      return res.status(400).json({ success: false, message: "MAC is required" });
    }

    const result = await pool.query(
      `
      UPDATE devices
      SET blocked = false, active = true
      WHERE mac = $1
      RETURNING *
      `,
      [mac]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Device not found" });
    }

    res.json({ success: true, device: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/devices/:mac", async (req, res) => {
  try {
    const mac = req.params.mac;

    const result = await pool.query(
      `
      DELETE FROM devices
      WHERE mac = $1
      RETURNING *
      `,
      [mac]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Device not found" });
    }

    res.json({ success: true });
  } catch (error) {
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
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/device/:mac", async (req, res) => {
  try {
    const mac = req.params.mac;
    const { device, error } = await getActiveDevice(mac);

    if (error) return res.json({ active: false, message: error });

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
        m3u_url: playlist.server_url,
      },
    });
  } catch (error) {
    res.status(500).json({
      active: false,
      message: "Failed to load device",
      error: error.message,
    });
  }
});

app.get("/m3u/:mac", async (req, res) => {
  try {
    const mac = req.params.mac;
    const { device, error } = await getActiveDevice(mac);

    if (error) {
      return res.status(403).json({ success: false, message: error });
    }

    const playlist = await getPlaylistById(device.playlist_id);

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "No playlist assigned",
      });
    }

    const channels = await loadM3UChannels(playlist);

    res.json({
      success: true,
      playlist: {
        id: playlist.id,
        name: playlist.name,
        type: playlist.type,
      },
      channels,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
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
app.patch("/playlists/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, server_url } = req.body;

    const result = await pool.query(
      `
      UPDATE playlists
      SET
        name = COALESCE($2, name),
        server_url = COALESCE($3, server_url)
      WHERE id = $1
      RETURNING *
      `,
      [id, name || null, server_url || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Playlist not found"
      });
    }

    playlistCache = {};
    playlistLoading = {};

    res.json({
      success: true,
      playlist: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete("/playlists/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `UPDATE devices SET playlist_id = NULL WHERE playlist_id = $1`,
      [id]
    );

    const result = await pool.query(
      `DELETE FROM playlists WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Playlist not found"
      });
    }

    playlistCache = {};
    playlistLoading = {};

    res.json({
      success: true
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
app.post("/devices/delete-playlist", async (req, res) => {
  try {
    const { mac } = req.body;

    if (!mac) {
      return res.status(400).json({
        success: false,
        message: "MAC is required"
      });
    }

    const deviceResult = await pool.query(
      `SELECT * FROM devices WHERE mac = $1 LIMIT 1`,
      [mac]
    );

    const device = deviceResult.rows[0];

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device not found"
      });
    }

    if (!device.playlist_id) {
      return res.status(404).json({
        success: false,
        message: "No playlist assigned"
      });
    }

    const playlistId = device.playlist_id;

    await pool.query(
      `UPDATE devices SET playlist_id = NULL WHERE mac = $1`,
      [mac]
    );

    await pool.query(
      `DELETE FROM playlists WHERE id = $1`,
      [playlistId]
    );

    playlistCache = {};
    playlistLoading = {};

    res.json({
      success: true,
      message: "Playlist deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
app.post("/activation-requests", async (req, res) => {
  try {
    const { mac, plan, price } = req.body;

    if (!mac || !plan) {
      return res.status(400).json({
        success: false,
        message: "MAC and plan are required"
      });
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS activation_requests (
        id SERIAL PRIMARY KEY,
        mac TEXT NOT NULL,
        plan TEXT NOT NULL,
        price TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    const result = await pool.query(
      `
      INSERT INTO activation_requests (mac, plan, price, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING *
      `,
      [mac, plan, price || null]
    );

    res.json({
      success: true,
      request: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("/activation-requests", async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activation_requests (
        id SERIAL PRIMARY KEY,
        mac TEXT NOT NULL,
        plan TEXT NOT NULL,
        price TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    const result = await pool.query(`
      SELECT *
      FROM activation_requests
      ORDER BY id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json([]);
  }
});

app.post("/activation-requests/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;

    const requestResult = await pool.query(
      `SELECT * FROM activation_requests WHERE id = $1 LIMIT 1`,
      [id]
    );

    const request = requestResult.rows[0];

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found"
      });
    }

    const expireAt =
      request.plan === "forever" ? "2099-12-31" : "2028-12-31";

    await pool.query(
      `
      INSERT INTO devices (mac, active, blocked, expire_at)
      VALUES ($1, true, false, $2)
      ON CONFLICT (mac)
      DO UPDATE SET
        active = true,
        blocked = false,
        expire_at = EXCLUDED.expire_at
      `,
      [request.mac, expireAt]
    );

    await pool.query(
      `
      UPDATE activation_requests
      SET status = 'approved'
      WHERE id = $1
      `,
      [id]
    );

    res.json({
      success: true,
      mac: request.mac
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post("/activation-requests/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `
      UPDATE activation_requests
      SET status = 'rejected'
      WHERE id = $1
      `,
      [id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
async function ensureActivationRequestsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activation_requests (
      id SERIAL PRIMARY KEY,
      mac TEXT NOT NULL,
      plan TEXT NOT NULL,
      price TEXT,
      status TEXT DEFAULT 'pending',
      transaction_id TEXT,
      payer_email TEXT,
      payer_name TEXT,
      paypal_order_id TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE activation_requests ADD COLUMN IF NOT EXISTS transaction_id TEXT;`);
  await pool.query(`ALTER TABLE activation_requests ADD COLUMN IF NOT EXISTS payer_email TEXT;`);
  await pool.query(`ALTER TABLE activation_requests ADD COLUMN IF NOT EXISTS payer_name TEXT;`);
  await pool.query(`ALTER TABLE activation_requests ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;`);
}

function getPayPalBaseUrl() {
  return process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function getPayPalAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await axios.post(
    `${getPayPalBaseUrl()}/v1/oauth2/token`,
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );

  return response.data.access_token;
}

app.post("/paypal/create-order", async (req, res) => {
  try {
    const { mac, plan } = req.body;

    if (!mac || !plan) {
      return res.status(400).json({
        success: false,
        message: "MAC and plan are required"
      });
    }

    const amount = plan === "forever" ? "14.99" : "5.99";
    const token = await getPayPalAccessToken();

    const response = await axios.post(
      `${getPayPalBaseUrl()}/v2/checkout/orders`,
      {
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: amount
            },
            custom_id: mac,
            description: `TX HOTPLAYER ${plan} activation`
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({
      success: true,
      orderID: response.data.id
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

app.post("/paypal/capture-order", async (req, res) => {
  try {
    const { orderID, mac, plan } = req.body;

    if (!orderID || !mac || !plan) {
      return res.status(400).json({
        success: false,
        message: "orderID, MAC and plan are required"
      });
    }

    await ensureActivationRequestsTable();

    const token = await getPayPalAccessToken();

    const response = await axios.post(
      `${getPayPalBaseUrl()}/v2/checkout/orders/${orderID}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    const status = response.data.status;

    if (status !== "COMPLETED") {
      return res.status(400).json({
        success: false,
        message: "Payment not completed",
        status
      });
    }

    const capture =
      response.data.purchase_units?.[0]?.payments?.captures?.[0];

    const transactionId = capture?.id || orderID;
    const payerEmail = response.data.payer?.email_address || null;

    const payerName = [
      response.data.payer?.name?.given_name,
      response.data.payer?.name?.surname
    ].filter(Boolean).join(" ") || null;

    const expireAt = plan === "forever" ? "2099-12-31" : "2028-12-31";
    const price = plan === "forever" ? "$14.99" : "$5.99";

    await pool.query(
      `
      INSERT INTO devices (mac, active, blocked, expire_at)
      VALUES ($1, true, false, $2)
      ON CONFLICT (mac)
      DO UPDATE SET
        active = true,
        blocked = false,
        expire_at = EXCLUDED.expire_at
      `,
      [mac, expireAt]
    );

    await pool.query(
      `
      INSERT INTO activation_requests (
        mac,
        plan,
        price,
        status,
        transaction_id,
        payer_email,
        payer_name,
        paypal_order_id
      )
      VALUES ($1, $2, $3, 'approved', $4, $5, $6, $7)
      `,
      [
        mac,
        plan,
        price,
        transactionId,
        payerEmail,
        payerName,
        orderID
      ]
    );

    res.json({
      success: true,
      message: "Payment completed and MAC activated",
      mac,
      expire_at: expireAt,
      transaction_id: transactionId,
      payer_email: payerEmail,
      payer_name: payerName
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

startServer();
startServer();