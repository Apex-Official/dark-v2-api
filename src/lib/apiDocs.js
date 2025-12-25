import express from 'express';
import { routeLoader } from './routesLoader.js'; // لو عندك routers مخزنين هنا

/**
 * تحلل router وتستخرج كل queries من كل route
 */
function extractQueriesFromRouter(router) {
  const endpoints = [];

  router.stack.forEach(layer => {
    if (layer.route) {
      const path = layer.route.path;
      const method = Object.keys(layer.route.methods)[0].toUpperCase();
      const handler = layer.route.stack[0].handle;

      // تحليل الكود كـ string للبحث عن req.query.X
      const fnStr = handler.toString();
      const regex = /req\.query\.([a-zA-Z0-9_]+)/g;
      const routeQueries = [];
      let match;
      while ((match = regex.exec(fnStr)) !== null) {
        if (!routeQueries.includes(match[1])) routeQueries.push(match[1]);
      }

      endpoints.push({
        method,
        path,
        queries: routeQueries.length ? routeQueries : null
      });
    }
  });

  return endpoints;
}

/**
 * دالة apiDocs ذكية
 */
export function apiDocs(basePath = "/api/v1") {
  return (req, res) => {
    const docs = {};
    const sectionFilter = req.params.section || req.query.section;

    routeLoader.routeInfo.forEach(info => {
      // info.router: هنا نحط الـ router الأصلي
      const endpoints = extractQueriesFromRouter(info.router);

      const section = info.section || info.basePath.split("/")[2] || "general";
      if (sectionFilter && section !== sectionFilter) return;

      if (!docs[section]) docs[section] = [];

      endpoints.forEach(ep => {
        // تجنب duplicates
        if (!docs[section].some(e => e.path === ep.path && e.method === ep.method)) {
          docs[section].push(ep);
        }
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
