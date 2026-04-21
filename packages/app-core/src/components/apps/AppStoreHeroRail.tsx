import type { RegistryAppInfo } from "../../api";
import { AppHero } from "./app-identity";
import {
  APP_CATALOG_SECTION_LABELS,
  getAppCatalogSectionKey,
  getAppShortName,
} from "./helpers";

interface AppStoreHeroRailProps {
  apps: RegistryAppInfo[];
  activeAppNames: Set<string>;
  onSelect: (app: RegistryAppInfo) => void;
}

/**
 * Today-style featured carousel. Shows the top-ranked apps as large,
 * edge-to-edge hero cards with a category tagline + display name overlay.
 */
export function AppStoreHeroRail({
  apps,
  activeAppNames,
  onSelect,
}: AppStoreHeroRailProps) {
  const featured = apps.slice(0, 6);
  if (featured.length === 0) return null;

  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-3">
        <h2 className="text-xs-tight font-semibold uppercase tracking-[0.18em] text-accent">
          Featured
        </h2>
        <div className="h-px flex-1 bg-border/30" />
      </div>

      <div
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-2 lg:-mx-6 lg:px-6"
        style={{ scrollbarWidth: "thin" }}
      >
        {featured.map((app) => {
          const isActive = activeAppNames.has(app.name);
          const displayName = app.displayName ?? getAppShortName(app);
          const sectionKey = getAppCatalogSectionKey(app);
          const tagline = APP_CATALOG_SECTION_LABELS[sectionKey];

          return (
            <button
              key={app.name}
              type="button"
              data-testid={`app-hero-card-${app.name.replace(/[^a-z0-9]+/gi, "-")}`}
              aria-label={displayName}
              onClick={() => onSelect(app)}
              className="group relative h-52 w-[22rem] shrink-0 snap-start overflow-hidden rounded-2xl border border-border/40 bg-card/72 text-left shadow-[0_8px_24px_-12px_rgba(0,0,0,0.4)] transition-all hover:border-accent/55 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 sm:w-[26rem]"
            >
              <AppHero
                app={app}
                className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-4 pr-12">
                <div className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white/80 drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)]">
                  {tagline}
                </div>
                <div className="truncate text-lg font-semibold text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)]">
                  {displayName}
                </div>
                {app.description ? (
                  <div className="line-clamp-2 text-xs-tight text-white/85 drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)]">
                    {app.description}
                  </div>
                ) : null}
              </div>
              {isActive ? (
                <span
                  role="img"
                  aria-label="Running"
                  className="pointer-events-none absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-ok shadow-[0_0_0_3px_rgba(16,185,129,0.35)]"
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
