import { createFileRoute } from "@tanstack/react-router";
import { NftPage } from "@/components/nft/NftPage";

export const Route = createFileRoute("/nft")({
  head: () => ({
    meta: [
      { title: "NFT الحرب — منجم الأسوار" },
      { name: "description", content: "اعمل Mint واحصل على بطاقة حرب عشوائية برقم خاص بيك." },
      { property: "og:title", content: "NFT الحرب — منجم الأسوار" },
      { property: "og:description", content: "بطاقة عشوائية مع كل Mint: عادي، نادر، أسطوري أو خرافي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NftPage,
});
