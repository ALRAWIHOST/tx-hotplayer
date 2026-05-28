import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Flame,
  Home,
  UploadCloud,
  ShieldCheck,
  Tv,
  Monitor,
  Smartphone,
  Mail,
  Trash2,
  CheckCircle
} from 'lucide-react';

import './style.css';

const API = 'https://tx-hotplayer-api.onrender.com';

function App() {
  const [mac, setMac] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [plan, setPlan] = useState('1-year');
  const [agreed, setAgreed] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function uploadPlaylist() {
    if (!mac || !playlistUrl) {
      setMessage('Please fill all fields.');
      return;
    }

    try {
      setLoading(true);
      setMessage('');

      const deviceCheck = await fetch(`${API}/device/${encodeURIComponent(mac)}`);
      const device = await deviceCheck.json();

      if (!device.active) {
        setMessage('Device not activated. Please request activation first.');
        setLoading(false);
        return;
      }

      const playlistRes = await fetch(`${API}/playlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: mac, type: 'm3u', server_url: playlistUrl })
      });

      const playlistData = await playlistRes.json();

      await fetch(`${API}/devices/assign-playlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac, playlist_id: playlistData.playlist.id })
      });

      setMessage('Playlist uploaded successfully.');
      setPlaylistUrl('');
    } catch {
      setMessage('Upload failed.');
    }

    setLoading(false);
  }

  async function deletePlaylist() {
    if (!mac) {
      setMessage('Enter MAC Address.');
      return;
    }

    try {
      setLoading(true);
      setMessage('');

      const res = await fetch(`${API}/devices/delete-playlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac })
      });

      const data = await res.json();

      if (data.success) {
        setMessage('Playlist deleted successfully.');
      } else {
        setMessage(data.message || 'Delete failed.');
      }
    } catch {
      setMessage('Delete failed.');
    }

    setLoading(false);
  }

  async function requestActivation() {
    if (!mac) {
      setMessage('Enter MAC Address.');
      return;
    }

    if (!agreed) {
      setMessage('Please confirm that TX HOTPLAYER is only a media player.');
      return;
    }

    const price = plan === 'forever' ? '$14.99' : '$5.99';

    try {
      setLoading(true);
      setMessage('');

      const res = await fetch(`${API}/activation-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac, plan, price })
      });

      const data = await res.json();

      if (data.success) {
        setMessage('Activation request sent. Admin will approve it after payment confirmation.');
      } else {
        setMessage(data.message || 'Activation request failed.');
      }
    } catch {
      setMessage('Activation request failed.');
    }

    setLoading(false);
  }

  return (
    <div className="portal">
      <header className="navbar">
        <div className="logo">
          <Flame />
          TX HOTPLAYER
        </div>

        <nav>
          <a href="#home"><Home size={15}/> Home</a>
          <a href="#upload"><UploadCloud size={15}/> Upload</a>
          <a href="#activation"><ShieldCheck size={15}/> Activation</a>
        </nav>

        <div className="contact">
          <Mail size={14}/>
          Contact
        </div>
      </header>

      <section className="hero" id="home">
        <div className="hero-left">
          <span className="badge">MEDIA PLAYER ONLY</span>

          <h1>
            Your best Media Player
            <strong>TX HOTPLAYER</strong>
          </h1>

          <p>
            Upload your own M3U playlist and enjoy IPTV streaming
            on Smart TVs, Android TVs and more.
          </p>
        </div>

        <div className="platforms">
          <div><Tv/> Smart TV</div>
          <div><Monitor/> WebOS</div>
          <div><Smartphone/> Android</div>
          <div>VIDAA</div>
          <div>Roku</div>
          <div>Fire TV</div>
        </div>
      </section>

      <section className="cards">
        <div className="card" id="upload">
          <div className="card-title">
            <UploadCloud size={18}/>
            Upload Playlist
          </div>

          <input
            placeholder="MAC Address"
            value={mac}
            onChange={e => setMac(e.target.value)}
          />

          <input
            placeholder="https://example.com/playlist.m3u"
            value={playlistUrl}
            onChange={e => setPlaylistUrl(e.target.value)}
          />

          <button onClick={uploadPlaylist} disabled={loading}>
            {loading ? 'Loading...' : 'Upload Playlist'}
          </button>
        </div>

        <div className="card">
          <div className="card-title">
            <Trash2 size={18}/>
            Delete Playlist
          </div>

          <input
            placeholder="MAC Address"
            value={mac}
            onChange={e => setMac(e.target.value)}
          />

          <button className="delete-btn" onClick={deletePlaylist} disabled={loading}>
            {loading ? 'Deleting...' : 'Delete Playlist'}
          </button>
        </div>

        <div className="card" id="activation">
          <div className="card-title">
            <ShieldCheck size={18}/>
            Activation Request
          </div>

          <input
            placeholder="MAC Address"
            value={mac}
            onChange={e => setMac(e.target.value)}
          />

          <select
            value={plan}
            onChange={e => setPlan(e.target.value)}
          >
            <option value="1-year">1 Year Activation - $5.99</option>
            <option value="forever">Forever Activation - $14.99</option>
          </select>

          <label className="agree">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
            />
            I understand this app is a media player only and no channels are provided.
          </label>

          <button onClick={requestActivation} disabled={loading}>
            {loading ? 'Sending...' : 'Submit Activation Request'}
          </button>
        </div>
      </section>

      {message && (
        <div className="message-box">
          <CheckCircle size={18}/>
          {message}
        </div>
      )}

      <footer className="footer">
        © 2026 TX HOTPLAYER — All rights reserved.
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);