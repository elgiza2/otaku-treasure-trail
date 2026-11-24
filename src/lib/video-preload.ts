// Warms the browser cache with every app video after the first screen settles.
// Downloads run one at a time (NFT intro first) so they never compete with the visible page.
let started = false;

export function preloadVideos() {
  if (started || typeof window === "undefined") return;
  started = true;
  const conn = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return;
  const run = async () => {
    const [{ INTRO_VIDEO }, { STORY_SLIDES }, { HEROES }] = await Promise.all([
      import("@/components/nft/nft-art"),
      import("@/components/onboarding/story-slides"),
      import("@/components/heroes/heroes-data"),
    ]);
    const urls = [INTRO_VIDEO, ...STORY_SLIDES.map((s) => s.video), ...HEROES.flatMap((h) => [h.video, h.battle])]
      .filter((u): u is string => !!u);
    for (const url of [...new Set(urls)]) {
      try {
        const res = await fetch(url, { cache: "force-cache" });
        await res.blob();
      } catch { /* skip; the video will load normally when shown */ }
      await new Promise((r) => setTimeout(r, 150));
    }
  };
  setTimeout(() => {
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
    idle ? idle(() => void run()) : void run();
  }, 1500);
}
