import express from 'express';
import { nanoid } from 'nanoid';
import { readStore, writeStore } from '../db/store.js';

const router = express.Router();

router.post('/check', (req, res) => {
  const { mac, deviceName } = req.body;
  if (!mac) return res.status(400).json({ error: 'MAC is required' });

  const db = readStore();
  let device = db.devices.find((item) => item.mac === mac);

  if (!device) {
    device = { id: nanoid(), mac, deviceName: deviceName || 'TV Device', active: false, playlistId: null, expiresAt: null, createdAt: new Date().toISOString() };
    db.devices.push(device);
    writeStore(db);
  }

  res.json({ status: device.active ? 'active' : 'pending', device });
});

router.get('/', (_req, res) => res.json(readStore().devices));

router.patch('/:id', (req, res) => {
  const db = readStore();
  const device = db.devices.find((item) => item.id === req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  Object.assign(device, req.body);
  writeStore(db);
  res.json(device);
});

export default router;
