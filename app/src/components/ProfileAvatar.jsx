import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../utils/cn';
import { useAuth } from '../context/AuthContext';

// ── initials (v4.9 / C6) ────────────────────────────────────────────────────────────────────────────────────────
// First letter of the first + last word of the name, upper-case ("Rakesh Joshi" -> RJ, "Board Viewer" -> BV, "Admin" -> A, "mehul" -> M).
export function initialsOf(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const first = [...words[0]][0] ?? '';
  const last = words.length > 1 ? ([...words[words.length - 1]][0] ?? '') : '';
  return (first + last).toLocaleUpperCase() || '?';
}
// A deterministic tint 1..6 from the name (djb2) — the six categorical accent tokens --cat-1..6; the same name is the same colour everywhere, on every render.
export function tintOf(name) {
  const str = String(name ?? '').trim().toLowerCase(); let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (Math.abs(h) % 6) + 1;
}
/** The no-photo face: initials on a tint of a categorical accent token (.avatar-initials in index.css). Text colour is derived for >= 4.5:1 in both themes. */
export function InitialsAvatar({ name, size = 28, className }) {
  return (
    <span data-testid="avatar-initials" data-tint={tintOf(name)} title={name} aria-hidden="true" className={cn('avatar-initials', className)}
      style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.4)) }}>{initialsOf(name)}</span>
  );
}

const STORAGE_KEY = 'pucho.profilePhoto';
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const EVENT = 'pucho:profile-photo-changed';

export function getStoredPhoto() {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

/**
 * Profile picture with click-to-change.
 * Clicking the avatar opens the file picker; the chosen image is stored locally
 * (base64 in localStorage) and every mounted avatar updates instantly.
 */
export default function ProfileAvatar({ name: nameProp, size = 28, className = '', editable = true }) {
  // No `name` given -> the signed-in person (the sidebar foot and the settings page pass none)
  let authName; try { authName = useAuth()?.user?.name; } catch { authName = undefined; }   // useContext every render; the throw is only 'no provider'
  const name = nameProp ?? authName ?? 'Admin';
  const inputRef = useRef(null);
  const [photo, setPhoto] = useState(() => getStoredPhoto());

  // Keep every avatar on the page in sync (this tab + other tabs)
  useEffect(() => {
    const sync = () => setPhoto(getStoredPhoto());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const broadcast = useCallback(() => window.dispatchEvent(new Event(EVENT)), []);

  function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Image must be under 2 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        localStorage.setItem(STORAGE_KEY, reader.result);
        setPhoto(reader.result);
        broadcast();
        toast.success('Profile photo updated');
      } catch {
        toast.error('Could not save photo — storage is full');
      }
    };
    reader.onerror = () => toast.error('Could not read that image');
    reader.readAsDataURL(file);
  }

  function removePhoto(e) {
    e.stopPropagation();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setPhoto(null);
    broadcast();
    toast.success('Profile photo removed');
  }

  // No remote avatar service: an uploaded photo, otherwise initials (offline, consistent, no third-party call).
  const src = photo;
  const iconSize = Math.max(12, Math.round(size * 0.34));
  const face = src ? <img src={src} alt={name} className="w-full h-full object-cover bg-surface" /> : <InitialsAvatar name={name} size={size} className="w-full h-full" />;

  if (!editable) {
    return src
      ? <img src={src} alt={name} style={{ width: size, height: size }} className={cn('rounded-full object-cover flex-shrink-0 bg-surface', className)} />
      : <InitialsAvatar name={name} size={size} className={className} />;
  }

  return (
    <div className="relative group/avatar flex-shrink-0" style={{ width: size, height: size }}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); inputRef.current?.click(); }}
        title="Change profile photo"
        aria-label="Change profile photo"
        className={cn(
          'no-pill relative block rounded-full overflow-hidden ring-0 hover:ring-2 hover:ring-[color:var(--line-strong)]',
          'transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]',
          className
        )}
        style={{ width: size, height: size }}
      >
        {face}
        <span className="absolute inset-0 flex items-center justify-center avatar-photo-wash opacity-0 group-hover/avatar:opacity-100 transition-opacity">
          <Camera style={{ width: iconSize, height: iconSize }} className="text-white" />
        </span>
      </button>

      {photo && size >= 56 && (
        <button
          type="button"
          onClick={removePhoto}
          title="Remove photo"
          aria-label="Remove profile photo"
          className="no-pill absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-surface border border-[color:var(--line-strong)] shadow flex items-center justify-center text-ink-3 hover:text-bad-text hover:border-[color:var(--bad-edge)] transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
