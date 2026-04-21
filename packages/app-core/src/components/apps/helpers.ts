import {
  normalizeElizaCuratedAppName,
  packageNameToAppRouteSlug,
} from "@elizaos/shared/contracts/apps";
import type { RegistryAppInfo } from "../../api";
import { isInternalToolApp } from "./internal-tool-apps";

export type AppCatalogSectionKey =
  | "favorites"
  | "games"
  | "developerUtilities"
  | "companions"
  | "finance"
  | "lifeManagement"
  | "other";

export function getAppCatalogSectionKey(
  app: Pick<
    RegistryAppInfo,
    "name" | "displayName" | "description" | "category"
  >,
): AppCatalogSectionKey {
  if (app.name === "@elizaos/app-lifeops") {
    return "lifeManagement";
  }

  if (isInternalToolApp(app.name)) {
    return "developerUtilities";
  }

  const canonicalName = normalizeElizaCuratedAppName(app.name) ?? app.name;
  switch (canonicalName) {
    case "@elizaos/app-companion":
      return "companions";
    case "@elizaos/app-vincent":
    case "@elizaos/app-shopify":
      return "finance";
    case "@elizaos/app-babylon":
      return "games";
    case "@hyperscape/plugin-hyperscape":
    case "@elizaos/app-2004scape":
    case "@elizaos/app-scape":
    case "@elizaos/app-defense-of-the-agents":
    case "@clawville/app-clawville":
      return "games";
  }

  const normalizedCategory = app.category.trim().toLowerCase();
  if (normalizedCategory === "game") {
    return "games";
  }
  if (normalizedCategory === "utility") {
    return "developerUtilities";
  }
  if (normalizedCategory === "social" || normalizedCategory === "world") {
    return "companions";
  }
  if (normalizedCategory === "platform") {
    return "finance";
  }

  const searchBlob = [
    app.name,
    app.displayName ?? "",
    app.description ?? "",
    app.category,
  ]
    .join(" ")
    .toLowerCase();

  if (
    /calendar|task|inbox|lifeops|reminder|routine|planning|productivity/.test(
      searchBlob,
    )
  ) {
    return "lifeManagement";
  }
  if (/companion|avatar|assistant|friend|chat|social/.test(searchBlob)) {
    return "companions";
  }
  if (
    /commerce|shop|store|finance|wallet|market|trade|sales|business|team/.test(
      searchBlob,
    )
  ) {
    return "finance";
  }
  if (
    /debug|viewer|plugin|skill|memory|trajectory|runtime|database|log|sql/.test(
      searchBlob,
    )
  ) {
    return "developerUtilities";
  }

  return "other";
}

export function getAppShortName(app: RegistryAppInfo): string {
  const display = app.displayName ?? app.name;
  const clean = display.replace(/^@[^/]+\/app-/, "");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function getAppEmoji(app: RegistryAppInfo): string {
  const sectionKey = getAppCatalogSectionKey(app);
  if (sectionKey === "games") return "🎮";
  if (sectionKey === "developerUtilities") return "🛠️";
  if (sectionKey === "companions") return "💬";
  if (sectionKey === "finance") return "💰";
  if (sectionKey === "lifeManagement") return "🗓️";
  return "📦";
}

/**
 * Derive a URL slug from an app's package name.
 *
 * Uses the existing `packageNameToAppRouteSlug` for scoped packages
 * (`@scope/app-foo` → `foo`, `@scope/plugin-bar` → `bar`).
 * Falls back to a sanitised form of the raw name.
 */
export function getAppSlug(appName: string): string {
  const slug = packageNameToAppRouteSlug(appName);
  if (slug) return slug;
  return (
    appName
      .replace(/^@[^/]+\//, "")
      .replace(/^(app|plugin)-/, "")
      .replace(/[^a-z0-9-]/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || appName
  );
}
