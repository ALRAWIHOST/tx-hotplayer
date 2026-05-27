import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Server, Tv, RefreshCcw, Wifi } from 'lucide-react';
import './style.css';

const API =
  import.meta.env.VITE_API_URL || 'https://tx-hotplayer.onrender.com';

function App() {
  const [devices, setDevices] = useState([]);
  const [mac, setMac] = useState('TV:A0:9F:31:06:8D');
  const [expireAt, setExpireAt] = useState('2026-12-31');
  const [status, setStatus] = useState('Checking...');
  const [loading, setLoading] = useState(false);

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
      const res = await fetch(`${API}/devices`);
      const data = await res.json();
      setDevices(Array.isArray(data) ? data : []);
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

      <section className="card">
        <h2><Tv/> Devices {loading ? '...' : `(${devices.length})`}</h2>

        {devices.length === 0 && <p>No devices found.</p>}

        {devices.map((d, index) => (
          <div className="device" key={index}>
            <div>
              <b>{d.mac}</b>
              <small>
                {d.active ? 'Active' : 'Pending'} ·
                {d.blocked ? ' Blocked' : ' Not blocked'} ·
                Expires: {d.expire_at}
              </small>
            </div>

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