import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Tv,
  Upload,
  ShieldCheck
} from 'lucide-react';
import './style.css';

const API = 'https://tx-hotplayer.onrender.com';

function App() {
  const [mac, setMac] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submitPlaylist(e) {
    e.preventDefault();

    setLoading(true);
    setMessage('');

    try {
      const check = await fetch(`${API}/device/${mac}`);
      const device = await check.json();

      if (!device.active) {
        setMessage('Device not activated.');
        setLoading(false);
        return;
      }

      const playlistRes = await fetch(`${API}/playlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: mac,
          type: 'm3u',
          server_url: m3uUrl
        })
      });

      const playlistData = await playlistRes.json();

      await fetch(`${API}/devices/assign-playlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mac,
          playlist_id: playlistData.playlist.id
        })
      });

      setMessage('Playlist linked successfully.');
      setM3uUrl('');

    } catch (error) {
      setMessage('Failed to save playlist.');
    }

    setLoading(false);
  }

  return (
    <main>
      <header>
        <h1><Tv /> TX HOTPLAYER</h1>
        <p>M3U Player Platform</p>
      </header>

      <section className="card">
        <h2><Upload size={18}/> Upload Playlist</h2>

        <form onSubmit={submitPlaylist}>
          <input
            placeholder="MAC Address"
            value={mac}
            onChange={e => setMac(e.target.value)}
          />

          <input
            placeholder="M3U URL"
            value={m3uUrl}
            onChange={e => setM3uUrl(e.target.value)}
          />

          <button disabled={loading}>
            {loading ? 'Saving...' : 'Save Playlist'}
          </button>
        </form>

        {message && (
          <p style={{ marginTop: 12 }}>
            {message}
          </p>
        )}
      </section>

      <section className="card">
        <h2><ShieldCheck size={18}/> Legal Notice</h2>

        <p>
          TX HOTPLAYER is a media player only.
        </p>

        <p>
          No channels or media content are included.
        </p>

        <p>
          Users must provide their own legal M3U playlist.
        </p>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);