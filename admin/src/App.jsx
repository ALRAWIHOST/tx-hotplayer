import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
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
const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID;

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
        setMessage('Device not activated. Please pay activation first.');
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
      setMessage(data.success ? 'Playlist deleted successfully.' : data.message || 'Delete failed.');
    } catch {
      setMessage('Delete failed.');
    }

    setLoading(false);
  }

  return (
    <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: 'USD' }}>
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
              Upload your own M3U playlist and enjoy IPTV streaming on Smart TVs,
              Android TVs and more.
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
              Pay & Activate MAC
            </div>

            <input
              placeholder="MAC Address"
              value={mac}
              onChange={e => setMac(e.target.value)}
            />

            <select value={plan} onChange={e => setPlan(e.target.value)}>
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

            {agreed && mac ? (
              <PayPalButtons
                style={{ layout: 'vertical', shape: 'rect' }}
                createOrder={async () => {
                  const res = await fetch(`${API}/paypal/create-order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mac, plan })
                  });

                  const data = await res.json();

                  if (!data.success) {
                    throw new Error('PayPal order failed');
                  }

                  return data.orderID;
                }}
                onApprove={async data => {
                  const res = await fetch(`${API}/paypal/capture-order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      orderID: data.orderID,
                      mac,
                      plan
                    })
                  });

                  const result = await res.json();

                  if (result.success) {
                    setMessage('Payment successful. MAC activated automatically.');
                  } else {
                    setMessage('Payment captured but activation failed.');
                  }
                }}
                onError={() => {
                  setMessage('PayPal payment failed.');
                }}
              />
            ) : (
              <button disabled>
                Enter MAC and accept terms first
              </button>
            )}
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
    </PayPalScriptProvider>
  );
}

createRoot(document.getElementById('root')).render(<App />);