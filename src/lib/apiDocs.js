import fs from "fs";
import path from "path";
import { routeLoader } from "./routesLoader.js";

export function apiDocs(basePath = "/api/v1") {
  return (req, res) => {
    const docs = {};
    const sectionFilter = req.params.section; // لو محدد قسم معين

    routeLoader.routeInfo.forEach(info => {
      const fullPath = `${info.basePath}${info.routePath}`.replace(/\/+/g, "/");
      const parts = fullPath.split("/").filter(Boolean);
      if (parts.length < 3) return;
      const section = parts[2];

      if (sectionFilter && section !== sectionFilter) return;
      if (!docs[section]) docs[section] = [];

      let messages = {};
      let example = {};

      try {
        const code = fs.readFileSync(path.resolve(info.file), "utf-8");

        // استخراج الـ query parameters
        const queryMatches = [...code.matchAll(/req\.query\.([a-zA-Z0-9_]+)/g)];
        if (queryMatches.length) {
          example.query = {};
          queryMatches.forEach(m => {
            example.query[m[1]] = `<${m[1]} هنا>`;
          });
        }

        // استخراج الـ body parameters
        const bodyMatches = [...code.matchAll(/req\.body\.([a-zA-Z0-9_]+)/g)];
        if (bodyMatches.length) {
          example.body = {};
          bodyMatches.forEach(m => {
            example.body[m[1]] = `<${m[1]} هنا>`;
          });
        }

        // استخراج الرسائل الشائعة
        const msgEmpty = code.match(/message:\s*["'`](.*?)["'`]/s);
        if (msgEmpty) messages.errorEmpty = msgEmpty[1];

        const msgNotFound = code.match(/❌.*?["'`]/s);
        if (msgNotFound) messages.errorNotFound = msgNotFound[0].replace(/["'`]/g, "");

        const msgSuccess = code.match(/✅.*?["'`]/s);
        if (msgSuccess) messages.success = msgSuccess[0].replace(/["'`]/g, "");

      } catch (e) {
        console.error("❌ خطأ في قراءة ملف route:", info.file, e.message);
      }

      docs[section].push({
        method: info.method,
        path: fullPath,
        file: info.file,
        example,
        messages
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
