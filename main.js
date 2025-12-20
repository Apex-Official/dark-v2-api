import express from "express";
import { routeLoader } from "./src/lib/routesLoader.js";
import { apiDocs } from "./src/lib/apiDocs.js";

async function setupApp(app, options = {}) {

  await routeLoader.loadRoutes(app, "api", "/api/v1");
  
  app.get("/api/v1/:section?", apiDocs("/api/v1"));
}

export default setupApp
