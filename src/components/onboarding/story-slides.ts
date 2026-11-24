import wall from "@/assets/onboarding/v3-1-wall.jpg";
import mine from "@/assets/onboarding/v3-2-mine.jpg";
import storm from "@/assets/onboarding/v3-3-storm.jpg";
import dawn from "@/assets/onboarding/v3-4-dawn.jpg";
import wallClip from "@/assets/onboarding/story-wall.mp4.asset.json";
import mineClip from "@/assets/onboarding/story-mine.mp4.asset.json";
import stormClip from "@/assets/onboarding/story-storm.mp4.asset.json";
import dawnClip from "@/assets/onboarding/story-dawn.mp4.asset.json";

export type StoryEffect = "embers" | "sparks" | "rain" | "dawn";
export type StorySlide = {
  /** Still frame: poster while the clip loads, and fallback for reduced motion. */
  image: string;
  /** Looping, muted animation of the heroine. */
  video: string;
  effect: StoryEffect;
  eyebrow: string;
  title: string;
  body: string;
  /** Red, urgent styling for the danger beat of the story. */
  alarm?: boolean;
};

export const STORY_SLIDES: StorySlide[] = [
  {
    image: wall,
    video: wallClip.url,
    effect: "embers",
    eyebrow: "منذ مئة عام",
    title: "عاشت البشرية خلف الأسوار",
    body: "ثلاثة جدران عملاقة تحمينا من العمالقة… وتحتها يرقد ذهب لم يجرؤ أحد على لمسه.",
  },
  {
    image: mine,
    video: mineClip.url,
    effect: "sparks",
    eyebrow: "سلاحنا السري",
    title: "كل ضربة معول = عملة",
    body: "نحفر ذهب الأسوار لنموّل الفيلق ونصنع سلاحنا ضد العمالقة. وكلما حفرت أكثر، صرت أقوى.",
  },
  {
    image: storm,
    video: stormClip.url,
    effect: "rain",
    eyebrow: "يوم سقوط الجدار",
    title: "العمالقة عادوا!",
    body: "اخترق العملاق الجدار، والمدينة تحترق. لا وقت للخوف… قاتل، أو تُلتهم.",
    alarm: true,
  },
  {
    image: dawn,
    video: dawnClip.url,
    effect: "dawn",
    eyebrow: "الفجر الجديد",
    title: "هل أنت جاهز؟",
    body: "دعنا نبدأ الآن. انضمّ إلى الفيلق، واحفر طريقك نحو الحرية.",
  },
];
