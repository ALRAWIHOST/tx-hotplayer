import { useEffect, useMemo, useState } from 'react';
import {
  Server,
  Tv,
  Shield,
  RefreshCcw,
  Ban,
  Search,
  CheckCircle,
  XCircle,
  Database
} from 'lucide-react';

import './App.css';

const API = 'https://tx-hotplayer-api.onrender.com';

export default function App() {
  const [devices, setDevices] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [mac, setMac] = useState('');
  const [expireAt, setExpireAt] = useState('2026-12-31');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadDevices() {
    try {
      setLoading(true);
      const res = await fetch(`${API}/devices`);
      const data = await res.json();
      setDevices(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  async function loadPlaylists() {
    const res = await fetch(`${API}/playlists`);
    const data = await res.json();
    setPlaylists(Array.isArray(data) ? data : []);
  }

  async function refreshAll() {
    await Promise.all([
      loadDevices(),
      loadPlaylists()
    ]);
  }

  async function activateDevice(e) {
    e.preventDefault();

    await fetch(`${API}/devices/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac, expire_at: expireAt })
    });

    setMac('');
    await loadDevices();
  }

  async function blockDevice(deviceMac) {
    await fetch(`${API}/devices/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac: deviceMac })
    });

    await loadDevices();
  }

  async function assignPlaylist(deviceMac, playlistId) {
    if (!playlistId) return;

    await fetch(`${API}/devices/assign-playlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mac: deviceMac,
        playlist_id: Number(playlistId)
      })
    });

    await loadDevices();
  }

  useEffect(() => {
    refreshAll();
  }, []);

  const stats = useMemo(() => {
    return {
      total: devices.length,
      active: devices.filter(d => d.active && !d.blocked).length,
      blocked: devices.filter(d => d.blocked).length,
      withPlaylist: devices.filter(d => d.playlist_id).length
    };
  }, [devices]);

  const filteredDevices = devices.filter(d =>
    d.mac.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1>
            <Shield size={30}/>
            TX HOTPLAYER Admin
          </h1>

          <p>Professional MAC Activation Dashboard</p>
        </div>

        <button onClick={refreshAll}>
          <RefreshCcw size={16}/>
          Refresh
        </button>
      </header>

      <section className="stats">
        <div className="stat-card">
          <Tv />
          <span>Total Devices</span>
          <b>{stats.total}</b>
        </div>

        <div className="stat-card success">
          <CheckCircle />
          <span>Active</span>
          <b>{stats.active}</b>
        </div>

        <div className="stat-card danger-card">
          <XCircle />
          <span>Blocked</span>
          <b>{stats.blocked}</b>
        </div>

        <div className="stat-card">
          <Database />
          <span>With Playlist</span>
          <b>{stats.withPlaylist}</b>
        </div>
      </section>

      <section className="layout">
        <div className="card">
          <h2>
            <Server size={18}/>
            Activate Device
          </h2>

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

            <button>
              Activate MAC
            </button>
          </form>
        </div>

        <div className="card">
          <h2>
            <Search size={18}/>
            Search Device
          </h2>

          <input
            placeholder="Search by MAC..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />

          <p className="muted">
            Showing {filteredDevices.length} of {devices.length} devices.
          </p>

          <p className="muted">
            Playlists loaded: {playlists.length}
          </p>
        </div>
      </section>

      <section className="card">
        <h2>
          <Tv size={18}/>
          Devices {loading ? '...' : `(${filteredDevices.length})`}
        </h2>

        <div className="table">
          <div className="table-head">
            <span>MAC</span>
            <span>Status</span>
            <span>Playlist</span>
            <span>Expires</span>
            <span>Action</span>
          </div>

          {filteredDevices.map(device => (
            <div className="table-row" key={device.id}>
              <b>{device.mac}</b>

              <span className={device.blocked ? 'bad' : device.active ? 'good' : 'pending'}>
                {device.blocked ? 'Blocked' : device.active ? 'Active' : 'Inactive'}
              </span>

              <select
                value={device.playlist_id || ''}
                onChange={e => assignPlaylist(device.mac, e.target.value)}
              >
                <option value="">
                  No Playlist
                </option>

                {playlists.map(playlist => (
                  <option
                    key={playlist.id}
                    value={playlist.id}
                  >
                    #{playlist.id} {playlist.name}
                  </option>
                ))}
              </select>

              <span>
                {device.expire_at?.slice(0, 10)}
              </span>

              <button
                className="danger"
                onClick={() => blockDevice(device.mac)}
              >
                <Ban size={14}/>
                Block
              </button>
            </div>
          ))}
        </div>

        {filteredDevices.length === 0 && (
          <p className="muted">No devices found.</p>
        )}
      </section>
    </main>
  );
}
