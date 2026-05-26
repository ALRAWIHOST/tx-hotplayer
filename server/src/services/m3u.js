export function parseM3U(text = '') {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const channels = [];

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('#EXTINF')) continue;
    const info = lines[i];
    const url = lines[i + 1] || '';
    const name = info.split(',').pop()?.trim() || 'Unnamed Channel';
    const logo = info.match(/tvg-logo="([^"]+)"/)?.[1] || '';
    const group = info.match(/group-title="([^"]+)"/)?.[1] || 'Uncategorized';
    if (url && !url.startsWith('#')) channels.push({ id: String(channels.length + 1), name, logo, category: group, url });
  }

  return channels;
}
