import { routeLoader } from "./routesLoader.js";

export function apiDocs(basePath = "/api/v1") {
  return (req, res) => {
    const docs = {};
    const sectionFilter = req.params.section || req.query.section;

    // ناخد كل الـ query parameters في object
    const userQuery = { ...req.query };
    // لو فيه section استخدمناه للفلترة، نحذفه من الـ query
    if (sectionFilter) delete userQuery.section;

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
          query: Object.keys(userQuery).length ? userQuery : null // أي query موجود يتحط هنا
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
