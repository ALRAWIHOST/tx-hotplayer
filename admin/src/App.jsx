import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Flame,
  UploadCloud,
  ShieldCheck,
  Home,
  Tag,
  Star,
  Search,
  Lock,
  List,
  Mail,
  Monitor,
  Smartphone,
  Tv
} from 'lucide-react';

import './style.css';

const API = 'https://tx-hotplayer-api.onrender.com';

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
      const check = await fetch(`${API}/device/${encodeURIComponent(mac)}`);
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
    } catch {
      setMessage('Failed to save playlist.');
    }

    setLoading(false);
  }

  return (
    <div className="page">
      <header className="navbar">
        <div className="brand">
          <Flame />
          <span>TX</span> HOTPLAYER
        </div>

        <nav>
          <a href="#home"><Home size={16}/> Home</a>
          <a href="#upload"><UploadCloud size={16}/> Upload List</a>
          <a href="#pricing"><Tag size={16}/> Activation</a>
        </nav>

        <div className="nav-actions">
          <span>Reseller</span>
          <span><Mail size={14}/> Contact-Us</span>
          <b>FR</b>
        </div>
      </header>

      <section id="home" className="hero">
        <div className="hero-text">
          <span className="badge">MEDIA PLAYER, NO CHANNELS INCLUDED</span>

          <h1>
            Your best Media Player
            <strong>TX HOTPLAYER</strong>
          </h1>

          <p>
            Experience the ultimate entertainment with TX HOTPLAYER, your media
            player for enjoying playlists and watching your favorite content.
          </p>

          <p>
            Download and activate the app, then upload your own legal M3U
            playlist using your MAC address.
          </p>

          <div className="notice">
            No channels are included in the application. TX HOTPLAYER is not
            responsible for content uploaded by users.
          </div>
        </div>

        <div className="platforms">
          <h3>AVAILABLE IN</h3>

          <div className="platform-grid">
            <div><Tv/> Smart TV</div>
            <div><Monitor/> Web OS</div>
            <div><Smartphone/> Android</div>
            <div>Fire TV Stick</div>
            <div>VIDAA</div>
            <div>Roku</div>
            <div>Microsoft</div>
            <div>App Store</div>
          </div>
        </div>
            <section className="disclaimer">
              <h2>DISCLAIMER</h2>

              <div className="disclaimer-grid">
                <div>
                  <p>
                    We do not provide IPTV subscriptions or copyrighted content.
                  </p>

                  <p>
                    TX HOTPLAYER is only a media player application.
                  </p>

                  <p>
                    Users are required to upload their own playlists.
                  </p>
                </div>

                <div>
                  <p>• No channels included</p>
                  <p>• No third-party affiliation</p>
                  <p>• Legal M3U playlists only</p>
                  <p>• Media player application only</p>
                </div>
              </div>
            </section>

            <section className="features">
              <h2>Features</h2>

              <div className="feature-grid">
                <div><Star/> Favorite list</div>
                <div><Search/> Search channels</div>
                <div><List/> Multi playlist</div>
                <div><Lock/> Lock MAC</div>
                <div><ShieldCheck/> Device activation</div>
                <div><Tv/> Smart TV support</div>
              </div>
            </section>

            <section id="upload" className="upload-box">
              <h2>
                <UploadCloud/>
                Upload Playlist
              </h2>

              <form onSubmit={submitPlaylist}>
                <input
                  placeholder="MAC Address"
                  value={mac}
                  onChange={e => setMac(e.target.value)}
                />

                <input
                  placeholder="M3U Playlist URL"
                  value={m3uUrl}
                  onChange={e => setM3uUrl(e.target.value)}
                />

                <button disabled={loading}>
                  {loading ? 'Saving...' : 'Save Playlist'}
                </button>
              </form>

              {message && (
                <div className="message">
                  {message}
                </div>
              )}
            </section>

            <section id="pricing" className="pricing">
              <h2>Pricing plans</h2>

              <div className="pricing-grid">
                <div className="price-card popular">
                  <span>MOST POPULAR</span>

                  <h3>1 Year</h3>

                  <h1>$5.99</h1>

                  <button>Activate 1 Year</button>
                </div>

                <div className="price-card">
                  <h3>Forever</h3>

                  <h1>$14.99</h1>

                  <button>Activate Forever</button>
                </div>
              </div>
            </section>

            <footer className="footer">
              <div>
                <h2>Become a Reseller</h2>
                <p>Discover reseller packs with exceptional discounts.</p>
              </div>

              <button>Discover our packs</button>
            </footer>
          </div>
        );
      }

      createRoot(document.getElementById('root')).render(<App />);