import { Button, Input } from "@elizaos/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type AppRunSummary, client, type RegistryAppInfo } from "../../api";
import { getAppSlugFromPath } from "../../navigation";

import { useApp } from "../../state";
import { openExternalUrl } from "../../utils";
import { AppDetailSheet } from "../apps/AppDetailSheet";
import { AppStoreCategoryRail } from "../apps/AppStoreCategoryRail";
import { AppStoreHeroRail } from "../apps/AppStoreHeroRail";
import {
  filterAppsForCatalog,
  findAppBySlug,
  getAppSlug,
  groupAppsForCatalog,
} from "../apps/helpers";
import {
  getInternalToolApps,
  getInternalToolAppTargetTab,
} from "../apps/internal-tool-apps";
import {
  getAllOverlayApps,
  isOverlayApp,
  overlayAppToRegistryInfo,
} from "../apps/overlay-app-registry";
import { RunningAppsRow } from "../apps/RunningAppsRow";

export { shouldShowAppInAppsView } from "../apps/helpers";

export function AppsView() {
  const {
    appRuns,
    activeGameRunId,
    activeGameViewerUrl,
    appsSubTab,
    favoriteApps,
    setTab,
    setState,
    setActionNotice,
    t,
  } = useApp();
  const [apps, setApps] = useState<RegistryAppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [busyRunId, setBusyRunId] = useState<string | null>(null);
  const [stoppingRunId, setStoppingRunId] = useState<string | null>(null);
  const [selectedAppName, setSelectedAppName] = useState<string | null>(null);
  const [launchingAppName, setLaunchingAppName] = useState<string | null>(null);
  const slugAutoLaunchDone = useRef(false);

  const activeAppNames = useMemo(
    () => new Set(appRuns.map((run) => run.appName)),
    [appRuns],
  );
  const favoriteAppNames = useMemo(() => new Set(favoriteApps), [favoriteApps]);
  const activeGameRun = useMemo(
    () => appRuns.find((run) => run.runId === activeGameRunId) ?? null,
    [activeGameRunId, appRuns],
  );
  const currentGameViewerUrl =
    typeof activeGameViewerUrl === "string" ? activeGameViewerUrl.trim() : "";
  const hasActiveRun = Boolean(activeGameRun);
  const hasCurrentGame =
    currentGameViewerUrl.length > 0 &&
    activeGameRun?.viewerAttachment === "attached";

  const pushAppsUrl = useCallback((slug?: string) => {
    try {
      const path = slug ? `/apps/${slug}` : "/apps";
      if (window.location.protocol === "file:") {
        window.location.hash = path;
      } else {
        window.history.replaceState(null, "", path);
      }
    } catch {
      /* ignore — sandboxed iframe or SSR */
    }
  }, []);

  const sortedRuns = useMemo(
    () => [...appRuns].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [appRuns],
  );
  const mergeRun = useCallback(
    (run: AppRunSummary) => {
      const nextRuns = [
        run,
        ...appRuns.filter((item) => item.runId !== run.runId),
      ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setState("appRuns", nextRuns);
      return nextRuns;
    },
    [appRuns, setState],
  );

  const refreshRuns = useCallback(async () => {
    const runs = await client.listAppRuns();
    setState("appRuns", runs);
    return runs;
  }, [setState]);

  const loadApps = useCallback(async () => {
    setLoading(true);
    setError(null);
    void refreshRuns().catch((err: unknown) => {
      console.warn("[AppsView] Failed to list app runs:", err);
    });
    try {
      const serverAppsResult = await client
        .listApps()
        .then((apps) => ({
          status: "fulfilled" as const,
          value: apps,
        }))
        .catch((reason) => ({
          status: "rejected" as const,
          reason,
        }));
      const serverApps =
        serverAppsResult.status === "fulfilled" ? serverAppsResult.value : [];
      if (serverAppsResult.status === "rejected") {
        console.warn(
          "[AppsView] Failed to list apps:",
          serverAppsResult.reason,
        );
      }
      const internalToolApps = getInternalToolApps();
      const overlayDescriptors = getAllOverlayApps()
        .filter((oa) => !serverApps.some((a) => a.name === oa.name))
        .map(overlayAppToRegistryInfo);
      const list = [
        ...internalToolApps,
        ...overlayDescriptors,
        ...serverApps,
      ].filter(
        (app, index, items) =>
          items.findIndex((candidate) => candidate.name === app.name) === index,
      );
      setApps(list);
    } catch (err) {
      setError(
        t("appsview.LoadError", {
          message:
            err instanceof Error ? err.message : t("appsview.NetworkError"),
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [refreshRuns, t]);

  const refreshApps = useCallback(async () => {
    try {
      await client.refreshRegistry();
    } catch (err) {
      console.warn("[AppsView] Failed to refresh registry:", err);
    }
    await loadApps();
  }, [loadApps]);

  useEffect(() => {
    void loadApps();
  }, [loadApps]);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        await refreshRuns();
      } catch (err) {
        if (!cancelled) {
          console.warn("[AppsView] Failed to refresh app runs:", err);
        }
      }
    };

    const timer = setInterval(() => {
      void refresh();
    }, 5_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refreshRuns]);

  useEffect(() => {
    if (appsSubTab !== "running") return;
    setState("appsSubTab", "browse");
  }, [appsSubTab, setState]);

  const handleLaunch = useCallback(
    async (app: RegistryAppInfo) => {
      const internalToolTab = getInternalToolAppTargetTab(app.name);
      if (internalToolTab) {
        setTab(internalToolTab);
        setSelectedAppName(null);
        return;
      }

      if (isOverlayApp(app.name)) {
        setState("activeOverlayApp", app.name);
        pushAppsUrl(getAppSlug(app.name));
        setSelectedAppName(null);
        return;
      }
      setLaunchingAppName(app.name);
      try {
        const result = await client.launchApp(app.name);
        const primaryLaunchDiagnostic =
          result.diagnostics?.find(
            (diagnostic) => diagnostic.severity === "error",
          ) ?? result.diagnostics?.[0];
        const launchedRun = result.run ? mergeRun(result.run) : null;
        const primaryRun =
          launchedRun?.find((run) => run.appName === app.name) ?? result.run;

        if (primaryRun?.viewer?.url) {
          setState("activeGameRunId", primaryRun.runId);
          if (
            primaryRun.viewer.postMessageAuth &&
            !primaryRun.viewer.authMessage
          ) {
            setActionNotice(
              t("appsview.IframeAuthMissing", {
                name: app.displayName ?? app.name,
              }),
              "error",
              4800,
            );
          }
          if (primaryLaunchDiagnostic) {
            setActionNotice(
              primaryLaunchDiagnostic.message,
              primaryLaunchDiagnostic.severity === "error" ? "error" : "info",
              6500,
            );
          }
          setState("tab", "apps");
          setState("appsSubTab", "games");
          pushAppsUrl(getAppSlug(app.name));
          setSelectedAppName(null);
          return;
        }

        if (primaryRun) {
          setState("appsSubTab", "browse");
          pushAppsUrl(getAppSlug(app.name));
        }

        if (primaryLaunchDiagnostic) {
          setActionNotice(
            primaryLaunchDiagnostic.message,
            primaryLaunchDiagnostic.severity === "error" ? "error" : "info",
            6500,
          );
        }
        const targetUrl = result.launchUrl ?? app.launchUrl;
        if (targetUrl) {
          try {
            await openExternalUrl(targetUrl);
            setActionNotice(
              t("appsview.OpenedInNewTab", {
                name: app.displayName ?? app.name,
              }),
              "success",
              2600,
            );
          } catch {
            setActionNotice(
              t("appsview.PopupBlockedOpen", {
                name: app.displayName ?? app.name,
              }),
              "error",
              4200,
            );
          }
          return;
        }
        setActionNotice(
          t("appsview.LaunchedNoViewer", {
            name: app.displayName ?? app.name,
          }),
          "error",
          4000,
        );
      } catch (err) {
        setActionNotice(
          t("appsview.LaunchFailed", {
            name: app.displayName ?? app.name,
            message: err instanceof Error ? err.message : t("common.error"),
          }),
          "error",
          4000,
        );
      } finally {
        setLaunchingAppName(null);
      }
    },
    [mergeRun, pushAppsUrl, setActionNotice, setState, setTab, t],
  );

  useEffect(() => {
    if (slugAutoLaunchDone.current || apps.length === 0) return;
    slugAutoLaunchDone.current = true;

    if (activeGameRunId) return;

    const slug = getAppSlugFromPath(
      window.location.protocol === "file:"
        ? window.location.hash.replace(/^#/, "") || "/"
        : window.location.pathname,
    );
    if (!slug) return;

    const app = findAppBySlug(apps, slug);
    if (app) {
      void handleLaunch(app);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time on first apps load
  }, [apps, handleLaunch, activeGameRunId]);

  const handleOpenCurrentGame = useCallback(() => {
    if (!hasActiveRun || !activeGameRun) return;
    setState("tab", "apps");
    setState("appsSubTab", "games");
    pushAppsUrl(getAppSlug(activeGameRun.appName));
  }, [activeGameRun, hasActiveRun, pushAppsUrl, setState]);

  const handleOpenRun = useCallback(
    async (run: AppRunSummary) => {
      if (!run.viewer?.url) {
        if (run.launchUrl) {
          try {
            await openExternalUrl(run.launchUrl);
            setActionNotice(
              t("appsview.OpenedInNewTab", {
                name: run.displayName,
              }),
              "success",
              2600,
            );
          } catch {
            setActionNotice(
              t("appsview.PopupBlockedOpen", {
                name: run.displayName,
              }),
              "error",
              4200,
            );
          }
          return;
        }

        setActionNotice(
          t("appsview.LaunchedNoViewer", {
            name: run.displayName,
          }),
          "info",
          3200,
        );
        return;
      }

      setBusyRunId(run.runId);
      try {
        const result =
          run.viewerAttachment === "attached"
            ? {
                success: true,
                message: `${run.displayName} attached.`,
                run,
              }
            : await client.attachAppRun(run.runId);
        const nextRun =
          result.run ??
          ({
            ...run,
            viewerAttachment: "attached",
          } satisfies AppRunSummary);
        mergeRun(nextRun);
        setState("activeGameRunId", nextRun.runId);
        setState("tab", "apps");
        setState("appsSubTab", "games");
        pushAppsUrl(getAppSlug(nextRun.appName));
        setSelectedAppName(null);
        if (nextRun.viewer?.postMessageAuth && !nextRun.viewer.authMessage) {
          setActionNotice(
            t("appsview.IframeAuthMissing", {
              name: nextRun.displayName,
            }),
            "error",
            4800,
          );
        } else if (result.message) {
          setActionNotice(result.message, "success", 2200);
        }
      } catch (err) {
        setActionNotice(
          t("appsview.LaunchFailed", {
            name: run.displayName,
            message: err instanceof Error ? err.message : t("common.error"),
          }),
          "error",
          4000,
        );
      } finally {
        setBusyRunId(null);
      }
    },
    [mergeRun, pushAppsUrl, setActionNotice, setState, t],
  );

  const visibleApps = useMemo(() => {
    return filterAppsForCatalog(apps, {
      activeAppNames,
      searchQuery,
    });
  }, [activeAppNames, apps, searchQuery]);

  const sections = useMemo(
    () => groupAppsForCatalog(visibleApps, favoriteAppNames),
    [visibleApps, favoriteAppNames],
  );

  const selectedApp = useMemo(
    () => apps.find((app) => app.name === selectedAppName) ?? null,
    [apps, selectedAppName],
  );
  const selectedRun = useMemo(
    () =>
      selectedAppName
        ? (appRuns.find((run) => run.appName === selectedAppName) ?? null)
        : null,
    [appRuns, selectedAppName],
  );

  const handleToggleFavorite = useCallback(
    (appName: string) => {
      const current = favoriteApps;
      const next = current.includes(appName)
        ? current.filter((name) => name !== appName)
        : [...current, appName];
      setState("favoriteApps", next);
    },
    [favoriteApps, setState],
  );

  const handleStopRun = useCallback(
    async (run: AppRunSummary) => {
      if (stoppingRunId === run.runId) return;
      setStoppingRunId(run.runId);
      try {
        await client.stopAppRun(run.runId);
        const nextRuns = appRuns.filter((r) => r.runId !== run.runId);
        setState("appRuns", nextRuns);
        if (activeGameRunId === run.runId) {
          setState("activeGameRunId", "");
        }
        setActionNotice(
          t("appsview.Stopped", {
            defaultValue: `${run.displayName} stopped.`,
          }),
          "success",
          2600,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setActionNotice(
          t("appsview.StopFailed", {
            defaultValue: `Could not stop ${run.displayName}: ${message}`,
          }),
          "error",
          4000,
        );
      } finally {
        setStoppingRunId(null);
      }
    },
    [activeGameRunId, appRuns, setActionNotice, setState, stoppingRunId, t],
  );

  return (
    <div
      data-testid="apps-catalog-grid"
      className="device-layout mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 lg:px-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-[-0.01em] text-txt">
          Apps
        </h1>
        {hasActiveRun ? (
          <button
            type="button"
            className="rounded-full border border-ok/35 bg-ok/10 px-3 py-1.5 text-xs-tight font-medium text-ok transition-colors hover:bg-ok/15"
            onClick={handleOpenCurrentGame}
          >
            {hasCurrentGame ? "Live viewer" : "Active run"}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="text"
          aria-label={t("appsview.Search", { defaultValue: "Search apps" })}
          placeholder={t("appsview.SearchPlaceholder")}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="min-w-[200px] flex-1 rounded-xl border-border/50 bg-card/86 text-xs text-txt placeholder:text-muted focus:border-accent"
        />
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl px-3 shadow-sm"
          onClick={() => void refreshApps()}
        >
          {t("common.refresh")}
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs-tight text-danger">
          {error}
        </div>
      ) : null}

      <RunningAppsRow
        runs={sortedRuns}
        catalogApps={apps}
        busyRunId={busyRunId}
        onOpenRun={(run) => void handleOpenRun(run)}
        onStopRun={(run) => void handleStopRun(run)}
        stoppingRunId={stoppingRunId}
      />

      {loading ? (
        <div className="rounded-2xl border border-border/30 bg-card/72 py-16 text-center text-xs text-muted">
          {t("appsview.Loading")}
        </div>
      ) : visibleApps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/35 bg-card/72 px-6 py-16 text-center">
          <div className="text-xs font-medium text-muted-strong">
            {searchQuery
              ? t("appsview.NoAppsMatchSearch")
              : t("appsview.NoAppsAvailable")}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {searchQuery.trim().length === 0 ? (
            <AppStoreHeroRail
              apps={visibleApps}
              activeAppNames={activeAppNames}
              onSelect={(app) => setSelectedAppName(app.name)}
            />
          ) : null}

          {sections.map((section) => (
            <AppStoreCategoryRail
              key={section.key}
              title={section.label}
              apps={section.apps}
              activeAppNames={activeAppNames}
              favoriteAppNames={favoriteAppNames}
              onSelect={(app) => setSelectedAppName(app.name)}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      )}

      <AppDetailSheet
        app={selectedApp}
        run={selectedRun}
        isFavorite={
          selectedAppName ? favoriteAppNames.has(selectedAppName) : false
        }
        isLaunching={launchingAppName === selectedAppName}
        isStopping={selectedRun ? stoppingRunId === selectedRun.runId : false}
        onClose={() => setSelectedAppName(null)}
        onLaunch={(app) => void handleLaunch(app)}
        onOpenRun={(run) => void handleOpenRun(run)}
        onStopRun={(run) => void handleStopRun(run)}
        onToggleFavorite={handleToggleFavorite}
      />
    </div>
  );
}
