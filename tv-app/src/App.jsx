import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Hls from 'hls.js';
import {
  AlertCircle,
  Play,
  RefreshCcw,
  Search,
  Tv,
  Star
} from 'lucide-react';

import './style.css';

const API = import.meta.env.VITE_API_URL || 'https://tx-hotplayer-api.onrender.com';
function getDeviceMac() {
  let id = localStorage.getItem('tx_device_mac');

  if (!id) {
    const random = Math.random().toString(16).slice(2, 10).toUpperCase();
    id = `TX:${random.match(/.{1,2}/g).join(':')}`;
    localStorage.setItem('tx_device_mac', id);
  }

  return id;
}

function App() {
  const videoRef = useRef(null);

  const [mac] = useState(getDeviceMac());
  const [status, setStatus] = useState('pending');
  const [channels, setChannels] = useState([]);
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState('');
  const [message, setMessage] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');

  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('favorites') || '[]');
    } catch {
      return [];
    }
  });

  function toggleFavorite(channelId) {
    const updated = favorites.includes(channelId)
      ? favorites.filter(id => id !== channelId)
      : [...favorites, channelId];

    setFavorites(updated);
    localStorage.setItem('favorites', JSON.stringify(updated));
  }

  const categories = useMemo(() => {
    const counts = {};

    channels.forEach(channel => {
      const group = channel.group || 'Live';
      counts[group] = (counts[group] || 0) + 1;
    });

    return [
      { name: 'All', count: channels.length },
      {
        name: 'Favorites',
        count: channels.filter(c => favorites.includes(c.id)).length
      },
      ...Object.entries(counts).map(([name, count]) => ({ name, count }))
    ];
  }, [channels, favorites]);

  const filtered = useMemo(
    () =>
      channels.filter(c => {
        const matchesSearch = (c.name || '')
          .toLowerCase()
          .includes(q.toLowerCase());

        const matchesCategory =
          activeCategory === 'All'
            ? true
            : activeCategory === 'Favorites'
            ? favorites.includes(c.id)
            : c.group === activeCategory;

        return matchesSearch && matchesCategory;
      }),
    [channels, q, activeCategory, favorites]
  );

  async function load() {
    try {
      setLoading(true);

      const deviceRes = await fetch(`${API}/device/${encodeURIComponent(mac)}`);
      const deviceData = await deviceRes.json();

      setMessage(deviceData.message || '');
      setPlaylistName(deviceData.playlist?.name || '');

      if (!deviceData.active) {
        setStatus('pending');
        setChannels([]);
        setSelected(null);
        return;
      }

      const playlistRes = await fetch(`${API}/m3u/${encodeURIComponent(mac)}`);
      const playlistData = await playlistRes.json();

      if (!playlistData.success) {
        setStatus('error');
        setMessage(playlistData.message || playlistData.error || 'Failed to load playlist');
        setChannels([]);
        setSelected(null);
        return;
      }

      const list = playlistData.channels || [];

      const mapped = list
        .map((c, index) => ({
          id: c.id || index + 1,
          name: c.name || 'Unknown Channel',
          logo: c.logo || '',
          group: c.group || 'Live',
          url: c.url || c.stream_url || ''
        }))
        .filter(c => c.url);

      setPlaylistName(playlistData.playlist?.name || deviceData.playlist?.name || '');
      setChannels(mapped);

      const lastChannelId = localStorage.getItem('last_channel');
      const lastChannel = mapped.find(
        c => String(c.id) === String(lastChannelId)
      );

      setSelected(lastChannel || mapped[0] || null);
      setStatus('active');
    } catch (e) {
      setStatus('error');
      setMessage(e.message || 'Connection error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (selected) {
      localStorage.setItem('last_channel', selected.id);
    }
  }, [selected]);

  useEffect(() => {
    if (!selected || !videoRef.current) return;

    const video = videoRef.current;

    video.pause();
    video.removeAttribute('src');
    video.load();

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 8
      });

      hls.loadSource(selected.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            hls.destroy();
          }
        }
      });

      return () => {
        hls.destroy();
      };
    }

    video.src = selected.url;
    video.play().catch(() => {});
  }, [selected]);
  if (loading) {
    return (
      <div className="activation">
        <h1>🔥 TX HOTPLAYER</h1>
        <p>Loading playlist...</p>
      </div>
    );
  }

  if (status !== 'active') {
    return (
      <div className="activation">
        <h1>🔥 TX HOTPLAYER</h1>
        <AlertCircle size={70} />
        <h2>Your MAC is not associated with any playlist</h2>

        <p>Please add your M3U playlist from the user portal</p>

        <div className="mac">{mac}</div>

        <button onClick={load}>
          <RefreshCcw /> Refresh
        </button>

        <small>{message}</small>

        <p className="note">
          Media player only. No channels are included.
        </p>
      </div>
    );
  }

  return (
    <div className="app">
      <aside>
        <h1>
          <Tv /> TX HOTPLAYER
        </h1>

        <p className="note">
          {playlistName} · {channels.length} channels
        </p>

        <button onClick={load}>
          <RefreshCcw size={16} /> Refresh
        </button>

        <div className="search">
          <Search size={20} />

          <input
            placeholder="Search channels"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>

        <div className="categories">
          {categories.map(category => (
            <button
              key={category.name}
              className={activeCategory === category.name ? 'active' : ''}
              onClick={() => {
                setActiveCategory(category.name);

                const first = channels.find(c =>
                  category.name === 'All'
                    ? true
                    : category.name === 'Favorites'
                    ? favorites.includes(c.id)
                    : c.group === category.name
                );

                if (first) setSelected(first);
              }}
            >
              {category.name}
              <small>{category.count}</small>
            </button>
          ))}
        </div>

        <div className="list">
          {filtered.map(c => (
            <button
              className={selected?.id === c.id ? 'active' : ''}
              key={c.id}
              onClick={() => setSelected(c)}
            >
              <img
                src={c.logo || 'https://placehold.co/100x100?text=TV'}
              />

              <span>
                {c.name}
                <small>{c.group}</small>
              </span>

              <Star
                size={18}
                fill={favorites.includes(c.id) ? 'gold' : 'transparent'}
                color={favorites.includes(c.id) ? 'gold' : 'white'}
                onClick={e => {
                  e.stopPropagation();
                  toggleFavorite(c.id);
                }}
              />
            </button>
          ))}
        </div>
      </aside>

      <main>
        {selected ? (
          <>
            <video
              ref={videoRef}
              controls
              autoPlay
              playsInline
            />

            <div className="now">
              <Play /> {selected.name}
            </div>
          </>
        ) : (
          <p>No channel selected</p>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);