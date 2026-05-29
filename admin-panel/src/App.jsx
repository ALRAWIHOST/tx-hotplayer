import { useEffect, useMemo, useState } from 'react';
import {
  Monitor,
  Shield,
  RefreshCcw,
  Ban,
  Search,
  CheckCircle,
  XCircle,
  Database,
  Trash2,
  Unlock,
  Clock3,
  DollarSign,
  Menu,
  Home,
  List,
  Settings,
  FileText,
  LogOut,
  Bell,
  User,
  Calendar,
  Send,
  Wifi,
  Edit,
  Download,
  Filter,
  Package
} from 'lucide-react';

import './App.css';

const API = 'https://tx-hotplayer-api.onrender.com';
const ONLINE_MINUTES = 5;

function isOnline(lastSeen) {
  if (!lastSeen) return false;
  const time = new Date(lastSeen).getTime();
  if (Number.isNaN(time)) return false;
  return (Date.now() - time) / 60000 < ONLINE_MINUTES;
}

function formatLastSeen(lastSeen) {
  if (!lastSeen) return '-';
  const time = new Date(lastSeen);
  if (Number.isNaN(time.getTime())) return '-';
  return time.toLocaleString();
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

  const approvedPayments = requests.filter(r => r.status === 'approved');

  const stats = useMemo(() => {
    const revenue = approvedPayments.reduce((sum, r) => {
      const value = Number(String(r.price || '0').replace('$', ''));
      return sum + (Number.isNaN(value) ? 0 : value);
    }, 0);

    return {
      total: devices.length,
      active: devices.filter(d => d.active && !d.blocked).length,
      online: devices.filter(d => isOnline(d.last_seen)).length,
      blocked: devices.filter(d => d.blocked).length,
      withPlaylist: devices.filter(d => d.playlist_id).length,
      paidActivations: approvedPayments.length,
      revenue: revenue.toFixed(2)
    };
  }, [devices, requests]);

  const filteredDevices = devices.filter(d =>
    d.mac.toLowerCase().includes(query.toLowerCase())
  );

  const recentPayments = approvedPayments.slice(0, 10);

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <Shield size={42}/>
          <div>
            <b>TX HOTPLAYER</b>
            <span>Admin</span>
          </div>
        </div>

        <nav className="side-nav">
          <a className="active"><Home size={20}/> Dashboard</a>
          <a><Monitor size={20}/> Devices</a>
          <a><List size={20}/> Playlists</a>
          <a><DollarSign size={20}/> Payments</a>
          <a><Package size={20}/> Activations</a>
          <a><Settings size={20}/> Settings</a>
          <a><FileText size={20}/> Logs</a>
        </nav>

        <div className="revenue-box">
          <span>Total Revenue</span>
          <b>${stats.revenue}</b>
          <small>This Month <em>0% ▲</em></small>
        </div>

        <button className="logout-btn">
          <LogOut size={18}/>
          Log Out
        </button>
      </aside>

      <main className="dashboard">
        <header className="dashboard-header">
          <div>
            <div className="title-row">
              <Menu size={25}/>
              <h1>Dashboard</h1>
            </div>
            <p>Welcome back! Here's what's happening with your service.</p>
          </div>

          <div className="header-actions">
            <div className="top-search">
              <input
                placeholder="Search MAC address..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <Search size={18}/>
            </div>

            <div className="bell">
              <Bell size={20}/>
              <span>2</span>
            </div>

            <div className="admin-user">
              <div>A</div>
              <span>Admin</span>
            </div>
          </div>
        </header>

        <div className="refresh-row">
          <button onClick={refreshAll}>
            <RefreshCcw size={18}/>
            Refresh Data
          </button>
        </div>

        <section className="stats-grid">
          <div className="stat-card blue">
            <Monitor />
            <div>
              <span>Total Devices</span>
              <b>{stats.total}</b>
              <small>All registered devices</small>
            </div>
          </div>

          <div className="stat-card green">
            <CheckCircle />
            <div>
              <span>Active Devices</span>
              <b>{stats.active}</b>
              <small>Currently active</small>
            </div>
          </div>

          <div className="stat-card orange">
            <Wifi />
            <div>
              <span>Online Devices</span>
              <b>{stats.online}</b>
              <small>Online in last 5 minutes</small>
            </div>
          </div>

          <div className="stat-card red">
            <XCircle />
            <div>
              <span>Blocked Devices</span>
              <b>{stats.blocked}</b>
              <small>Blocked devices</small>
            </div>
          </div>

          <div className="stat-card blue">
            <DollarSign />
            <div>
              <span>Revenue</span>
              <b>${stats.revenue}</b>
              <small>Total paid</small>
            </div>
          </div>
        </section>

        <section className="top-panels">
          <div className="panel activate-panel">
            <h2>
              <Monitor size={20}/>
              Activate New Device
            </h2>

            <form onSubmit={activateDevice}>
              <div className="input-wrap">
                <Monitor size={18}/>
                <input
                  placeholder="MAC Address (e.g. TX:75:C8:87:CB)"
                  value={mac}
                  onChange={e => setMac(e.target.value)}
                />
              </div>

              <div className="input-wrap">
                <Calendar size={18}/>
                <input
                  type="date"
                  value={expireAt}
                  onChange={e => setExpireAt(e.target.value)}
                />
              </div>

              <button className="primary-orange">
                <Send size={18}/>
                Activate Device
              </button>
            </form>
          </div>

          <div className="panel">
            <h2>
              <Clock3 size={20}/>
              Quick Overview
            </h2>

            <div className="overview-grid">
              <div>
                <Database/>
                <span>Playlists Loaded</span>
                <b>{playlists.length}</b>
              </div>

              <div>
                <DollarSign/>
                <span>Paid Activations</span>
                <b>{stats.paidActivations}</b>
              </div>

              <div>
                <Monitor/>
                <span>Total Devices</span>
                <b>{stats.total}</b>
              </div>

              <div>
                <Wifi/>
                <span>Online Devices</span>
                <b>{stats.online}</b>
              </div>
            </div>
          </div>
        </section>

        <section className="panel table-panel">
          <div className="panel-head">
            <h2>
              <Monitor size={21}/>
              Devices ({loading ? '...' : filteredDevices.length})
            </h2>

            <div className="table-tools">
              <div className="top-search small">
                <input
                  placeholder="Search by MAC..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
                <Search size={17}/>
              </div>

              <button className="ghost-btn">
                <Filter size={17}/>
                Filter
              </button>

              <button className="blue-btn">
                <Download size={17}/>
                Export
              </button>
            </div>
          </div>

          <div className="modern-table devices-table">
            <div className="modern-head">
              <span>MAC Address</span>
              <span>Status</span>
              <span>Expires</span>
              <span>Playlist</span>
              <span>Online</span>
              <span>Last Seen</span>
              <span>Actions</span>
            </div>

            {filteredDevices.map(device => (
              <div className="modern-row" key={device.id}>
                <b>{device.mac}</b>

                <span className={device.blocked ? 'pill red-pill' : device.active ? 'pill green-pill' : 'pill orange-pill'}>
                  {device.blocked ? 'Blocked' : device.active ? 'Active' : 'Inactive'}
                </span>

                <span>{device.expire_at?.slice(0, 10) || '-'}</span>

                <select
                  value={device.playlist_id || ''}
                  onChange={e => assignPlaylist(device.mac, e.target.value)}
                >
                  <option value="">No Playlist</option>
                  {playlists.map(playlist => (
                    <option key={playlist.id} value={playlist.id}>
                      #{playlist.id} - {playlist.name.slice(0, 14)}
                    </option>
                  ))}
                </select>

                <span className={isOnline(device.last_seen) ? 'online-dot' : 'offline-dot'}>
                  {isOnline(device.last_seen) ? 'Online' : 'Offline'}
                </span>

                <span>{formatLastSeen(device.last_seen)}</span>

                <div className="action-icons">
                  {device.blocked ? (
                    <button className="icon-btn blue" onClick={() => unblockDevice(device.mac)}>
                      <Unlock size={17}/>
                    </button>
                  ) : (
                    <button className="icon-btn orange" onClick={() => blockDevice(device.mac)}>
                      <Ban size={17}/>
                    </button>
                  )}

                  <button className="icon-btn blue">
                    <Edit size={17}/>
                  </button>

                  <button className="icon-btn red" onClick={() => deleteDevice(device.mac)}>
                    <Trash2 size={17}/>
                  </button>
                </div>
              </div>
            ))}

            {filteredDevices.length === 0 && (
              <p className="empty">No devices found.</p>
            )}
          </div>

          <div className="table-footer">
            <span>Showing {filteredDevices.length} of {devices.length} devices</span>
            <div>
              <button className="page-btn">‹</button>
              <button className="page-btn active">1</button>
              <button className="page-btn">›</button>
            </div>
          </div>
        </section>

        <section className="panel table-panel">
          <h2>
            <DollarSign size={21}/>
            Recent Payments
          </h2>

          <div className="modern-table payments-modern-table">
            <div className="modern-head">
              <span>MAC</span>
              <span>Customer</span>
              <span>Email</span>
              <span>Amount</span>
              <span>Transaction</span>
              <span>PayPal Order</span>
              <span>Date</span>
            </div>

            {recentPayments.map(payment => (
              <div className="modern-row" key={payment.id}>
                <b>{payment.mac}</b>
                <span>{payment.payer_name || '-'}</span>
                <span>{payment.payer_email || '-'}</span>
                <span>{payment.price || '-'}</span>
                <span>{payment.transaction_id ? payment.transaction_id.slice(0, 12) : '-'}</span>
                <span>{payment.paypal_order_id ? payment.paypal_order_id.slice(0, 12) : '-'}</span>
                <span>{payment.created_at?.slice(0, 10) || '-'}</span>
              </div>
            ))}

            {recentPayments.length === 0 && (
              <div className="empty-payments">
                <Package size={28}/>
                <b>No recent payments yet.</b>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}