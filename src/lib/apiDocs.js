import fs from "fs";
import path from "path";
import { routeLoader } from "./routesLoader.js";

export function apiDocs(basePath = "/api/v1") {
  return (req, res) => {
    const docs = {};
    const sectionFilter = req.params.section;

    routeLoader.routeInfo.forEach(info => {
      const fullPath = `${info.basePath}${info.routePath}`.replace(/\/+/g, "/");

      const parts = fullPath.split("/").filter(Boolean);
      if (parts.length < 3) return;

      const section = parts[2]; // api/v1/{section}

      if (sectionFilter && section !== sectionFilter) return;

      if (!docs[section]) docs[section] = [];

      // ==== Auto-detect query params ====
      let queryParams = [];
      try {
        const code = fs.readFileSync(path.resolve(info.file), "utf-8");
        const matches = code.match(/req\.query\.([a-zA-Z0-9_]+)/g);
        if (matches) {
          queryParams = [...new Set(matches.map(m => m.split(".")[2]))];
        }
      } catch (e) {
        // لو حصل أي خطأ في قراءة الملف، نخليه فاضي
        queryParams = [];
      }

      docs[section].push({
        method: info.method,
        path: fullPath,
        file: info.file,
        query: queryParams // 👈 هنا
      });
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
