import type { MouseEvent } from "react";
import type { RegistryAppInfo } from "../../api";
import { AppIdentityTile } from "./app-identity";
import { getAppShortName } from "./helpers";

interface AppStoreCategoryRailProps {
  title: string;
  apps: RegistryAppInfo[];
  activeAppNames: Set<string>;
  favoriteAppNames: Set<string>;
  onSelect: (app: RegistryAppInfo) => void;
  onToggleFavorite: (appName: string) => void;
}

export function AppStoreCategoryRail({
  title,
  apps,
  activeAppNames,
  favoriteAppNames,
  onSelect,
  onToggleFavorite,
}: AppStoreCategoryRailProps) {
  if (apps.length === 0) return null;

  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-3">
        <h2 className="text-xs-tight font-semibold uppercase tracking-[0.18em] text-muted-strong">
          {title}
        </h2>
        <div className="h-px flex-1 bg-border/30" />
      </div>

      <div
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-2 lg:-mx-6 lg:px-6"
        style={{ scrollbarWidth: "thin" }}
      >
        {apps.map((app) => {
          const isActive = activeAppNames.has(app.name);
          const isFavorite = favoriteAppNames.has(app.name);
          const displayName = app.displayName ?? getAppShortName(app);
          const subtitle = app.description?.split(/[.!?]/)[0]?.trim() ?? "";

          return (
            <div
              key={app.name}
              className="group relative flex w-28 shrink-0 snap-start flex-col items-center gap-1.5"
            >
              <button
                type="button"
                data-testid={`app-rail-card-${app.name.replace(/[^a-z0-9]+/gi, "-")}`}
                title={displayName}
                aria-label={displayName}
                className="rounded-[1.15rem] outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent/60 group-hover:-translate-y-0.5"
                onClick={() => onSelect(app)}
              >
                <AppIdentityTile app={app} active={isActive} size="md" />
              </button>
              <div className="w-full text-center">
                <div className="truncate text-[0.72rem] font-semibold text-txt">
                  {displayName}
                </div>
                {subtitle ? (
                  <div className="mt-0.5 line-clamp-2 text-[0.58rem] leading-tight text-muted">
                    {subtitle}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                aria-label={
                  isFavorite ? "Remove from favorites" : "Add to favorites"
                }
                className={`absolute -right-0.5 -top-0.5 rounded-full bg-black/35 p-1 text-white backdrop-blur-sm transition-opacity ${
                  isFavorite
                    ? "text-warn opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                }`}
                onClick={(event: MouseEvent<HTMLButtonElement>) => {
                  event.stopPropagation();
                  onToggleFavorite(app.name);
                }}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill={isFavorite ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <title>Favorite</title>
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
