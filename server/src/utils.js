export function nowISO() { return new Date().toISOString(); }

export function ttlForType(t) {
  switch (t) {
    case 'dps': return 120;    // 2h
    case 'dtp': return 180;    // 3h
    case 'short': return 30;   // 30m
    case 'dir': return 60;     // 1h
    case 'camera': return null; // permanent
    default: return 60;
  }
}

export function remainingSeconds(expires_at) {
  if (!expires_at) return null;
  const ms = new Date(expires_at).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / 1000));
}

export function isExpired(expires_at) {
  if (!expires_at) return false;
  return new Date(expires_at).getTime() <= Date.now();
}

export function addMinutes(dateISO, minutes) {
  const d = new Date(dateISO);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}
