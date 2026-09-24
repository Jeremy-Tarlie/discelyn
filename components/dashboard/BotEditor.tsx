"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MODULE_CATALOG,
  cheapestPlanForAuditExport,
  cheapestPlanForModule,
  type BotModuleId,
  type PlanDefinition,
  type PlanId,
} from "@/lib/plans";
import type { BotConfigView } from "@/lib/bot-config";
import { BotGuildLinkForm } from "@/components/dashboard/BotGuildLinkForm";
import { WelcomeSetupPanel } from "@/components/dashboard/WelcomeSetupPanel";
import { ModerationHistoryPanel } from "@/components/dashboard/ModerationHistoryPanel";
import { AccessControlPanel } from "@/components/dashboard/AccessControlPanel";
import { GuildHealthPanel } from "@/components/dashboard/GuildHealthPanel";
import { CheckoutButton } from "@/components/landing/CheckoutButton";
import { useTranslations } from "next-intl";

type CustomCommand = {
  name: string;
  response: string;
};

type ReactionRoleRow = {
  messageId: string;
  emoji: string;
  roleId: string;
};

type BotEditorProps = {
  botId: string;
  initialName: string;
  initialDescription: string | null;
  initialModules: string[];
  initialCommands: CustomCommand[];
  initialConfig: BotConfigView;
  plan: PlanDefinition;
  guildId: string | null;
  inviteUrl: string | null;
  status: string;
  lastError: string | null;
  botPresent: boolean;
};

const fieldClass =
  "w-full rounded-xl border border-line bg-surface-muted px-3 py-2 text-page-fg outline-none ring-signal focus:ring-1";

export function BotEditor({
  botId,
  initialName,
  initialDescription,
  initialModules,
  initialCommands,
  initialConfig,
  plan,
  guildId,
  inviteUrl,
  status,
  lastError,
  botPresent,
}: BotEditorProps) {
  const t = useTranslations("dashboard");
  const te = useTranslations("dashboard.editor");
  const tp = useTranslations("plans");
  const tc = useTranslations("common");
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [modules, setModules] = useState<string[]>(initialModules);
  const [commands, setCommands] = useState<CustomCommand[]>(initialCommands);
  const [welcomeChannelId, setWelcomeChannelId] = useState(
    initialConfig.welcomeChannelId
  );
  const [rulesChannelId, setRulesChannelId] = useState(
    initialConfig.rulesChannelId
  );
  const [welcomeMessage, setWelcomeMessage] = useState(
    initialConfig.welcomeMessage
  );
  const [welcomeRoleId, setWelcomeRoleId] = useState(
    initialConfig.welcomeRoleId
  );
  const [logsChannelId, setLogsChannelId] = useState(
    initialConfig.logsChannelId
  );
  const [bannedWordsText, setBannedWordsText] = useState(
    initialConfig.bannedWords.join(", ")
  );
  const [modPrefix, setModPrefix] = useState(initialConfig.modPrefix || "!");
  const [ticketsCategoryId, setTicketsCategoryId] = useState(
    initialConfig.ticketsCategoryId
  );
  const [ticketsStaffRoleId, setTicketsStaffRoleId] = useState(
    initialConfig.ticketsStaffRoleId
  );
  const [blockInvites, setBlockInvites] = useState(initialConfig.blockInvites);
  const [blockLinks, setBlockLinks] = useState(initialConfig.blockLinks);
  const [blockSpam, setBlockSpam] = useState(initialConfig.blockSpam);
  const [maxMentions, setMaxMentions] = useState(
    String(initialConfig.maxMentions)
  );
  const [reactionRoles, setReactionRoles] = useState<ReactionRoleRow[]>(
    initialConfig.reactionRoles
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgradePlanId, setUpgradePlanId] = useState<PlanId | null>(null);

  const allModules = useMemo(
    () => Object.keys(MODULE_CATALOG) as BotModuleId[],
    []
  );

  const welcomeConfigured =
    Boolean(guildId) &&
    botPresent &&
    welcomeChannelId.length > 0 &&
    modules.includes("welcome");

  function planLabel(planId: PlanId): string {
    return tp(`${planId}.name`);
  }

  function toggleModule(moduleId: BotModuleId) {
    const allowed = plan.modules.includes(moduleId);
    if (!allowed) {
      const target = cheapestPlanForModule(moduleId);
      if (target) setUpgradePlanId(target);
      return;
    }
    setModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId]
    );
  }

  function addCommand() {
    if (commands.length >= plan.maxCustomCommands) return;
    setCommands((prev) => [...prev, { name: "", response: "" }]);
  }

  function addReactionRole() {
    if (reactionRoles.length >= 25) return;
    setReactionRoles((prev) => [
      ...prev,
      { messageId: "", emoji: "", roleId: "" },
    ]);
  }

  function removeReactionRole(index: number) {
    setReactionRoles((prev) => prev.filter((_, i) => i !== index));
  }

  function removeCommand(index: number) {
    setCommands((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);

    const bannedWords = bannedWordsText
      .split(",")
      .map((word) => word.trim())
      .filter(Boolean);

    try {
      const response = await fetch(`/api/bots/${botId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          enabledModules: modules,
          customCommands: commands.filter((c) => c.name && c.response),
          config: {
            welcomeChannelId,
            rulesChannelId,
            welcomeMessage,
            welcomeRoleId,
            logsChannelId,
            bannedWords,
            modPrefix: modPrefix || "!",
            ticketsCategoryId,
            ticketsStaffRoleId,
            blockInvites,
            blockLinks,
            blockSpam,
            maxMentions: Number(maxMentions) || 0,
            reactionRoles: reactionRoles.filter(
              (row) => row.messageId && row.emoji && row.roleId
            ),
          },
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? te("saveFailed"));
        setSaving(false);
        return;
      }
      setMessage(t("saved"));
      router.refresh();
    } catch {
      setError(tc("networkError"));
    } finally {
      setSaving(false);
    }
  }

  const setupInProgress = !welcomeConfigured;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-line bg-surface p-4 text-sm text-soft">
        <p className="font-medium text-page-fg">{t("activationChecklist")}</p>
        <ul className="mt-2 space-y-1">
          <li className={guildId ? "text-signal" : "text-soft"}>
            {guildId ? "✓" : "○"} {t("checklistGuild")}
          </li>
          <li className={botPresent ? "text-signal" : "text-soft"}>
            {botPresent ? "✓" : "○"} {t("checklistBot")}
          </li>
          <li className={welcomeConfigured ? "text-signal" : "text-soft"}>
            {welcomeConfigured ? "✓" : "○"} {t("checklistWelcome")}
          </li>
        </ul>
        <span className="mt-2 block text-soft">
          {t("statusLabel")}{" "}
          <span className="text-page-fg">{status}</span> ·{" "}
          {t("guildLimit", { count: plan.maxGuilds })}
        </span>
        {lastError ? (
          <span className="mt-1 block text-warn">{lastError}</span>
        ) : null}
      </div>

      <BotGuildLinkForm
        botId={botId}
        guildId={guildId}
        inviteUrl={inviteUrl}
        botPresent={botPresent}
      />

      <GuildHealthPanel botId={botId} inviteUrl={inviteUrl} />

      {setupInProgress ? null : (
        <AccessControlPanel
          botId={botId}
          maxAccessProducts={plan.maxAccessProducts}
          guildLinked={Boolean(guildId)}
        />
      )}

      <WelcomeSetupPanel
        botId={botId}
        botPresent={botPresent}
        enabledModules={modules}
        welcomeChannelId={welcomeChannelId}
        rulesChannelId={rulesChannelId}
        welcomeMessage={welcomeMessage}
        onWelcomeChannelIdChange={setWelcomeChannelId}
        onRulesChannelIdChange={setRulesChannelId}
        onWelcomeMessageChange={setWelcomeMessage}
        onModulesChange={setModules}
        welcomeConfigured={welcomeConfigured}
      />

      {setupInProgress ? null : (
      <>
      <ModerationHistoryPanel
        botId={botId}
        auditExport={plan.auditExport}
        upgradePlanId={cheapestPlanForAuditExport()}
      />

      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-lg text-page-fg">
          {t("identityTitle")}
        </h2>
        <p className="text-sm text-soft">{t("identityHint")}</p>
        <label className="block space-y-1 text-sm text-soft">
          {t("identityName")}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
            maxLength={32}
            placeholder={t("identityNamePlaceholder")}
          />
        </label>
        <label className="block space-y-1 text-sm text-soft">
          {t("identityDescription")}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={fieldClass}
            placeholder={te("descriptionPlaceholder")}
          />
        </label>
      </section>

      <section className="space-y-4 rounded-2xl border border-dashed border-line bg-surface/60 p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-soft">
            {te("opsSecondaryTitle")}
          </p>
          <h2 className="mt-1 font-display text-lg text-page-fg">
            {te("modulesTitle")}
          </h2>
          <p className="mt-1 text-sm text-soft">{te("opsSecondaryHint")}</p>
          <p className="mt-1 text-sm text-soft">{te("modulesHint")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {allModules.map((moduleId) => {
            const meta = MODULE_CATALOG[moduleId];
            const allowed = plan.modules.includes(moduleId);
            const enabled = modules.includes(moduleId);
            return (
              <button
                key={moduleId}
                type="button"
                onClick={() => toggleModule(moduleId)}
                className={`rounded-xl border p-4 text-left transition ${
                  !allowed
                    ? "border-line bg-surface-muted opacity-80 hover:border-warn/40"
                    : enabled
                      ? "border-signal/50 bg-signal/10"
                      : "border-line bg-surface-muted hover:border-soft"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-page-fg">{meta.label}</span>
                  {!allowed ? (
                    <span className="text-[11px] uppercase text-warn">
                      {te("upgrade")}
                    </span>
                  ) : (
                    <span className="text-[11px] uppercase text-soft">
                      {enabled ? te("on") : te("off")}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-soft">{meta.description}</p>
              </button>
            );
          })}
        </div>
        {upgradePlanId ? (
          <div className="rounded-xl border border-warn/30 bg-surface-muted p-4">
            <p className="mb-3 text-sm text-soft">
              {te("moduleUpgrade", { plan: planLabel(upgradePlanId) })}
            </p>
            <CheckoutButton
              planId={upgradePlanId}
              label={te("upgradeTo", { plan: planLabel(upgradePlanId) })}
              variant="primary"
            />
            <button
              type="button"
              onClick={() => setUpgradePlanId(null)}
              className="mt-2 text-xs text-soft underline"
            >
              {te("close")}
            </button>
          </div>
        ) : null}
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-lg text-page-fg">
          {te("advancedTitle")}
        </h2>
        <p className="text-sm text-soft">{te("advancedHint")}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-soft">
            {te("welcomeChannel")}
            <input
              value={welcomeChannelId}
              onChange={(e) => setWelcomeChannelId(e.target.value)}
              className={fieldClass}
              placeholder={te("channelIdPlaceholder")}
            />
          </label>
          <label className="space-y-1 text-sm text-soft">
            {te("welcomeRole")}
            <input
              value={welcomeRoleId}
              onChange={(e) => setWelcomeRoleId(e.target.value)}
              className={fieldClass}
              placeholder={te("roleIdPlaceholder")}
            />
          </label>
        </div>
        <label className="block space-y-1 text-sm text-soft">
          {te("welcomeMessage")}
          <textarea
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            rows={2}
            className={fieldClass}
            placeholder={te("welcomeMessagePlaceholder")}
          />
        </label>

        <label className="block space-y-1 text-sm text-soft">
          {te("logsChannel")}
          <input
            value={logsChannelId}
            onChange={(e) => setLogsChannelId(e.target.value)}
            className={fieldClass}
            placeholder={te("channelIdPlaceholder")}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-soft">
            {te("modPrefix")}
            <input
              value={modPrefix}
              onChange={(e) => setModPrefix(e.target.value)}
              className={fieldClass}
              placeholder="!"
              maxLength={5}
            />
          </label>
          <label className="space-y-1 text-sm text-soft">
            {te("ticketsCategory")}
            <input
              value={ticketsCategoryId}
              onChange={(e) => setTicketsCategoryId(e.target.value)}
              className={fieldClass}
              placeholder={te("categoryIdPlaceholder")}
            />
          </label>
        </div>
        <label className="block space-y-1 text-sm text-soft">
          {te("ticketsStaffRole")}
          <input
            value={ticketsStaffRoleId}
            onChange={(e) => setTicketsStaffRoleId(e.target.value)}
            className={fieldClass}
            placeholder={te("staffRolePlaceholder")}
          />
        </label>
        <p className="text-xs text-soft">
          {te("modHint", {
            commands: `${modPrefix || "!"}kick|ban|warn @user`,
          })}
        </p>

        <label className="block space-y-1 text-sm text-soft">
          {te("bannedWords")}
          <textarea
            value={bannedWordsText}
            onChange={(e) => setBannedWordsText(e.target.value)}
            rows={2}
            className={fieldClass}
            placeholder="spam, scam"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-soft">
            <input
              type="checkbox"
              checked={blockInvites}
              onChange={(e) => setBlockInvites(e.target.checked)}
            />
            {te("blockInvites")}
          </label>
          <label className="flex items-center gap-2 text-sm text-soft">
            <input
              type="checkbox"
              checked={blockLinks}
              onChange={(e) => setBlockLinks(e.target.checked)}
            />
            {te("blockLinks")}
          </label>
          <label className="flex items-center gap-2 text-sm text-soft">
            <input
              type="checkbox"
              checked={blockSpam}
              onChange={(e) => setBlockSpam(e.target.checked)}
            />
            {te("blockSpam")}
          </label>
          <label className="space-y-1 text-sm text-soft">
            {te("maxMentions")}
            <input
              type="number"
              min={0}
              max={50}
              value={maxMentions}
              onChange={(e) => setMaxMentions(e.target.value)}
              className={fieldClass}
            />
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg text-page-fg">
            {te("reactionRolesTitle")}
          </h2>
          <button
            type="button"
            onClick={addReactionRole}
            disabled={
              !plan.modules.includes("roles") || reactionRoles.length >= 25
            }
            className="rounded-full border border-line px-3 py-1 text-xs text-page-fg disabled:opacity-40"
          >
            {te("add")}
          </button>
        </div>
        {!plan.modules.includes("roles") ? (
          <p className="text-sm text-warn">
            {te("unavailablePlan", { plan: plan.name })}{" "}
            <button
              type="button"
              className="underline"
              onClick={() => setUpgradePlanId("OPS")}
            >
              {te("upgradeOps")}
            </button>
          </p>
        ) : (
          <p className="text-sm text-soft">{te("reactionRolesHint")}</p>
        )}
        <div className="space-y-3">
          {reactionRoles.map((row, index) => (
            <div
              key={index}
              className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <input
                value={row.messageId}
                onChange={(e) => {
                  const next = [...reactionRoles];
                  next[index] = { ...row, messageId: e.target.value };
                  setReactionRoles(next);
                }}
                placeholder={te("messageIdPlaceholder")}
                className={fieldClass}
                aria-label={te("messageIdPlaceholder")}
              />
              <input
                value={row.emoji}
                onChange={(e) => {
                  const next = [...reactionRoles];
                  next[index] = { ...row, emoji: e.target.value };
                  setReactionRoles(next);
                }}
                placeholder={te("emojiPlaceholder")}
                className={fieldClass}
                aria-label={te("emojiPlaceholder")}
              />
              <input
                value={row.roleId}
                onChange={(e) => {
                  const next = [...reactionRoles];
                  next[index] = { ...row, roleId: e.target.value };
                  setReactionRoles(next);
                }}
                placeholder={te("roleIdPlaceholder")}
                className={fieldClass}
                aria-label={te("roleIdPlaceholder")}
              />
              <button
                type="button"
                onClick={() => removeReactionRole(index)}
                className="rounded-full border border-line px-3 py-2 text-xs text-warn hover:border-warn"
                aria-label={te("remove")}
              >
                {te("remove")}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg text-page-fg">
            {te("customCommandsTitle")}
          </h2>
          <button
            type="button"
            onClick={addCommand}
            disabled={
              !plan.modules.includes("custom_commands") ||
              commands.length >= plan.maxCustomCommands
            }
            className="rounded-full border border-line px-3 py-1 text-xs text-page-fg disabled:opacity-40"
          >
            {te("add")}
          </button>
        </div>
        {!plan.modules.includes("custom_commands") ? (
          <p className="text-sm text-warn">
            {te("unavailablePlan", { plan: plan.name })}{" "}
            <button
              type="button"
              className="underline"
              onClick={() => setUpgradePlanId("OPS")}
            >
              {te("upgradeOps")}
            </button>
          </p>
        ) : (
          <p className="text-sm text-soft">{te("customCommandsHint")}</p>
        )}
        <div className="space-y-3">
          {commands.map((command, index) => (
            <div
              key={index}
              className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
            >
              <input
                value={command.name}
                onChange={(e) => {
                  const next = [...commands];
                  next[index] = { ...command, name: e.target.value };
                  setCommands(next);
                }}
                placeholder={te("commandNamePlaceholder")}
                className={fieldClass}
                aria-label={te("commandNamePlaceholder")}
              />
              <input
                value={command.response}
                onChange={(e) => {
                  const next = [...commands];
                  next[index] = { ...command, response: e.target.value };
                  setCommands(next);
                }}
                placeholder={te("commandResponsePlaceholder")}
                className={fieldClass}
                aria-label={te("commandResponsePlaceholder")}
              />
              <button
                type="button"
                onClick={() => removeCommand(index)}
                className="rounded-full border border-line px-3 py-2 text-xs text-warn hover:border-warn"
                aria-label={te("remove")}
              >
                {te("remove")}
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-signal-glow disabled:opacity-60"
        >
          {saving ? t("saving") : te("save")}
        </button>
        {message ? <span className="text-sm text-signal">{message}</span> : null}
        {error ? <span className="text-sm text-warn">{error}</span> : null}
      </div>
      </>
      )}
    </div>
  );
}
