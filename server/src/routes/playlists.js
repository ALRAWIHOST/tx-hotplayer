import express from 'express';
import { nanoid } from 'nanoid';
import { readStore, writeStore } from '../db/store.js';
import { parseM3U } from '../services/m3u.js';
import { getXtreamLiveChannels } from '../services/xtream.js';

const router = express.Router();

router.get('/', (_req, res) => res.json(readStore().playlists));

router.post('/', (req, res) => {
  const { name, type, serverUrl, username, password, m3uText } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
  const db = readStore();
  const playlist = { id: nanoid(), name, type, serverUrl, username, password, m3uText, createdAt: new Date().toISOString() };
  db.playlists.push(playlist);
  writeStore(db);
  res.json(playlist);
});

router.get('/:id/channels', async (req, res) => {
  try {
    const db = readStore();
    const playlist = db.playlists.find((item) => item.id === req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

    if (playlist.type === 'm3u') return res.json(parseM3U(playlist.m3uText || ''));
    if (playlist.type === 'xtream') return res.json(await getXtreamLiveChannels(playlist));

    res.status(400).json({ error: 'Unsupported playlist type' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
