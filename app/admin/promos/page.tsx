import { getTranslations } from "next-intl/server";
import { getStripe } from "@/lib/stripe";
import { PromosAdminClient } from "@/components/admin/PromosAdminClient";

export default async function AdminPromosPage() {
  const t = await getTranslations("admin");
  let initial: Array<{
    id: string;
    code: string;
    active: boolean;
    timesRedeemed: number;
    percentOff: number | null;
  }> = [];

  try {
    const stripe = getStripe();
    const promos = await stripe.promotionCodes.list({
      limit: 50,
      expand: ["data.coupon"],
    });
    initial = promos.data.map((p) => {
      const coupon = p.coupon;
      const percentOff =
        typeof coupon === "object" && coupon && "percent_off" in coupon
          ? coupon.percent_off
          : null;
      return {
        id: p.id,
        code: p.code,
        active: p.active,
        timesRedeemed: p.times_redeemed,
        percentOff,
      };
    });
  } catch {
    initial = [];
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-page-fg">{t("promosTitle")}</h1>
        <p className="mt-2 text-sm text-soft">{t("promosBody")}</p>
      </div>
      <PromosAdminClient initial={initial} />
    </div>
  );
}
