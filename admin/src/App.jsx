import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Server,
  Tv,
  RefreshCcw,
  Wifi,
  ListPlus,
  Link
} from 'lucide-react';
import './style.css';

const API = 'https://tx-hotplayer.onrender.com';

function App() {
  const [devices, setDevices] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [mac, setMac] = useState('TV:A0:9F:31:06:8D');
  const [expireAt, setExpireAt] = useState('2026-12-31');
  const [status, setStatus] = useState('Checking...');
  const [loading, setLoading] = useState(false);

  const [playlistForm, setPlaylistForm] = useState({
    name: 'Test IPTV',
    type: 'm3u',
    server_url: '',
    username: '',
    password: ''
  });

  async function checkHealth() {
    try {
      const res = await fetch(`${API}/health`);
      const data = await res.json();
      setStatus(data.database === 'connected' ? 'Cloud Connected' : 'Database Error');
    } catch {
      setStatus('Server Offline');
    }
  }

  async function load() {
    try {
      setLoading(true);

      const devicesRes = await fetch(`${API}/devices`);
      const devicesData = await devicesRes.json();

      const playlistsRes = await fetch(`${API}/playlists`);
      const playlistsData = await playlistsRes.json();

      setDevices(Array.isArray(devicesData) ? devicesData : []);
      setPlaylists(Array.isArray(playlistsData) ? playlistsData : []);
    } finally {
      setLoading(false);
    }
  }

  async function activateDevice(e) {
    e.preventDefault();

    await fetch(`${API}/devices/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac, expire_at: expireAt })
    });

    await load();
  }

  async function blockDevice(deviceMac) {
    await fetch(`${API}/devices/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac: deviceMac })
    });

    await load();
  }

  async function createPlaylist(e) {
    e.preventDefault();

    await fetch(`${API}/playlists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(playlistForm)
    });

    setPlaylistForm({
      name: 'Test IPTV',
      type: 'm3u',
      server_url: '',
      username: '',
      password: ''
    });

    await load();
  }

  async function assignPlaylist(deviceMac, playlistId) {
    if (!playlistId) return;

    await fetch(`${API}/devices/assign-playlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac: deviceMac, playlist_id: playlistId })
    });

    await load();
  }

  useEffect(() => {
    checkHealth();
    load();
  }, []);

  return (
    <main>
      <header>
        <h1><Server /> TX HOTPLAYER Admin</h1>
        <button onClick={load}><RefreshCcw size={16}/> Refresh</button>
      </header>

      <section className="grid">
        <div className="card">
          <h2><Wifi /> Cloud Status</h2>
          <p>{status}</p>
          <small>{API}</small>
        </div>

        <div className="card">
          <h2>Activate Device</h2>

          <form onSubmit={activateDevice}>
            <input
              placeholder="MAC Address"
              value={mac}
              onChange={e => setMac(e.target.value)}
            />

            <input
              type="date"
              value={expireAt}
              onChange={e => setExpireAt(e.target.value)}
            />

            <button>Activate Device</button>
          </form>
        </div>
      </section>

      <section className="grid">
        <div className="card">
          <h2><ListPlus /> Add Playlist</h2>

          <form onSubmit={createPlaylist}>
            <input
              placeholder="Playlist Name"
              value={playlistForm.name}
              onChange={e => setPlaylistForm({ ...playlistForm, name: e.target.value })}
            />

            <select
              value={playlistForm.type}
              onChange={e => setPlaylistForm({ ...playlistForm, type: e.target.value })}
            >
              <option value="m3u">M3U URL</option>
              <option value="xtream">Xtream Codes</option>
            </select>

            <input
              placeholder="M3U URL / Server URL"
              value={playlistForm.server_url}
              onChange={e => setPlaylistForm({ ...playlistForm, server_url: e.target.value })}
            />

            {playlistForm.type === 'xtream' && (
              <>
                <input
                  placeholder="Username"
                  value={playlistForm.username}
                  onChange={e => setPlaylistForm({ ...playlistForm, username: e.target.value })}
                />

                <input
                  placeholder="Password"
                  type="password"
                  value={playlistForm.password}
                  onChange={e => setPlaylistForm({ ...playlistForm, password: e.target.value })}
                />
              </>
            )}

            <button>Create Playlist</button>
          </form>
        </div>

        <div className="card">
          <h2><Link /> Playlists ({playlists.length})</h2>

          {playlists.length === 0 && <p>No playlists found.</p>}

          {playlists.map(p => (
            <div className="device" key={p.id}>
              <div>
                <b>#{p.id} · {p.name}</b>
                <small>{p.type} · {p.server_url}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2><Tv/> Devices {loading ? '...' : `(${devices.length})`}</h2>

        {devices.length === 0 && <p>No devices found.</p>}

        {devices.map(d => (
          <div className="device" key={d.id}>
            <div>
              <b>{d.mac}</b>
              <small>
                {d.active ? 'Active' : 'Pending'} ·
                {d.blocked ? ' Blocked' : ' Not blocked'} ·
                Playlist: {d.playlist_id || 'None'} ·
                Expires: {d.expire_at}
              </small>
            </div>

            <select
              value={d.playlist_id || ''}
              onChange={e => assignPlaylist(d.mac, e.target.value)}
            >
              <option value="">No playlist</option>
              {playlists.map(p => (
                <option key={p.id} value={p.id}>
                  #{p.id} {p.name}
                </option>
              ))}
            </select>

            <button onClick={() => blockDevice(d.mac)}>
              Block
            </button>
          </div>
        ))}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);