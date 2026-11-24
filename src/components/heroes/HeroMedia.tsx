import { cn } from "@/lib/utils";
import type { Hero } from "./heroes-data";

export function HeroMedia({ hero, className, dim }: { hero: Hero; className?: string; dim?: boolean }) {
  const cls = cn("size-full object-cover object-top", dim && "grayscale brightness-50", className);
  return hero.video ? (
    <video key={hero.video} src={hero.video} poster={hero.image} autoPlay loop muted playsInline className={cls} />
  ) : (
    <img src={hero.image} alt={hero.name} width={768} height={1024} className={cn(cls, "animate-breathe")} />
  );
}
