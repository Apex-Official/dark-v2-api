export function apiDocs(app, basePath = "/api/v1") {
  return (req, res) => {
    const routes = [];

    app._router.stack.forEach((layer) => {
      if (!layer.route) return;

      const path = layer.route.path;
      const methods = Object.keys(layer.route.methods)
        .map(m => m.toUpperCase());

      routes.push({
        path: `${basePath}${path}`.replace("//", "/"),
        methods
      });
    });

    res.json({
      name: "Dark V2 API",
      version: "v1",
      totalRoutes: routes.length,
      routes
    });
  };
}
