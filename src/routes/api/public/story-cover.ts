import { createFileRoute } from '@tanstack/react-router';
import cover from '@/assets/brand/bot-start-cover.jpg?inline';

export const Route = createFileRoute('/api/public/story-cover')({
  server: { handlers: { GET: () => {
    const b64 = cover.slice(cover.indexOf(',') + 1);
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return new Response(bytes, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' } });
  } } },
});