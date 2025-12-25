import { routeLoader } from "./routesLoader.js";

function extractQueries(handler) {
  if (typeof handler !== "function") return null;
  const src = handler.toString();
  const matches = [...src.matchAll(/req\.query\.([a-zA-Z0-9_]+)/g)];
  return matches.length ? [...new Set(matches.map(m => m[1]))] : null;
}

export function apiDocs(basePath = "/api/v1") {
  return (req, res) => {
    const docs = {};
    const sectionFilter = req.params.section || req.query.section;

    routeLoader.routeInfo.forEach(info => {
      const fullPath = `${info.basePath}${info.routePath}`.replace(/\/+/g, "/");
      const parts = fullPath.split("/").filter(Boolean);
      if (parts.length < 3) return;

      const section = parts[2];
      if (sectionFilter && section !== sectionFilter) return;

      const shortPath = "/" + parts.slice(0, 4).join("/");
      if (!docs[section]) docs[section] = [];

      const queries =
        info.queries && info.queries.length
          ? info.queries
          : extractQueries(info.handler);

      if (!docs[section].some(e => e.path === shortPath && e.method === info.method)) {
        docs[section].push({
          method: info.method,
          path: shortPath,
          queries: queries && queries.length ? queries : null
        });
      }
    });

    if (sectionFilter && !docs[sectionFilter]) {
      return res.status(404).json({
        error: "Section not found",
        section: sectionFilter
      });
    }

    res.json({
      name: "Dark V2 API",
      version: "v1",
      section: sectionFilter || "all",
      total: Object.values(docs).flat().length,
      docs
    });
  };
}
