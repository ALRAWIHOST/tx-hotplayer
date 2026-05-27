import { useEffect, useState } from 'react';
import {
  Server,
  Tv,
  Shield,
  RefreshCcw,
  Ban
} from 'lucide-react';

import './App.css';

const API = 'https://tx-hotplayer.onrender.com';

export default function App() {
  const [devices, setDevices] = useState([]);
  const [mac, setMac] = useState('');
  const [expireAt, setExpireAt] = useState('2026-12-31');
  const [loading, setLoading] = useState(false);

  async function loadDevices() {
    try {
      setLoading(true);

      const res = await fetch(`${API}/devices`);
      const data = await res.json();

      setDevices(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    }

    setLoading(false);
  }

  async function activateDevice(e) {
    e.preventDefault();

    await fetch(`${API}/devices/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mac,
        expire_at: expireAt
      })
    });

    setMac('');
    await loadDevices();
  }

  async function blockDevice(deviceMac) {
    await fetch(`${API}/devices/block`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mac: deviceMac
      })
    });

    await loadDevices();
  }

  useEffect(() => {
    loadDevices();
  }, []);

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1>
            <Shield size={28}/>
            TX HOTPLAYER Admin
          </h1>

          <p>MAC Activation Dashboard</p>
        </div>

        <button onClick={loadDevices}>
          <RefreshCcw size={16}/>
          Refresh
        </button>
      </header>

      <section className="card">
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
      </section>

      <section className="card">
        <h2>
          <Tv size={18}/>
          Devices ({loading ? '...' : devices.length})
        </h2>

        {devices.length === 0 && (
          <p>No devices found.</p>
        )}

        {devices.map(device => (
          <div className="device" key={device.id}>
            <div>
              <b>{device.mac}</b>

              <small>
                {device.active ? 'Active' : 'Inactive'} ·
                {device.blocked ? ' Blocked' : ' Not blocked'} ·
                Expires: {device.expire_at}
              </small>
            </div>

            <button
              className="danger"
              onClick={() => blockDevice(device.mac)}
            >
              <Ban size={14}/>
              Block
            </button>
          </div>
        ))}
      </section>
    </main>
  );
}