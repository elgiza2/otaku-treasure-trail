import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { preloadVideos } from "@/lib/video-preload";
import { Toaster } from "@/components/ui/sonner";
import { DomTranslator } from "@/i18n/DomTranslator";
import { rememberPage } from "@/lib/last-page";
import { requestBotWriteAccess, useTelegramInitData } from "@/lib/telegram";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    // Replace these placeholders with the app's name and description when first building the app.
    // Each content route, / included, must still set its own head(). Never add og:image or
    // twitter:image here: every page without its own would inherit the root's preview image.
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "منجم الأسوار — لعبة تعدين أنمي" },
      { name: "description", content: "لعبة تعدين عملة رقمية بأسلوب الأنمي داخل تيليجرام." },
      { property: "og:title", content: "منجم الأسوار — لعبة تعدين أنمي" },
      { property: "og:description", content: "لعبة تعدين عملة رقمية بأسلوب الأنمي داخل تيليجرام." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=Noto+Kufi+Arabic:wght@600;800&display=swap",
      },
    ],
    scripts: [
      { src: "https://telegram.org/js/telegram-web-app.js" },
      // Monetag rewarded ads; exposes window.show_12281067()
      { src: "https://libtl.com/sdk.js", "data-zone": "12281067", "data-sdk": "show_12281067" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

type TgFull = {
  ready?: () => void; expand?: () => void; requestFullscreen?: () => void; disableVerticalSwipes?: () => void;
  safeAreaInset?: { top?: number }; contentSafeAreaInset?: { top?: number };
  onEvent?: (e: string, cb: () => void) => void;
  offEvent?: (e: string, cb: () => void) => void;
  BackButton?: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void };
};
// Main tabs hide Telegram's back button; every other page shows it.
const TAB_PAGES = ["/", "/tasks", "/battle", "/heroes", "/raid", "/wallet", "/profile"];

function RootComponent() {
  const initData = useTelegramInitData();
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => { preloadVideos(); }, []);
  useEffect(() => {
    rememberPage(router.state.location.pathname);
    return router.subscribe("onResolved", (e) => rememberPage(e.toLocation.pathname));
  }, [router]);
  useEffect(() => {
    // Telegram's native back button: goes to the previous page, or to the battle tab if there is none.
    let dispose: (() => void) | undefined;
    const setup = () => {
      const bb = (window as unknown as { Telegram?: { WebApp?: TgFull } }).Telegram?.WebApp?.BackButton;
      if (!bb || dispose) return;
      const back = () => { if (window.history.length > 1) router.history.back(); else router.navigate({ to: "/battle" }); };
      const sync = (path: string) => (TAB_PAGES.includes(path) ? bb.hide() : bb.show());
      bb.onClick(back);
      sync(router.state.location.pathname);
      const off = router.subscribe("onResolved", (e) => sync(e.toLocation.pathname));
      dispose = () => { off(); bb.offClick(back); };
    };
    setup();
    const timer = window.setInterval(setup, 250);
    const stop = window.setTimeout(() => window.clearInterval(timer), 30_000);
    return () => { window.clearInterval(timer); window.clearTimeout(stop); dispose?.(); };
  }, [router]);
  useEffect(() => {
    // Open as a full-screen Telegram app and keep content below Telegram's own buttons.
    let dispose: (() => void) | undefined;
    const setup = () => {
      const tg = (window as unknown as { Telegram?: { WebApp?: TgFull } }).Telegram?.WebApp;
      if (!tg || dispose) return;
      tg.ready?.();
      tg.expand?.();
      try { tg.requestFullscreen?.(); } catch { /* older clients */ }
      tg.disableVerticalSwipes?.();
      requestBotWriteAccess();
      const apply = () => {
        const a = tg.safeAreaInset?.top ?? 0;
        const b = tg.contentSafeAreaInset?.top ?? 0;
        document.documentElement.style.setProperty("--tg-safe-top", `${a + b}px`);
      };
      apply();
      const events = ["safeAreaChanged", "contentSafeAreaChanged", "fullscreenChanged"];
      events.forEach((e) => tg.onEvent?.(e, apply));
      dispose = () => events.forEach((e) => tg.offEvent?.(e, apply));
    };
    setup();
    const timer = window.setInterval(setup, 250);
    const stop = window.setTimeout(() => window.clearInterval(timer), 30_000);
    return () => { window.clearInterval(timer); window.clearTimeout(stop); dispose?.(); };
  }, [initData]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <DomTranslator />
      <Toaster position="top-center" theme="dark" offset={14} gap={8} />
    </QueryClientProvider>
  );
}
