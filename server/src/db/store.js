import fs from 'fs';
import path from 'path';

const file = path.resolve(process.cwd(), 'data.json');

const initial = {
  devices: [],
  playlists: [],
  settings: { appName: 'Server Player' }
};

export function readStore() {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(initial, null, 2));
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeStore(data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return data;
}
