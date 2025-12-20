export function apiDocs(app, basePath = "/api/v1") {
  return (req, res) => {
    const docs = {};

    app._router.stack.forEach(layer => {
      if (!layer.route) return;

      let routePath = layer.route.path;
      let fullPath = `${basePath}${routePath}`.replace(/\/+/g, "/");

      // /api/v1/section/api
      let parts = fullPath.split("/").filter(Boolean);
      let section = parts[2]; // بعد api + v1

      if (!section) return;

      if (!docs[section]) docs[section] = [];

      docs[section].push({
        path: fullPath,
        methods: Object.keys(layer.route.methods).map(m => m.toUpperCase())
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
