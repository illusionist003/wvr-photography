'use client';
/* WVR Studio: the whole editor in one screen-at-a-time app, built for a phone
   first. Galleries grouped by section; tap one to add photos, caption them,
   pick a cover, reorder, or move them to another gallery. Everything saves by
   itself; the site picks up published changes on its own. */
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
  section: string;
  service: Service;
  blurb: string;
  visible: boolean;
  cover: string;
  photos: Photo[];
  createdAt: string;
  updatedAt: string;
}
interface Section {
  id: string;
  title: string;
  intro: string;
}
interface Content {
  schema: 1;
  version: number;
  updatedAt: string;
  sections: Section[];
  galleries: Gallery[];
}

type View = { name: 'home' } | { name: 'gallery'; slug: string } | { name: 'sections' };
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
    const c: Content = j.content ?? { schema: 1, version: 0, updatedAt: '', sections: [{ id: 'work', title: 'Work', intro: '' }], galleries: [] };
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
  const sheetPhoto = gallery && sheet ? gallery.photos.find((p) => p.key === sheet) : undefined;
  const bySection = useMemo(() => {
    if (!content) return [];
    return content.sections.map((s) => ({ section: s, galleries: content.galleries.filter((g) => g.section === s.id) }));
  }, [content]);

  useEffect(() => {
    setSelecting(false);
    setPicked(new Set());
    setSheet(null);
    window.scrollTo(0, 0);
  }, [view]);

  /* ---------- actions ---------- */

  function createGallery(title: string, section: string, service: Service) {
    if (!contentRef.current) return '';
    const taken = new Set(contentRef.current.galleries.map((g) => g.slug));
    const base = slugify(title);
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    const now = new Date().toISOString();
    update((c) => ({
      ...c,
      galleries: [{ slug, title: title.trim(), kind: '', section, service, blurb: '', visible: false, cover: '', photos: [], createdAt: now, updatedAt: now }, ...c.galleries],
    }));
    return slug;
  }

  function moveGallery(slug: string, dir: -1 | 1) {
    update((c) => {
      const i = c.galleries.findIndex((g) => g.slug === slug);
      const sec = c.galleries[i].section;
      let j = i + dir;
      while (j >= 0 && j < c.galleries.length && c.galleries[j].section !== sec) j += dir;
      if (j < 0 || j >= c.galleries.length) return c;
      return { ...c, galleries: move(c.galleries, i, j) };
    });
  }

  function deleteGallery(slug: string) {
    const g = contentRef.current?.galleries.find((x) => x.slug === slug);
    if (!g) return;
    if (!confirm(`Delete the gallery "${g.title}" and its ${g.photos.length} photos from the site? This cannot be undone here.`)) return;
    update((c) => ({ ...c, galleries: c.galleries.filter((x) => x.slug !== slug) }));
    setView({ name: 'home' });
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
            <button className="back" onClick={() => setView({ name: 'home' })}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Galleries
            </button>
          )}
          <a className="top__site" href={gallery ? `${site}/portfolio-collections/${gallery.slug}/` : `${site}/portfolio/`} target="_blank" rel="noopener">
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
            <h1>Galleries</h1>
            <button className="btn ghost small" onClick={() => setView({ name: 'sections' })}>
              Sections
            </button>
          </div>
          {bySection.map(({ section, galleries }) => (
            <section key={section.id} className="group">
              <h2 className="group__title">{section.title}</h2>
              {galleries.length === 0 && <p className="muted small">No galleries in this section yet.</p>}
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
            </section>
          ))}
          <form className="signout" method="post" action="/api/logout">
            <button className="link muted" type="submit">
              Sign out
            </button>
          </form>
          <div className="dock">
            <button className="btn primary block" onClick={() => setCreating(true)}>
              New gallery
            </button>
          </div>
        </main>
      )}

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
                {content.galleries
                  .filter((g) => g.slug !== gallery.slug)
                  .map((g) => (
                    <option key={g.slug} value={g.slug}>
                      {g.title}
                    </option>
                  ))}
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
                Section on the portfolio page
                <select value={gallery.section} onChange={(e) => updateGallery(gallery.slug, (g) => ({ ...g, section: e.target.value }))}>
                  {content.sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
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

      {view.name === 'sections' && (
        <main className="page">
          <div className="page__head">
            <h1>Sections</h1>
          </div>
          <p className="muted small">Sections group your galleries on the portfolio page. Empty sections are left off the site.</p>
          <ul className="sections">
            {content.sections.map((s, i) => {
              const used = content.galleries.filter((g) => g.section === s.id).length;
              return (
                <li key={s.id} className="sec">
                  <label>
                    Name
                    <input value={s.title} maxLength={60} onChange={(e) => update((c) => ({ ...c, sections: c.sections.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)) }))} />
                  </label>
                  <label>
                    One line under the name <span className="muted">(optional)</span>
                    <input value={s.intro} maxLength={220} onChange={(e) => update((c) => ({ ...c, sections: c.sections.map((x) => (x.id === s.id ? { ...x, intro: e.target.value } : x)) }))} />
                  </label>
                  <div className="sec__actions">
                    <span className="muted small">
                      {used} {used === 1 ? 'gallery' : 'galleries'}
                    </span>
                    <button className="link" disabled={i === 0} onClick={() => update((c) => ({ ...c, sections: move(c.sections, i, i - 1) }))}>
                      Move up
                    </button>
                    <button className="link" disabled={i === content.sections.length - 1} onClick={() => update((c) => ({ ...c, sections: move(c.sections, i, i + 1) }))}>
                      Move down
                    </button>
                    <button
                      className="link danger"
                      disabled={used > 0 || content.sections.length === 1}
                      title={used > 0 ? 'Move its galleries to another section first' : undefined}
                      onClick={() => update((c) => ({ ...c, sections: c.sections.filter((x) => x.id !== s.id) }))}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="dock">
            <button
              className="btn primary block"
              onClick={() =>
                update((c) => {
                  const taken = new Set(c.sections.map((s) => s.id));
                  let id = 'section';
                  for (let n = 2; taken.has(id); n++) id = `section-${n}`;
                  return { ...c, sections: [...c.sections, { id, title: 'New section', intro: '' }] };
                })
              }
            >
              Add a section
            </button>
          </div>
        </main>
      )}

      {creating && <NewGallery sections={content.sections} onCancel={() => setCreating(false)} onCreate={(title, section, service) => {
        const slug = createGallery(title, section, service);
        setCreating(false);
        setView({ name: 'gallery', slug });
        pickFor(slug);
      }} />}

      {gallery && sheetPhoto && (
        <PhotoSheet
          photo={sheetPhoto}
          index={gallery.photos.findIndex((p) => p.key === sheetPhoto.key)}
          count={gallery.photos.length}
          isCover={gallery.cover === sheetPhoto.key}
          others={content.galleries.filter((g) => g.slug !== gallery.slug)}
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

function NewGallery({ sections, onCancel, onCreate }: { sections: Section[]; onCancel: () => void; onCreate: (title: string, section: string, service: Service) => void }) {
  const [title, setTitle] = useState('');
  const [section, setSection] = useState(sections[0]?.id ?? '');
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
          if (title.trim()) onCreate(title, section, service);
        }}
      >
        <h2 id="ng-title">New gallery</h2>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Smith family session" maxLength={80} required autoFocus />
        </label>
        <div className="two">
          <label>
            Section
            <select value={section} onChange={(e) => setSection(e.target.value)}>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Type of work
            <select value={service} onChange={(e) => setService(e.target.value as Service)}>
              {(Object.keys(SERVICE_LABEL) as Service[]).map((s) => (
                <option key={s} value={s}>
                  {SERVICE_LABEL[s]}
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
            {others.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.title}
              </option>
            ))}
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
