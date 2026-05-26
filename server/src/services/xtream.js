export function xtreamApiUrl({ serverUrl, username, password, action }) {
  const base = serverUrl.replace(/\/$/, '');
  const params = new URLSearchParams({ username, password });
  if (action) params.set('action', action);
  return `${base}/player_api.php?${params.toString()}`;
}

export function liveUrl({ serverUrl, username, password, streamId }) {
  const base = serverUrl.replace(/\/$/, '');
  return `${base}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${streamId}.m3u8`;
}

export async function getXtreamLiveChannels(source) {
  const res = await fetch(xtreamApiUrl({ ...source, action: 'get_live_streams' }));
  if (!res.ok) throw new Error('Xtream server connection failed');
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Invalid Xtream response');
  return data.map((item) => ({
    id: String(item.stream_id),
    name: item.name || `Channel ${item.stream_id}`,
    logo: item.stream_icon || '',
    category: String(item.category_id || 'Live'),
    url: liveUrl({ ...source, streamId: item.stream_id })
  }));
}
