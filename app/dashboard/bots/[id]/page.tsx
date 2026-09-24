import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserSubscription } from "@/lib/access";
import { getPlan, type PlanId } from "@/lib/plans";
import { parseBotConfig } from "@/lib/bot-config";
import { assertBotInGuild } from "@/lib/discord";
import { getPlatformInviteUrl } from "@/lib/invite";
import { provisionBot } from "@/lib/provisioning";
import { BotEditor } from "@/components/dashboard/BotEditor";
import { DeleteBotButton } from "@/components/dashboard/DeleteBotButton";

type PageProps = {
  params: Promise<{ id: string }>;
};

type CustomCommand = {
  name: string;
  response: string;
};

function parseCommands(value: unknown): CustomCommand[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is CustomCommand => {
    if (typeof item !== "object" || item === null) return false;
    const record = item as Record<string, unknown>;
    return typeof record.name === "string" && typeof record.response === "string";
  });
}

export default async function BotDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const t = await getTranslations("dashboard");
  const { id } = await params;
  let bot = await prisma.bot.findFirst({
    where: { id, userId: session!.user.id },
  });

  if (!bot) notFound();

  const subscription = await getUserSubscription(session!.user.id);
  const plan = getPlan(subscription.plan as PlanId);

  let botPresent = false;
  if (bot.guildId) {
    const membership = await assertBotInGuild(bot.guildId);
    botPresent = membership.ok;

    // Après invite Discord, le statut peut rester PENDING : re-provisionne.
    if (
      botPresent &&
      (bot.status === "PENDING" ||
        bot.status === "ERROR" ||
        bot.status === "OFFLINE")
    ) {
      const provision = await provisionBot({
        botId: bot.id,
        guildId: bot.guildId,
        guildLinked: true,
        botPresentInGuild: true,
      });
      bot = await prisma.bot.update({
        where: { id: bot.id },
        data: {
          status: provision.status,
          inviteUrl: provision.inviteUrl ?? bot.inviteUrl,
          lastError: provision.error,
        },
      });
    }
  }

  const inviteUrl =
    getPlatformInviteUrl(bot.guildId ?? undefined) ?? bot.inviteUrl;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-soft">
            Statut · {bot.status}
          </p>
          <h1 className="mt-1 font-display text-3xl text-page-fg">{bot.name}</h1>
          {plan.id === "FREE" ? (
            <p className="mt-2 text-sm text-soft">{t("trialValueHint")}</p>
          ) : null}
        </div>
        <DeleteBotButton
          botId={bot.id}
          botName={bot.name}
          variant="danger"
        />
      </div>

      <BotEditor
        botId={bot.id}
        initialName={bot.name}
        initialDescription={bot.description}
        initialModules={bot.enabledModules}
        initialCommands={parseCommands(bot.customCommands)}
        initialConfig={parseBotConfig(bot.config)}
        plan={plan}
        guildId={bot.guildId}
        inviteUrl={inviteUrl}
        status={bot.status}
        lastError={bot.lastError}
        botPresent={botPresent}
      />
    </div>
  );
}
