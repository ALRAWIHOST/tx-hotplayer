import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Server, Tv, RefreshCcw } from 'lucide-react';
import './style.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function App() {
  const [devices, setDevices] = useState([]);
  const [mac, setMac] = useState('TV:A0:9F:31:06:8D');
  const [expireAt, setExpireAt] = useState('2026-12-31');

  async function load() {
    const res = await fetch(`${API}/devices`);
    const data = await res.json();
    setDevices(data);
  }

  async function activateDevice(e) {
    e.preventDefault();

    await fetch(`${API}/devices/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac, expire_at: expireAt })
    });

    load();
  }

  async function blockDevice(deviceMac) {
    await fetch(`${API}/devices/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac: deviceMac })
    });

    load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main>
      <header>
        <h1><Server /> IPTV Admin</h1>
        <button onClick={load}><RefreshCcw size={16}/> Refresh</button>
      </header>

      <section className="grid">
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

        <div className="card">
          <h2>Instructions</h2>
          <p>1. العميل يرسل لك MAC.</p>
          <p>2. أدخل MAC هنا.</p>
          <p>3. اختر تاريخ انتهاء الاشتراك.</p>
          <p>4. اضغط Activate Device.</p>
        </div>
      </section>

      <section className="card">
        <h2><Tv/> Devices</h2>

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