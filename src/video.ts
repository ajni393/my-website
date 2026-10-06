export function videoSource(input: string) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Use a public HTTPS video link.');
  const host = url.hostname.replace(/^www\./, '');
  if (['youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) {
    const videoId = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)\/?$/)?.[1];
    if (!videoId || !/^[\w-]{11}$/.test(videoId)) throw new Error('Paste a YouTube video, Short, or livestream link, not a channel link.');
    return { platform: 'YouTube', embed: `https://www.youtube-nocookie.com/embed/${videoId}`, url: `https://www.youtube.com/watch?v=${videoId}` };
  }
  if (['facebook.com', 'm.facebook.com', 'fb.watch'].includes(host)) {
    const valid = host === 'fb.watch'
      ? /^\/[\w-]+\/?$/.test(url.pathname)
      : /\/videos\/(?:[^/]+\/)?\d+\/?$|^\/reel\/\d+\/?$|^\/share\/[vr]\/[\w-]+\/?$/.test(url.pathname) || (/^\/watch\/?$/.test(url.pathname) && /^\d+$/.test(url.searchParams.get('v') || ''));
    if (!valid) throw new Error('Paste a public Facebook video link, not a profile link.');
    return { platform: 'Facebook', embed: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.href)}&show_text=false`, url: url.href };
  }
  if (host === 'instagram.com') {
    const match = url.pathname.match(/^\/(p|reel|reels)\/([\w-]+)\/?$/);
    if (!match) throw new Error('Paste an Instagram post or Reel link.');
    const path = match[1] === 'p' ? 'p' : 'reel';
    return { platform: 'Instagram', embed: `https://www.instagram.com/${path}/${match[2]}/embed/`, url: url.href };
  }
  if (host === 'tiktok.com') {
    const videoId = url.pathname.match(/^\/@[\w.-]+\/video\/(\d+)\/?$/)?.[1];
    if (!videoId) throw new Error('Paste the full TikTok @username/video link, not a shortened share link.');
    return { platform: 'TikTok', embed: `https://www.tiktok.com/player/v1/${videoId}`, url: url.href };
  }
  throw new Error('Supported platforms: YouTube, Facebook, Instagram, and TikTok.');
}
