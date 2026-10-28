import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { CampaignsAdminClient } from "@/components/admin/CampaignsAdminClient";

export default async function AdminCampaignsPage() {
  const t = await getTranslations("admin");
  const campaigns = await prisma.marketingCampaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      subject: true,
      audience: true,
      status: true,
      sentCount: true,
      createdAt: true,
      sentAt: true,
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-page-fg">
          {t("campaignsTitle")}
        </h1>
        <p className="mt-2 text-sm text-soft">{t("campaignsBody")}</p>
      </div>
      <CampaignsAdminClient
        initial={campaigns.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          sentAt: c.sentAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
