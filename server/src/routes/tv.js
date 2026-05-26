import express from 'express';
import { readStore } from '../db/store.js';
import { parseM3U } from '../services/m3u.js';
import { getXtreamLiveChannels } from '../services/xtream.js';

const router = express.Router();

router.get('/bootstrap/:mac', async (req, res) => {
  try {
    const db = readStore();
    const device = db.devices.find((item) => item.mac === req.params.mac);

    if (!device || !device.active) {
      return res.json({ status: 'pending', message: 'Device is not activated' });
    }

    if (device.expiresAt && new Date(device.expiresAt) < new Date()) {
      return res.json({ status: 'expired', message: 'Subscription expired' });
    }

    const playlist = db.playlists.find((item) => item.id === device.playlistId);
    if (!playlist) return res.json({ status: 'no_playlist', message: 'No playlist assigned' });

    const channels = playlist.type === 'm3u' ? parseM3U(playlist.m3uText || '') : await getXtreamLiveChannels(playlist);
    res.json({ status: 'active', device, channels });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
