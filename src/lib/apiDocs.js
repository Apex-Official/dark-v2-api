import { routeLoader } from "./routesLoader.js";

export function apiDocs(basePath = "/api/v1") {
  return (req, res) => {
    const docs = {};

    // ناخد القسم من params أو query
    const sectionFilter = req.params.section || req.query.section;

    routeLoader.routeInfo.forEach(info => {
      const fullPath = `${info.basePath}${info.routePath}`.replace(/\/+/g, "/");
      const parts = fullPath.split("/").filter(Boolean);

      // نتأكد إن فيه على الأقل basePath + v1 + section
      if (parts.length < 3) return;

      const section = parts[2]; // القسم الأساسي

      // لو فيه فلتر للقسم وما هوش مطابق، نرجع
      if (sectionFilter && section !== sectionFilter) return;

      if (!docs[section]) docs[section] = [];

      docs[section].push({
        method: info.method,
        path: fullPath
      });
    });

    // لو القسم محدد ومش موجود
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
