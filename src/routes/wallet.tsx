import { createFileRoute } from "@tanstack/react-router";
import { WalletPage } from "@/components/wallet/WalletPage";

export const Route = createFileRoute("/wallet")({
  head: () => ({ meta: [
    { title: "المحفظة — منجم الأسوار" },
    { name: "description", content: "خزينة الحامية: رصيد العملات، غنايم المعركة، مكافآت الحضور وربط محفظة TON." },
    { property: "og:title", content: "المحفظة — منجم الأسوار" },
    { property: "og:description", content: "رصيدك ومكافآتك وشراء عملات اللعبة باستخدام TON." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: WalletPage,
});