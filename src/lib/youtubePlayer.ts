// YouTube IFrame Player API helper.
//
// This is the ONLY legitimate way to play YouTube audio in a browser: the
// official embedded player. Its audio is cross-origin and is NOT exposed to the
// Web Audio API, so EQ/FX (filters, reverb, crossfade via gain nodes) cannot be
// applied to it. We therefore drive level through the player's own setVolume()
// and keep the (tiny, hidden) video region rendered but invisible — the user
// only ever sees titles. We never download or proxy the underlying stream.

let apiPromise: Promise<void> | null = null;

// Load https://www.youtube.com/iframe_api once; resolves when window.YT is ready.
export function loadYouTubeAPI(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const w = window as any;
  if (w.YT && w.YT.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => { try { prev?.(); } catch {} resolve(); };
    if (!document.getElementById("yt-iframe-api")) {
      const s = document.createElement("script");
      s.id = "yt-iframe-api";
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
    // Safety: if the script was already present and YT became ready meanwhile.
    const poll = setInterval(() => {
      if (w.YT && w.YT.Player) { clearInterval(poll); resolve(); }
    }, 200);
    setTimeout(() => clearInterval(poll), 10000);
  });
  return apiPromise;
}

// YT.PlayerState: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued.
export interface YTController {
  player: any;
  ready: Promise<void>;
}

// Create a hidden player inside `mount`. Caller is responsible for keeping the
// mount node out of React's reconciliation path (YT replaces the target node
// with an <iframe>).
export function createYouTubePlayer(
  mount: HTMLElement,
  handlers: { onState?: (s: number) => void },
): YTController {
  const w = window as any;
  const target = document.createElement("div");
  // The IFrame API registers each player in an internal map keyed by element id
  // (and replaces the element by id with the <iframe>). Two players sharing an
  // empty id collide → commands/playback route to a single iframe, so launching
  // one deck stops/steals the other. A unique id per player keeps them separate.
  target.id = `yt-deck-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  mount.appendChild(target);
  let resolveReady!: () => void;
  const ready = new Promise<void>((r) => (resolveReady = r));
  const player = new w.YT.Player(target, {
    width: "200",
    height: "200",
    playerVars: {
      controls: 0, disablekb: 1, fs: 0, modestbranding: 1,
      playsinline: 1, rel: 0, iv_load_policy: 3, origin: window.location.origin,
    },
    events: {
      onReady: () => resolveReady(),
      onStateChange: (e: any) => handlers.onState?.(e?.data),
    },
  });
  return { player, ready };
}
