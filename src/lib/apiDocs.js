import { routeLoader } from "./routesLoader.js";

export function apiDocs(basePath = "/api/v1") {
  return (req, res) => {
    // Debug مهم
    console.log("RouteInfo size:", routeLoader.routeInfo.size);

    const docs = {};

    for (const info of routeLoader.routeInfo.values()) {
      if (!info.path || !info.path.startsWith(basePath)) continue;

      const parts = info.path.split("/").filter(Boolean);
      if (parts.length < 3) continue;

      const section = parts[2]; // api/v1/{section}
      if (!section) continue;

      if (!docs[section]) docs[section] = [];

      docs[section].push({
        method: info.method,
        path: info.path,
        file: info.file
      });
    }

    res.json({
      name: "Dark V2 API",
      version: "v1",
      sections: Object.keys(docs).length,
      docs
    });
  };
}
