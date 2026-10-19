'use client';
/* WVR Studio: the whole editor in one screen-at-a-time app, built for a phone
   first. Three layers, the same as the website: albums, the galleries inside
   each album, and the photos inside each gallery. Tap down through them; the
   back button always goes up one layer. Everything saves by itself; the site
   picks up published changes on its own. */
import { upload } from '@vercel/blob/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { newKey, prepare, slugify } from './images';

type Service = 'events' | 'products' | 'portraits';
interface Photo {
  key: string;
  url: string;
  thumb: string;
  w: number;
  h: number;
  alt: string;
  caption: string;
}
interface Gallery {
  slug: string;
  title: string;
  kind: string;
  album: string;
  service: Service;
  blurb: string;
  visible: boolean;
  cover: string;
  photos: Photo[];
  createdAt: string;
  updatedAt: string;
}
interface Album {
  slug: string;
  title: string;
  intro: string;
  cover: string;
}
interface Content {
  schema: 2;
  version: number;
  updatedAt: string;
  albums: Album[];
  galleries: Gallery[];
}

type View = { name: 'home' } | { name: 'album'; slug: string } | { name: 'gallery'; slug: string };
type SaveState = 'saved' | 'saving' | 'error' | 'conflict';
interface Job {
  id: string;
  slug: string;
  name: string;
  state: 'waiting' | 'preparing' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  file: File;
}

const SERVICE_LABEL: Record<Service, string> = { events: 'Events', products: 'Products', portraits: 'Portraits' };
const PARALLEL = 2;

function move<T>(list: T[], from: number, to: number) {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
  return next;
}

export default function AdminApp({ site }: { site: string }) {
  const [content, setContent] = useState<Content | null>(null);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<View>({ name: 'home' });
  const [save, setSave] = useState<SaveState>('saved');
  const [live, setLive] = useState<boolean | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [sheet, setSheet] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const contentRef = useRef<Content | null>(null);
  const etagRef = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inflight = useRef(false);
  const dirty = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<string>('');
  const dragKey = useRef<string | null>(null);
  const pubHash = useRef<string>('');

  /* ---------- load and save ---------- */

  const load = useCallback(async () => {
    setLoadError('');
    const r = await fetch('/api/content', { cache: 'no-store' });
    if (r.status === 401) return void (location.href = '/login');
    if (!r.ok) return setLoadError('Could not load your galleries. Check the connection and try again.');
    const j = await r.json();
    const c: Content = j.content ?? { schema: 2, version: 0, updatedAt: '', albums: [{ slug: 'work', title: 'Work', intro: '', cover: '' }], galleries: [] };
    contentRef.current = c;
    etagRef.current = j.etag;
    setContent(c);
    setSave('saved');
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flush = useCallback(async () => {
    if (inflight.current || !dirty.current || !contentRef.current) return;
    dirty.current = false;
    inflight.current = true;
    setSave('saving');
    try {
      const r = await fetch('/api/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: contentRef.current, etag: etagRef.current }),
      });
      if (r.status === 401) return void (location.href = '/login');
      if (r.status === 409) {
        setSave('conflict');
        return;
      }
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      etagRef.current = j.etag;
      if (contentRef.current) contentRef.current = { ...contentRef.current, version: j.content.version };
      if (j.publishedHash !== pubHash.current) {
        pubHash.current = j.publishedHash;
        setLive(false);
      }
      setSave(dirty.current ? 'saving' : 'saved');
    } catch {
      dirty.current = true;
      setSave('error');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = undefined;
        flush();
      }, 4000);
    } finally {
      inflight.current = false;
      if (dirty.current && !timer.current) flush();
    }
  }, []);

  const update = useCallback(
    (fn: (c: Content) => Content) => {
      if (!contentRef.current) return;
      const next = fn(contentRef.current);
      contentRef.current = next;
      setContent(next);
      dirty.current = true;
      setSave('saving');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = undefined;
        flush();
      }, 700);
    },
    [flush],
  );

  const updateGallery = useCallback(
    (slug: string, fn: (g: Gallery) => Gallery) =>
      update((c) => ({ ...c, galleries: c.galleries.map((g) => (g.slug === slug ? { ...fn(g), updatedAt: new Date().toISOString() } : g)) })),
    [update],
  );

  /* ---------- is the site up to date? ---------- */

  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const r = await fetch('/api/status', { cache: 'no-store' });
        if (r.ok && !stop) {
          const j = await r.json();
          pubHash.current = j.wantHash;
          setLive(j.live);
        }
      } catch {}
    }
    poll();
    const id = setInterval(poll, 30000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  /* ---------- uploads ---------- */

  const running = jobs.some((j) => j.state === 'waiting' || j.state === 'preparing' || j.state === 'uploading');

  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    addEventListener('beforeunload', warn);
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((l) => (lock = l), () => {});
    return () => {
      removeEventListener('beforeunload', warn);
      lock?.release().catch(() => {});
    };
  }, [running]);

  const setJob = (id: string, patch: Partial<Job>) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...patch } : j)));

  const queue = useRef<Job[]>([]);
  const active = useRef(0);

  const pump = useCallback(() => {
    while (active.current < PARALLEL && queue.current.length) {
      const job = queue.current.shift()!;
      active.current++;
      (async () => {
        try {
          setJob(job.id, { state: 'preparing' });
          const p = await prepare(job.file);
          const key = newKey();
          setJob(job.id, { state: 'uploading', progress: 0 });
          const full = await upload(`photos/${key}.jpg`, p.full, {
            access: 'public',
            handleUploadUrl: '/api/upload',
            contentType: 'image/jpeg',
            onUploadProgress: (e) => setJob(job.id, { progress: Math.round(e.percentage * 0.9) }),
          });
          const thumb = await upload(`photos/${key}-t.jpg`, p.thumb, { access: 'public', handleUploadUrl: '/api/upload', contentType: 'image/jpeg' });
          updateGallery(job.slug, (g) => ({
            ...g,
            cover: g.cover || key,
            photos: [...g.photos, { key, url: full.url, thumb: thumb.url, w: p.w, h: p.h, alt: '', caption: '' }],
          }));
          setJob(job.id, { state: 'done', progress: 100 });
          setTimeout(() => setJobs((js) => js.filter((j) => j.id !== job.id)), 1500);
        } catch (e) {
          setJob(job.id, { state: 'error', error: (e as Error).message || 'Upload failed' });
        } finally {
          active.current--;
          pump();
        }
      })();
    }
  }, [updateGallery]);

  const addFiles = useCallback(
    (slug: string, files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp|tiff?)$/i.test(f.name));
      if (!list.length) return;
      const made: Job[] = list.map((file, i) => ({ id: `${Date.now()}-${i}-${file.name}`, slug, name: file.name, state: 'waiting', progress: 0, file }));
      setJobs((js) => [...js, ...made]);
      queue.current.push(...made);
      pump();
    },
    [pump],
  );

  const retry = (job: Job) => {
    setJob(job.id, { state: 'waiting', error: undefined, progress: 0 });
    queue.current.push({ ...job, state: 'waiting' });
    pump();
  };

  const pickFor = (slug: string) => {
    uploadTarget.current = slug;
    fileInput.current?.click();
  };

  /* ---------- derived ---------- */

  const gallery = view.name === 'gallery' ? content?.galleries.find((g) => g.slug === view.slug) : undefined;
  const album = view.name === 'album' ? content?.albums.find((a) => a.slug === view.slug) : gallery ? content?.albums.find((a) => a.slug === gallery.album) : undefined;
  const sheetPhoto = gallery && sheet ? gallery.photos.find((p) => p.key === sheet) : undefined;
  const byAlbum = useMemo(() => {
    if (!content) return [];
    return content.albums.map((a) => {
      const galleries = content.galleries.filter((g) => g.album === a.slug);
      const photos = galleries.flatMap((g) => g.photos);
      const cover = photos.find((p) => p.key === a.cover) ?? galleries.map((g) => g.photos.find((p) => p.key === g.cover) ?? g.photos[0]).find(Boolean);
      return { album: a, galleries, photoCount: photos.length, cover, live: galleries.some((g) => g.visible && g.photos.length) };
    });
  }, [content]);

  useEffect(() => {
    setSelecting(false);
    setPicked(new Set());
    setSheet(null);
    window.scrollTo(0, 0);
  }, [view]);

  /* ---------- actions ---------- */

  function createAlbum(title: string, intro: string) {
    if (!contentRef.current) return '';
    const taken = new Set(contentRef.current.albums.map((a) => a.slug));
    const base = slugify(title);
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    update((c) => ({ ...c, albums: [...c.albums, { slug, title: title.trim(), intro: intro.trim(), cover: '' }] }));
    return slug;
  }

  function updateAlbum(slug: string, fn: (a: Album) => Album) {
    update((c) => ({ ...c, albums: c.albums.map((a) => (a.slug === slug ? fn(a) : a)) }));
  }

  function moveAlbum(slug: string, dir: -1 | 1) {
    update((c) => {
      const i = c.albums.findIndex((a) => a.slug === slug);
      if (i + dir < 0 || i + dir >= c.albums.length) return c;
      return { ...c, albums: move(c.albums, i, i + dir) };
    });
  }

  function deleteAlbum(slug: string) {
    const c = contentRef.current;
    if (!c || c.galleries.some((g) => g.album === slug) || c.albums.length === 1) return;
    if (!confirm('Delete this empty album?')) return;
    update((x) => ({ ...x, albums: x.albums.filter((a) => a.slug !== slug) }));
    setView({ name: 'home' });
  }

  function createGallery(title: string, albumSlug: string, service: Service) {
    if (!contentRef.current) return '';
    const taken = new Set(contentRef.current.galleries.map((g) => g.slug));
    const base = slugify(title);
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    const now = new Date().toISOString();
    update((c) => ({
      ...c,
      galleries: [{ slug, title: title.trim(), kind: '', album: albumSlug, service, blurb: '', visible: false, cover: '', photos: [], createdAt: now, updatedAt: now }, ...c.galleries],
    }));
    return slug;
  }

  function moveGallery(slug: string, dir: -1 | 1) {
    update((c) => {
      const i = c.galleries.findIndex((g) => g.slug === slug);
      const home = c.galleries[i].album;
      let j = i + dir;
      while (j >= 0 && j < c.galleries.length && c.galleries[j].album !== home) j += dir;
      if (j < 0 || j >= c.galleries.length) return c;
      return { ...c, galleries: move(c.galleries, i, j) };
    });
  }

  function deleteGallery(slug: string) {
    const g = contentRef.current?.galleries.find((x) => x.slug === slug);
    if (!g) return;
    if (!confirm(`Delete the gallery "${g.title}" and its ${g.photos.length} photos from the site? This cannot be undone here.`)) return;
    update((c) => ({ ...c, galleries: c.galleries.filter((x) => x.slug !== slug) }));
    setView({ name: 'album', slug: g.album });
  }

  function removePhotos(slug: string, keys: string[]) {
    if (!keys.length) return;
    if (!confirm(keys.length === 1 ? 'Remove this photo from the gallery?' : `Remove these ${keys.length} photos from the gallery?`)) return;
    const gone = new Set(keys);
    updateGallery(slug, (g) => {
      const photos = g.photos.filter((p) => !gone.has(p.key));
      return { ...g, photos, cover: gone.has(g.cover) ? photos[0]?.key ?? '' : g.cover };
    });
    setPicked(new Set());
    setSheet(null);
  }

  function movePhotosTo(from: string, to: string, keys: string[]) {
    if (!to || to === from || !keys.length) return;
    const set = new Set(keys);
    update((c) => {
      const src = c.galleries.find((g) => g.slug === from)!;
      const moving = src.photos.filter((p) => set.has(p.key));
      return {
        ...c,
        galleries: c.galleries.map((g) => {
          if (g.slug === from) {
            const photos = g.photos.filter((p) => !set.has(p.key));
            return { ...g, photos, cover: set.has(g.cover) ? photos[0]?.key ?? '' : g.cover };
          }
          if (g.slug === to) return { ...g, photos: [...g.photos, ...moving], cover: g.cover || moving[0]?.key || '' };
          return g;
        }),
      };
    });
    setPicked(new Set());
    setSelecting(false);
    setSheet(null);
  }

  function shiftPhoto(slug: string, key: string, dir: -1 | 1) {
    updateGallery(slug, (g) => {
      const i = g.photos.findIndex((p) => p.key === key);
      return { ...g, photos: move(g.photos, i, i + dir) };
    });
  }

  function dropPhoto(slug: string, target: string) {
    const key = dragKey.current;
    dragKey.current = null;
    if (!key || key === target) return;
    updateGallery(slug, (g) => {
      const from = g.photos.findIndex((p) => p.key === key);
      const to = g.photos.findIndex((p) => p.key === target);
      return { ...g, photos: move(g.photos, from, to) };
    });
  }

  /* ---------- render ---------- */

  if (loadError)
    return (
      <main className="center">
        <p>{loadError}</p>
        <button className="btn primary" onClick={load}>
          Try again
        </button>
      </main>
    );
  if (!content)
    return (
      <main className="center">
        <p className="muted">Loading your galleries…</p>
      </main>
    );

  const saveLabel = { saved: 'All changes saved', saving: 'Saving…', error: 'Not saved yet, retrying', conflict: 'Changed on another device' }[save];

  return (
    <div className="app">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files && uploadTarget.current) addFiles(uploadTarget.current, e.target.files);
          e.target.value = '';
        }}
      />

      <header className="top">
        <div className="top__row">
          {view.name === 'home' ? (
            <div className="brand">
              <img src="/badge.webp" width={41} height={32} alt="" />
              <span>WVR Studio</span>
            </div>
          ) : (
            <button className="back" onClick={() => setView(view.name === 'gallery' && album ? { name: 'album', slug: album.slug } : { name: 'home' })}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="back__label">{view.name === 'gallery' && album ? album.title : 'Albums'}</span>
            </button>
          )}
          <a
            className="top__site"
            href={gallery ? `${site}/portfolio-collections/${gallery.slug}/` : album ? `${site}/portfolio/${album.slug}/` : `${site}/portfolio/`}
            target="_blank"
            rel="noopener"
          >
            View site
          </a>
        </div>
        <div className="top__status" aria-live="polite">
          <span className={`dot dot--${save}`} />
          <span>{saveLabel}</span>
          {save === 'saved' && live !== null && <span className="muted">{live ? '· Website is up to date' : '· Website updates in 5 to 15 min'}</span>}
        </div>
      </header>

      {save === 'conflict' && (
        <div className="notice">
          <p>These galleries were changed on another device. Reload to get the latest, then make your change again.</p>
          <button className="btn primary small" onClick={load}>
            Reload
          </button>
        </div>
      )}

      {jobs.length > 0 && (
        <section className="jobs" aria-label="Uploads">
          <p className="jobs__head">
            {running ? `Uploading ${jobs.filter((j) => j.state !== 'done' && j.state !== 'error').length} of ${jobs.length}. Keep this screen open.` : jobs.some((j) => j.state === 'error') ? 'Some photos did not upload.' : 'Uploads finished.'}
          </p>
          <ul>
            {jobs
              .filter((j) => j.state !== 'done')
              .slice(0, 6)
              .map((j) => (
                <li key={j.id} className={`job job--${j.state}`}>
                  <span className="job__name">{j.name}</span>
                  {j.state === 'error' ? (
                    <span className="job__err">
                      {j.error}{' '}
                      <button className="link" onClick={() => retry(j)}>
                        Retry
                      </button>
                    </span>
                  ) : (
                    <span className="job__bar">
                      <span style={{ width: `${j.state === 'preparing' ? 4 : j.progress}%` }} />
                    </span>
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}

      {view.name === 'home' && (
        <main className="page">
          <div className="page__head">
            <h1>Albums</h1>
          </div>
          <p className="muted small">Albums hold galleries, and galleries hold photos. The website's Galleries menu follows the same order.</p>
          <ul className="rows">
            {byAlbum.map(({ album: a, galleries, photoCount, cover, live: on }, i) => (
              <li key={a.slug} className="row">
                <button className="row__main" onClick={() => setView({ name: 'album', slug: a.slug })}>
                  {cover ? <img src={cover.thumb} alt="" width={64} height={64} loading="lazy" /> : <span className="row__empty" />}
                  <span className="row__text">
                    <span className="row__title">{a.title}</span>
                    <span className="row__meta">
                      {galleries.length} {galleries.length === 1 ? 'gallery' : 'galleries'} · {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
                      {on ? '' : ' · Not on site'}
                    </span>
                  </span>
                  <Chevron />
                </button>
                <span className="row__order">
                  <button aria-label={`Move ${a.title} up`} disabled={i === 0} onClick={() => moveAlbum(a.slug, -1)}>
                    ▲
                  </button>
                  <button aria-label={`Move ${a.title} down`} disabled={i === byAlbum.length - 1} onClick={() => moveAlbum(a.slug, 1)}>
                    ▼
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <form className="signout" method="post" action="/api/logout">
            <button className="link muted" type="submit">
              Sign out
            </button>
          </form>
          <div className="dock">
            <button className="btn primary block" onClick={() => setCreatingAlbum(true)}>
              New album
            </button>
          </div>
        </main>
      )}

      {view.name === 'album' && !album && (
        <main className="page">
          <p>This album was deleted.</p>
        </main>
      )}

      {view.name === 'album' && album && (() => {
        const entry = byAlbum.find((b) => b.album.slug === album.slug)!;
        const galleries = entry.galleries;
        const coverChoices = galleries.flatMap((g) => (g.photos.length ? [{ key: g.photos.find((p) => p.key === g.cover)?.key ?? g.photos[0].key, label: g.title }] : []));
        return (
          <main className="page">
            <div className="page__head">
              <h1>{album.title}</h1>
            </div>
            <p className="crumbs small muted">Albums / {album.title}</p>
            <h2>
              {galleries.length} {galleries.length === 1 ? 'gallery' : 'galleries'}
            </h2>
            {galleries.length === 0 ? (
              <button className="empty" onClick={() => setCreating(true)}>
                <strong>Add the first gallery</strong>
                <span className="muted small">A gallery is one set of photos, like a single event or session.</span>
              </button>
            ) : (
              <ul className="rows">
                {galleries.map((g, i) => {
                  const cover = g.photos.find((p) => p.key === g.cover) ?? g.photos[0];
                  return (
                    <li key={g.slug} className="row">
                      <button className="row__main" onClick={() => setView({ name: 'gallery', slug: g.slug })}>
                        {cover ? <img src={cover.thumb} alt="" width={64} height={64} loading="lazy" /> : <span className="row__empty" />}
                        <span className="row__text">
                          <span className="row__title">{g.title}</span>
                          <span className="row__meta">
                            {g.photos.length} {g.photos.length === 1 ? 'photo' : 'photos'}
                            {g.visible ? '' : ' · Hidden'}
                          </span>
                        </span>
                        <Chevron />
                      </button>
                      <span className="row__order">
                        <button aria-label={`Move ${g.title} up`} disabled={i === 0} onClick={() => moveGallery(g.slug, -1)}>
                          ▲
                        </button>
                        <button aria-label={`Move ${g.title} down`} disabled={i === galleries.length - 1} onClick={() => moveGallery(g.slug, 1)}>
                          ▼
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            <section className="details">
              <h2>Album details</h2>
              <label>
                Album name
                <input value={album.title} maxLength={60} onChange={(e) => updateAlbum(album.slug, (a) => ({ ...a, title: e.target.value }))} />
              </label>
              <label>
                A line about this album <span className="muted">(optional, shown on the website)</span>
                <textarea rows={2} maxLength={300} value={album.intro} onChange={(e) => updateAlbum(album.slug, (a) => ({ ...a, intro: e.target.value }))} />
              </label>
              {coverChoices.length > 1 && (
                <label>
                  Cover photo
                  <select value={coverChoices.some((c) => c.key === album.cover) ? album.cover : ''} onChange={(e) => updateAlbum(album.slug, (a) => ({ ...a, cover: e.target.value }))}>
                    <option value="">The first gallery's cover</option>
                    {coverChoices.map((c) => (
                      <option key={c.key} value={c.key}>
                        The cover of {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="fine muted">
                Web address: {site.replace(/^https?:\/\//, '')}/portfolio/{album.slug}/
              </p>
              <button
                className="link danger"
                disabled={galleries.length > 0 || content.albums.length === 1}
                title={galleries.length > 0 ? 'Move or delete its galleries first' : undefined}
                onClick={() => deleteAlbum(album.slug)}
              >
                {galleries.length > 0 ? 'To delete this album, move or delete its galleries first' : 'Delete this album'}
              </button>
            </section>

            <div className="dock">
              <button className="btn primary block" onClick={() => setCreating(true)}>
                New gallery in this album
              </button>
            </div>
          </main>
        );
      })()}

      {view.name === 'gallery' && !gallery && (
        <main className="page">
          <p>This gallery was deleted.</p>
        </main>
      )}

      {view.name === 'gallery' && gallery && (
        <main
          className={`page${dragOver ? ' is-drop' : ''}`}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault();
              setDragOver(true);
            }
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            if (e.dataTransfer.files.length) {
              e.preventDefault();
              addFiles(gallery.slug, e.dataTransfer.files);
            }
            setDragOver(false);
          }}
        >
          <div className="page__head">
            <h1>{gallery.title}</h1>
          </div>

          <div className={`publish ${gallery.visible ? 'is-on' : ''}`}>
            <div>
              <p className="publish__title">{gallery.visible ? 'Showing on the website' : 'Hidden from the website'}</p>
              <p className="muted small">
                {gallery.visible ? 'New photos and edits go live on their own in 5 to 15 minutes.' : gallery.photos.length ? 'Ready when you are.' : 'Add photos, then publish.'}
              </p>
            </div>
            <button className={`btn ${gallery.visible ? 'ghost' : 'primary'} small`} disabled={!gallery.visible && gallery.photos.length === 0} onClick={() => updateGallery(gallery.slug, (g) => ({ ...g, visible: !g.visible }))}>
              {gallery.visible ? 'Hide' : 'Publish'}
            </button>
          </div>

          <div className="photos-head">
            <h2>
              {gallery.photos.length} {gallery.photos.length === 1 ? 'photo' : 'photos'}
            </h2>
            {gallery.photos.length > 0 && (
              <button
                className="link"
                onClick={() => {
                  setSelecting(!selecting);
                  setPicked(new Set());
                }}
              >
                {selecting ? 'Done' : 'Select'}
              </button>
            )}
          </div>

          {selecting && (
            <div className="selbar">
              <button className="link" onClick={() => setPicked(picked.size === gallery.photos.length ? new Set() : new Set(gallery.photos.map((p) => p.key)))}>
                {picked.size === gallery.photos.length ? 'Select none' : 'Select all'}
              </button>
              <span className="muted small">{picked.size} selected</span>
              <select
                aria-label="Move selected photos to another gallery"
                value=""
                disabled={!picked.size}
                onChange={(e) => movePhotosTo(gallery.slug, e.target.value, [...picked])}
              >
                <option value="">Move to…</option>
                <GalleryOptions albums={content.albums} galleries={content.galleries.filter((g) => g.slug !== gallery.slug)} />
              </select>
              <button className="btn danger small" disabled={!picked.size} onClick={() => removePhotos(gallery.slug, [...picked])}>
                Remove
              </button>
            </div>
          )}

          {gallery.photos.length === 0 ? (
            <button className="empty" onClick={() => pickFor(gallery.slug)}>
              <strong>Add photos</strong>
              <span className="muted small">Choose as many as you like. They upload in the background.</span>
            </button>
          ) : (
            <ul className="grid">
              {gallery.photos.map((p) => (
                <li
                  key={p.key}
                  draggable={!selecting}
                  onDragStart={() => (dragKey.current = p.key)}
                  onDragOver={(e) => dragKey.current && e.preventDefault()}
                  onDrop={(e) => {
                    if (dragKey.current) {
                      e.preventDefault();
                      e.stopPropagation();
                      dropPhoto(gallery.slug, p.key);
                    }
                  }}
                >
                  <button
                    className={`tile${picked.has(p.key) ? ' is-picked' : ''}`}
                    aria-pressed={selecting ? picked.has(p.key) : undefined}
                    aria-label={selecting ? `Select photo ${p.caption || p.key}` : `Edit photo ${p.caption || ''}`.trim()}
                    onClick={() => {
                      if (!selecting) return setSheet(p.key);
                      const next = new Set(picked);
                      if (next.has(p.key)) next.delete(p.key);
                      else next.add(p.key);
                      setPicked(next);
                    }}
                  >
                    <img src={p.thumb} alt="" loading="lazy" width={p.w > p.h ? 320 : 213} height={p.w > p.h ? 213 : 320} />
                    {gallery.cover === p.key && <span className="tile__badge">Cover</span>}
                    {p.caption && <span className="tile__cap">{p.caption}</span>}
                    {selecting && <span className="tile__check" aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <section className="details">
            <h2>Gallery details</h2>
            <label>
              Title
              <input value={gallery.title} maxLength={80} onChange={(e) => updateGallery(gallery.slug, (g) => ({ ...g, title: e.target.value }))} />
            </label>
            <div className="two">
              <label>
                Album
                <select value={gallery.album} onChange={(e) => updateGallery(gallery.slug, (g) => ({ ...g, album: e.target.value }))}>
                  {content.albums.map((a) => (
                    <option key={a.slug} value={a.slug}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Type of work
                <select value={gallery.service} onChange={(e) => updateGallery(gallery.slug, (g) => ({ ...g, service: e.target.value as Service }))}>
                  {(Object.keys(SERVICE_LABEL) as Service[]).map((s) => (
                    <option key={s} value={s}>
                      {SERVICE_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Short label <span className="muted">(optional, shown on the gallery card, like “Engagement session”)</span>
              <input value={gallery.kind} maxLength={60} onChange={(e) => updateGallery(gallery.slug, (g) => ({ ...g, kind: e.target.value }))} />
            </label>
            <label>
              A sentence or two about this shoot <span className="muted">(optional)</span>
              <textarea rows={3} maxLength={400} value={gallery.blurb} onChange={(e) => updateGallery(gallery.slug, (g) => ({ ...g, blurb: e.target.value }))} />
            </label>
            <p className="fine muted">
              Web address: {site.replace(/^https?:\/\//, '')}/portfolio-collections/{gallery.slug}/
            </p>
            <button className="link danger" onClick={() => deleteGallery(gallery.slug)}>
              Delete this gallery
            </button>
          </section>

          <div className="dock">
            <button className="btn primary block" onClick={() => pickFor(gallery.slug)}>
              Add photos
            </button>
          </div>
        </main>
      )}

      {creating && (
        <NewGallery
          albums={content.albums}
          defaultAlbum={album?.slug ?? content.albums[0]?.slug ?? ''}
          onCancel={() => setCreating(false)}
          onCreate={(title, albumSlug, service) => {
            const slug = createGallery(title, albumSlug, service);
            setCreating(false);
            setView({ name: 'gallery', slug });
            pickFor(slug);
          }}
        />
      )}

      {creatingAlbum && (
        <NewAlbum
          onCancel={() => setCreatingAlbum(false)}
          onCreate={(title, intro) => {
            const slug = createAlbum(title, intro);
            setCreatingAlbum(false);
            setView({ name: 'album', slug });
          }}
        />
      )}

      {gallery && sheetPhoto && (
        <PhotoSheet
          photo={sheetPhoto}
          index={gallery.photos.findIndex((p) => p.key === sheetPhoto.key)}
          count={gallery.photos.length}
          isCover={gallery.cover === sheetPhoto.key}
          others={content.galleries.filter((g) => g.slug !== gallery.slug)}
          albums={content.albums}
          onClose={() => setSheet(null)}
          onChange={(patch) => updateGallery(gallery.slug, (g) => ({ ...g, photos: g.photos.map((p) => (p.key === sheetPhoto.key ? { ...p, ...patch } : p)) }))}
          onCover={() => updateGallery(gallery.slug, (g) => ({ ...g, cover: sheetPhoto.key }))}
          onShift={(dir) => shiftPhoto(gallery.slug, sheetPhoto.key, dir)}
          onMoveTo={(to) => movePhotosTo(gallery.slug, to, [sheetPhoto.key])}
          onRemove={() => removePhotos(gallery.slug, [sheetPhoto.key])}
        />
      )}
    </div>
  );
}

function Chevron() {
  return (
    <svg className="row__chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GalleryOptions({ albums, galleries }: { albums: Album[]; galleries: Gallery[] }) {
  return (
    <>
      {albums.map((a) => {
        const inside = galleries.filter((g) => g.album === a.slug);
        if (!inside.length) return null;
        return (
          <optgroup key={a.slug} label={a.title}>
            {inside.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.title}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
}

function NewAlbum({ onCancel, onCreate }: { onCancel: () => void; onCreate: (title: string, intro: string) => void }) {
  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="sheet" onClose={onCancel} aria-labelledby="na-title">
      <form
        method="dialog"
        className="sheet__body"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) onCreate(title, intro);
        }}
      >
        <h2 id="na-title">New album</h2>
        <p className="muted small">An album holds galleries. For example an album called “Weddings” with a gallery for each couple, or “Smith wedding” with Ceremony, Reception and Portraits.</p>
        <label>
          Album name
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weddings" maxLength={60} required autoFocus />
        </label>
        <label>
          A line about it <span className="muted">(optional)</span>
          <input value={intro} onChange={(e) => setIntro(e.target.value)} maxLength={300} />
        </label>
        <div className="sheet__actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={!title.trim()}>
            Create album
          </button>
        </div>
      </form>
    </dialog>
  );
}

function NewGallery({ albums, defaultAlbum, onCancel, onCreate }: { albums: Album[]; defaultAlbum: string; onCancel: () => void; onCreate: (title: string, album: string, service: Service) => void }) {
  const [title, setTitle] = useState('');
  const [albumSlug, setAlbumSlug] = useState(defaultAlbum);
  const [service, setService] = useState<Service>('events');
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="sheet" onClose={onCancel} aria-labelledby="ng-title">
      <form
        method="dialog"
        className="sheet__body"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) onCreate(title, albumSlug, service);
        }}
      >
        <h2 id="ng-title">New gallery</h2>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Smith family session" maxLength={80} required autoFocus />
        </label>
        <div className="two">
          <label>
            Album
            <select value={albumSlug} onChange={(e) => setAlbumSlug(e.target.value)}>
              {albums.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Type of work
            <select value={service} onChange={(e) => setService(e.target.value as Service)}>
              {(Object.keys(SERVICE_LABEL) as Service[]).map((sv) => (
                <option key={sv} value={sv}>
                  {SERVICE_LABEL[sv]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted small">It starts hidden. Add photos, then tap Publish when it looks right.</p>
        <div className="sheet__actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={!title.trim()}>
            Create and add photos
          </button>
        </div>
      </form>
    </dialog>
  );
}

function PhotoSheet(props: {
  photo: Photo;
  index: number;
  count: number;
  isCover: boolean;
  others: Gallery[];
  albums: Album[];
  onClose: () => void;
  onChange: (patch: Partial<Photo>) => void;
  onCover: () => void;
  onShift: (dir: -1 | 1) => void;
  onMoveTo: (slug: string) => void;
  onRemove: () => void;
}) {
  const { photo, index, count, isCover, others } = props;
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="sheet" onClose={props.onClose} aria-label="Edit photo">
      <div className="sheet__body">
        <div className="sheet__photo">
          <img src={photo.thumb} alt="" width={photo.w > photo.h ? 640 : 427} height={photo.w > photo.h ? 427 : 640} />
        </div>
        <p className="muted small">
          Photo {index + 1} of {count}
          {isCover ? ' · Gallery cover' : ''}
        </p>
        <label>
          Caption <span className="muted">(optional, shown under the photo)</span>
          <input value={photo.caption} maxLength={200} onChange={(e) => props.onChange({ caption: e.target.value })} placeholder="e.g. First dance" />
        </label>
        <label>
          Describe the photo <span className="muted">(optional, read aloud to blind visitors and used by Google)</span>
          <textarea rows={2} maxLength={250} value={photo.alt} onChange={(e) => props.onChange({ alt: e.target.value })} placeholder="e.g. A bride and groom laughing under string lights" />
        </label>
        <div className="sheet__grid">
          <button className="btn ghost small" disabled={isCover} onClick={props.onCover}>
            {isCover ? 'This is the cover' : 'Make it the cover'}
          </button>
          <button className="btn ghost small" disabled={index === 0} onClick={() => props.onShift(-1)}>
            Move earlier
          </button>
          <button className="btn ghost small" disabled={index === count - 1} onClick={() => props.onShift(1)}>
            Move later
          </button>
          <select aria-label="Move to another gallery" value="" onChange={(e) => props.onMoveTo(e.target.value)} disabled={!others.length}>
            <option value="">Move to gallery…</option>
            <GalleryOptions albums={props.albums} galleries={others} />
          </select>
        </div>
        <div className="sheet__actions">
          <button className="link danger" onClick={props.onRemove}>
            Remove photo
          </button>
          <button className="btn primary" onClick={() => ref.current?.close()}>
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}
