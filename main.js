import express from "express";
import { routeLoader } from "./src/lib/routesLoader.js";
import { apiDocs } from "./src/lib/apiDocs.js";

const app = express();

async function setupApp(app) {
  await routeLoader.loadRoutes(app, "api", "/api/v1");

  app.get("/api/v1/:section?", apiDocs("/api/v1"));

  app.listen(3000, () => console.log("Server running on http://localhost:3000"));
}

setupApp(app);
