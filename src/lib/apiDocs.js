import { routeLoader } from "./routesLoader.js";

export function apiDocs(basePath = "/api/v1") {
  return (req, res) => {
    const docs = {};
    const sectionFilter = req.params.section || req.query.section;

    routeLoader.routeInfo.forEach(info => {
      const fullPath = `${info.basePath}${info.routePath}`.replace(/\/+/g, "/");
      const parts = fullPath.split("/").filter(Boolean);

      if (parts.length < 3) return;

      const section = parts[2]; // القسم الأساسي
      if (sectionFilter && section !== sectionFilter) return;

      const shortPath = "/" + parts.slice(0, 4).join("/");

      if (!docs[section]) docs[section] = [];

      if (!docs[section].some(e => e.path === shortPath && e.method === info.method)) {
        docs[section].push({
          method: info.method,
          path: shortPath,
          queries: info.queries && info.queries.length ? info.queries : null // أي query مسموح به
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
