import { useEffect, useMemo, useState } from 'react';
import {
  Server, Tv, Shield, RefreshCcw, Ban, Search, CheckCircle,
  XCircle, Database, Trash2, Unlock, Clock3, DollarSign
} from 'lucide-react';

import './App.css';

const API = 'https://tx-hotplayer-api.onrender.com';
const ONLINE_MINUTES = 5;

function isOnline(lastSeen) {
  if (!lastSeen) return false;
  const lastSeenTime = new Date(lastSeen).getTime();
  if (Number.isNaN(lastSeenTime)) return false;
  return (Date.now() - lastSeenTime) / 60000 < ONLINE_MINUTES;
}

function formatLastSeen(lastSeen) {
  if (!lastSeen) return '-';
  const lastSeenTime = new Date(lastSeen);
  if (Number.isNaN(lastSeenTime.getTime())) return '-';
  return lastSeenTime.toLocaleString();
}

export default function App() {
  const [devices, setDevices] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [requests, setRequests] = useState([]);
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

  async function loadRequests() {
    const res = await fetch(`${API}/activation-requests`);
    const data = await res.json();
    setRequests(Array.isArray(data) ? data : []);
  }

  async function refreshAll() {
    await Promise.all([loadDevices(), loadPlaylists(), loadRequests()]);
  }

  async function activateDevice(e) {
    e.preventDefault();

    await fetch(`${API}/devices/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac, expire_at: expireAt })
    });

    setMac('');
    await refreshAll();
  }

  async function blockDevice(deviceMac) {
    await fetch(`${API}/devices/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac: deviceMac })
    });

    await refreshAll();
  }

  async function unblockDevice(deviceMac) {
    await fetch(`${API}/devices/unblock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac: deviceMac })
    });

    await refreshAll();
  }

  async function deleteDevice(deviceMac) {
    const ok = window.confirm(`Delete device ${deviceMac}?`);
    if (!ok) return;

    await fetch(`${API}/devices/${encodeURIComponent(deviceMac)}`, {
      method: 'DELETE'
    });

    await refreshAll();
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

    await refreshAll();
  }

  useEffect(() => {
    refreshAll();
  }, []);

  const stats = useMemo(() => {
    const approved = requests.filter(r => r.status === 'approved');

    const revenue = approved.reduce((sum, r) => {
      const value = Number(String(r.price || '0').replace('$', ''));
      return sum + (Number.isNaN(value) ? 0 : value);
    }, 0);

    return {
      total: devices.length,
      active: devices.filter(d => d.active && !d.blocked).length,
      blocked: devices.filter(d => d.blocked).length,
      withPlaylist: devices.filter(d => d.playlist_id).length,
      paidActivations: approved.length,
      online: devices.filter(d => isOnline(d.last_seen)).length,
      revenue: revenue.toFixed(2)
    };
  }, [devices, requests]);

  const filteredDevices = devices.filter(d =>
    d.mac.toLowerCase().includes(query.toLowerCase())
  );

  const recentPayments = requests
    .filter(r => r.status === 'approved')
    .slice(0, 10);

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

        <div className="stat-card success">
          <Clock3 />
          <span>Online</span>
          <b>{stats.online}</b>
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

        <div className="stat-card success">
          <DollarSign />
          <span>Revenue</span>
          <b>${stats.revenue}</b>
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

          <p className="muted">Showing {filteredDevices.length} of {devices.length} devices.</p>
          <p className="muted">Playlists loaded: {playlists.length}</p>
          <p className="muted">Paid activations: {stats.paidActivations}</p>
          <p className="muted">Online devices: {stats.online}</p>
        </div>
      </section>

      <section className="card">
        <h2>
          <Tv size={18}/>
          Devices {loading ? '...' : `(${filteredDevices.length})`}
        </h2>

        <div className="table">
          <div className="table-head devices-table-head">
            <span>MAC</span>
            <span>Status</span>
            <span>Online</span>
            <span>Last Seen</span>
            <span>Playlist</span>
            <span>Expires</span>
            <span>Actions</span>
          </div>

          {filteredDevices.map(device => (
            <div className="table-row devices-table-row" key={device.id}>
              <b>{device.mac}</b>

              <span className={device.blocked ? 'bad' : device.active ? 'good' : 'pending'}>
                {device.blocked ? 'Blocked' : device.active ? 'Active' : 'Inactive'}
              </span>

              <span className={isOnline(device.last_seen) ? 'good' : 'bad'}>
                {isOnline(device.last_seen) ? '🟢 Online' : '🔴 Offline'}
              </span>

              <span title={device.last_seen || ''}>
                {formatLastSeen(device.last_seen)}
              </span>

              <select
                value={device.playlist_id || ''}
                onChange={e => assignPlaylist(device.mac, e.target.value)}
              >
                <option value="">No Playlist</option>

                {playlists.map(playlist => (
                  <option key={playlist.id} value={playlist.id}>
                    #{playlist.id} - {playlist.name.slice(0, 12)}
                  </option>
                ))}
              </select>

              <span>
                {device.expire_at?.slice(0, 10)}
              </span>

              <div className="actions">
                {device.blocked ? (
                  <button
                    className="success-btn"
                    onClick={() => unblockDevice(device.mac)}
                  >
                    <Unlock size={14}/>
                    Unblock
                  </button>
                ) : (
                  <button
                    className="danger"
                    onClick={() => blockDevice(device.mac)}
                  >
                    <Ban size={14}/>
                    Block
                  </button>
                )}

                <button
                  className="delete-btn"
                  onClick={() => deleteDevice(device.mac)}
                >
                  <Trash2 size={14}/>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredDevices.length === 0 && (
          <p className="muted">No devices found.</p>
        )}
      </section>

      <section className="card wide-card">
        <h2>
          <Clock3 size={18}/>
          Recent Payments
        </h2>

        <div className="table payments-table recent-payments-table">
          <div className="table-head">
            <span>MAC</span>
            <span>Customer</span>
            <span>Email</span>
            <span>Amount</span>
            <span>Transaction</span>
            <span>PayPal Order</span>
            <span>Date</span>
          </div>

          {recentPayments.map(payment => (
            <div className="table-row" key={payment.id}>
              <b>{payment.mac}</b>
              <span>{payment.payer_name || '-'}</span>
              <span title={payment.payer_email || ''}>{payment.payer_email || '-'}</span>
              <span>{payment.price || '-'}</span>
              <span title={payment.transaction_id || ''}>
                {payment.transaction_id ? payment.transaction_id.slice(0, 12) : '-'}
              </span>
              <span title={payment.paypal_order_id || ''}>
                {payment.paypal_order_id ? payment.paypal_order_id.slice(0, 12) : '-'}
              </span>
              <span>{payment.created_at?.slice(0, 10) || '-'}</span>
            </div>
          ))}
        </div>

        {recentPayments.length === 0 && (
          <p className="muted">No recent payments yet.</p>
        )}
      </section>
    </main>
  );
}