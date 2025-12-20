import { routeLoader } from "./routesLoader.js";

export function apiDocs(basePath = "/api/v1") {
  return (req, res) => {
    const docs = {};

    routeLoader.routeInfo.forEach(info => {
      // نتأكد إنه API
      if (!info.path.startsWith(basePath)) return;

      // api/v1/{section}/{endpoint}
      const parts = info.path.split("/").filter(Boolean);
      const section = parts[2]; // بعد api + v1

      if (!section) return;

      if (!docs[section]) docs[section] = [];

      // منع التكرار
      const exists = docs[section].some(
        r => r.path === info.path && r.method === info.method
      );
      if (exists) return;

      docs[section].push({
        path: info.path,
        methods: [info.method],
        file: info.file
      });
    });

    res.json({
      name: "Dark V2 API",
      version: "v1",
      sections: Object.keys(docs).length,
      docs
    });
  };
}
