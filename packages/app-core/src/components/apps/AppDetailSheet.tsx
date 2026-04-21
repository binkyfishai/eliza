import {
  Button,
  DrawerSheet,
  DrawerSheetContent,
  DrawerSheetDescription,
  DrawerSheetHeader,
  DrawerSheetTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@elizaos/ui";
import { AlertTriangle, CheckCircle2, Circle, Clock } from "lucide-react";
import type { AppRunEvent, AppRunSummary, RegistryAppInfo } from "../../api";
import { AppHero, AppIdentityTile } from "./app-identity";
import { getAppDetailExtension } from "./extensions/registry";
import {
  CATEGORY_LABELS,
  getAppCatalogSectionLabel,
  getAppSessionFeatureLabels,
  getAppSessionModeLabel,
} from "./helpers";
import { getRunAttentionReasons } from "./run-attention";

interface AppDetailSheetProps {
  app: RegistryAppInfo | null;
  run: AppRunSummary | null;
  isFavorite: boolean;
  isLaunching?: boolean;
  isStopping?: boolean;
  onClose: () => void;
  onLaunch: (app: RegistryAppInfo) => void;
  onOpenRun?: (run: AppRunSummary) => void;
  onStopRun?: (run: AppRunSummary) => void;
  onToggleFavorite: (appName: string) => void;
}

function formatTimestamp(value: string): string {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return value;
  }
}

function severityTone(severity: AppRunEvent["severity"]): {
  icon: typeof AlertTriangle;
  className: string;
} {
  if (severity === "error") {
    return { icon: AlertTriangle, className: "text-danger" };
  }
  if (severity === "warning") {
    return { icon: AlertTriangle, className: "text-warn" };
  }
  return { icon: CheckCircle2, className: "text-ok" };
}

function FacetRow({
  label,
  state,
  message,
}: {
  label: string;
  state: string;
  message: string | null;
}) {
  const tone =
    state === "healthy" || state === "attached"
      ? "text-ok"
      : state === "degraded" || state === "detached"
        ? "text-warn"
        : state === "offline" || state === "unavailable"
          ? "text-danger"
          : "text-muted";
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/35 bg-card/60 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted-strong">
          {label}
        </div>
        {message ? (
          <div className="mt-0.5 text-xs-tight text-txt">{message}</div>
        ) : null}
      </div>
      <span className={`text-xs-tight font-semibold ${tone}`}>{state}</span>
    </div>
  );
}

export function AppDetailSheet({
  app,
  run,
  isFavorite,
  isLaunching = false,
  isStopping = false,
  onClose,
  onLaunch,
  onOpenRun,
  onStopRun,
  onToggleFavorite,
}: AppDetailSheetProps) {
  const open = app !== null;
  if (!app) {
    return (
      <DrawerSheet
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      />
    );
  }

  const displayName = app.displayName ?? app.name;
  const categoryLabel =
    CATEGORY_LABELS[app.category?.toLowerCase() ?? ""] ?? app.category;
  const sectionLabel = getAppCatalogSectionLabel(app);
  const sessionMode = getAppSessionModeLabel(app);
  const sessionFeatures = getAppSessionFeatureLabels(app);
  const attentionReasons = run ? getRunAttentionReasons(run) : [];
  const recentEvents = run?.recentEvents ?? [];
  const Extension = getAppDetailExtension(app);
  const hasRun = run !== null;
  const primaryCtaLabel = hasRun
    ? run?.viewerAttachment === "attached"
      ? "Open live viewer"
      : "Reattach"
    : isLaunching
      ? "Launching…"
      : "Launch";

  return (
    <DrawerSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DrawerSheetContent
        showCloseButton
        className="w-[min(100%-1rem,42rem)] p-0"
      >
        <DrawerSheetHeader className="sr-only">
          <DrawerSheetTitle>{displayName}</DrawerSheetTitle>
          <DrawerSheetDescription>
            {app.description || "App details"}
          </DrawerSheetDescription>
        </DrawerSheetHeader>

        <AppHero app={app} className="aspect-[21/9] shrink-0" />

        <div className="flex items-start gap-3 border-b border-border/30 px-5 py-4">
          <AppIdentityTile app={app} active={hasRun} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold tracking-[-0.01em] text-txt">
                {displayName}
              </h2>
              {hasRun ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-ok/40 bg-ok/10 px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-ok">
                  <Circle className="h-1.5 w-1.5 fill-current" />
                  Running
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs-tight text-muted">
              <span>{sectionLabel}</span>
              {categoryLabel && categoryLabel !== sectionLabel ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{categoryLabel}</span>
                </>
              ) : null}
              {app.latestVersion ? (
                <>
                  <span aria-hidden>·</span>
                  <span>v{app.latestVersion}</span>
                </>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Button
              size="sm"
              variant={hasRun ? "outline" : "default"}
              disabled={isLaunching}
              onClick={() => {
                if (hasRun && run && onOpenRun) {
                  onOpenRun(run);
                  return;
                }
                onLaunch(app);
              }}
            >
              {primaryCtaLabel}
            </Button>
            <button
              type="button"
              aria-label={
                isFavorite ? "Remove from favorites" : "Add to favorites"
              }
              onClick={() => onToggleFavorite(app.name)}
              className={`text-xs-tight underline-offset-4 transition-colors hover:underline ${
                isFavorite ? "text-warn" : "text-muted"
              }`}
            >
              {isFavorite ? "★ Favorited" : "☆ Favorite"}
            </button>
          </div>
        </div>

        <Tabs
          defaultValue="overview"
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <TabsList className="mx-5 mt-3 grid w-[calc(100%-2.5rem)] grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="utilities">Utilities</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
            <TabsContent value="overview" className="mt-3 space-y-4">
              {app.description ? (
                <p className="text-sm leading-relaxed text-txt">
                  {app.description}
                </p>
              ) : (
                <p className="text-sm text-muted">
                  No description provided for this app.
                </p>
              )}

              {app.capabilities && app.capabilities.length > 0 ? (
                <div>
                  <div className="mb-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted-strong">
                    Capabilities
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {app.capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="inline-flex items-center rounded-full border border-border/40 bg-card/60 px-2 py-0.5 text-[0.62rem] font-medium text-txt"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {sessionMode || sessionFeatures.length > 0 ? (
                <div>
                  <div className="mb-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted-strong">
                    Session
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {sessionMode ? (
                      <span className="inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[0.62rem] font-medium text-accent">
                        {sessionMode}
                      </span>
                    ) : null}
                    {sessionFeatures.map((feature) => (
                      <span
                        key={feature}
                        className="inline-flex items-center rounded-full border border-border/40 bg-card/60 px-2 py-0.5 text-[0.62rem] font-medium text-txt"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {app.repository ? (
                <div className="text-xs-tight text-muted">
                  Repository:{" "}
                  <span className="font-mono text-txt">{app.repository}</span>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="utilities" className="mt-3 space-y-3">
              {!hasRun ? (
                <div className="rounded-xl border border-dashed border-border/40 bg-card/60 px-4 py-8 text-center text-xs-tight text-muted">
                  Launch the app to see live utilities, health, and controls.
                </div>
              ) : (
                <>
                  {attentionReasons.length > 0 ? (
                    <div className="rounded-xl border border-warn/35 bg-warn/10 px-3 py-2">
                      <div className="mb-1 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-warn">
                        Needs attention
                      </div>
                      <ul className="space-y-0.5 text-xs-tight text-txt">
                        {attentionReasons.map((reason) => (
                          <li key={reason}>· {reason}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="space-y-1.5">
                    <FacetRow
                      label="Health"
                      state={run.health.state}
                      message={run.health.message}
                    />
                    {run.healthDetails?.auth ? (
                      <FacetRow
                        label="Auth"
                        state={run.healthDetails.auth.state}
                        message={run.healthDetails.auth.message}
                      />
                    ) : null}
                    {run.healthDetails?.runtime ? (
                      <FacetRow
                        label="Runtime"
                        state={run.healthDetails.runtime.state}
                        message={run.healthDetails.runtime.message}
                      />
                    ) : null}
                    {run.healthDetails?.viewer ? (
                      <FacetRow
                        label="Viewer"
                        state={run.healthDetails.viewer.state}
                        message={run.healthDetails.viewer.message}
                      />
                    ) : null}
                    {run.healthDetails?.chat ? (
                      <FacetRow
                        label="Chat"
                        state={run.healthDetails.chat.state}
                        message={run.healthDetails.chat.message}
                      />
                    ) : null}
                    {run.healthDetails?.control ? (
                      <FacetRow
                        label="Control"
                        state={run.healthDetails.control.state}
                        message={run.healthDetails.control.message}
                      />
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {onOpenRun ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenRun(run)}
                      >
                        Open viewer
                      </Button>
                    ) : null}
                    {onStopRun ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isStopping}
                        onClick={() => onStopRun(run)}
                      >
                        {isStopping ? "Stopping…" : "Stop run"}
                      </Button>
                    ) : null}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="logs" className="mt-3 space-y-2">
              {!hasRun ? (
                <div className="rounded-xl border border-dashed border-border/40 bg-card/60 px-4 py-8 text-center text-xs-tight text-muted">
                  Launch the app to stream runtime events here.
                </div>
              ) : recentEvents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/40 bg-card/60 px-4 py-8 text-center text-xs-tight text-muted">
                  <Clock className="mx-auto mb-2 h-4 w-4" />
                  Waiting for events…
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {recentEvents.map((event) => {
                    const tone = severityTone(event.severity);
                    const ToneIcon = tone.icon;
                    return (
                      <li
                        key={event.eventId}
                        className="flex items-start gap-2 rounded-xl border border-border/35 bg-card/60 px-3 py-2"
                      >
                        <ToneIcon
                          className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone.className}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-muted-strong">
                              {event.kind}
                            </span>
                            <span className="text-[0.6rem] text-muted">
                              {formatTimestamp(event.createdAt)}
                            </span>
                          </div>
                          <div className="mt-0.5 text-xs-tight text-txt">
                            {event.message}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="settings" className="mt-3">
              {Extension ? (
                <Extension app={app} />
              ) : (
                <div className="rounded-xl border border-dashed border-border/40 bg-card/60 px-4 py-8 text-center text-xs-tight text-muted">
                  This app has no custom settings panel.
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DrawerSheetContent>
    </DrawerSheet>
  );
}
