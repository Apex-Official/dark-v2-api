import { routeLoader } from "./src/lib/routesLoader.js";
import { apiDocs } from "./src/lib/apiDocs.js";

async function setupApp(app, options = {}) {

  // تحميل APIs
  await routeLoader.loadRoutes(app, "api", "/api/v1");

  // Docs (من غير app)
  app.get("/api/v1", apiDocs("/api/v1"));
}

export default setupApp;
