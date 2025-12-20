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

      // قراءة الكود لاستخراج الرسائل وأمثلة الاستخدام
      let messages = {};
      let example = {};

      try {
        const code = fs.readFileSync(path.resolve(info.file), "utf-8");

        // الرسائل الشائعة
        const errorEmptyMatch = code.match(/message:\s*["'`](.*?)["'`]/s);
        if (errorEmptyMatch) messages.errorEmpty = errorEmptyMatch[1];

        const notFoundMatch = code.match(/message:\s*["'`](❌.*?)[^`]*[`]/s);
        if (notFoundMatch) messages.errorNotFound = notFoundMatch[1];

        const successMatch = code.match(/message:\s*["'`](✅.*?)[^`]*[`]/s);
        if (successMatch) messages.success = successMatch[1];

        // مثال استخدام GET أو POST
        if (info.method.toUpperCase() === "GET") {
          const queryMatch = code.match(/req\.query\.([a-zA-Z0-9_]+)/g);
          if (queryMatch) {
            example.query = {};
            queryMatch.forEach(q => {
              const key = q.split(".")[2];
              example.query[key] = `<${key} هنا>`;
            });
          }
        } else if (info.method.toUpperCase() === "POST") {
          const bodyMatch = code.match(/req\.body\.([a-zA-Z0-9_]+)/g);
          if (bodyMatch) {
            example.body = {};
            bodyMatch.forEach(b => {
              const key = b.split(".")[2];
              example.body[key] = `<${key} هنا>`;
            });
          }
        }

      } catch (e) {
        // لو فيه مشكلة في الملف نخليهم فاضيين
      }

      docs[section].push({
        method: info.method,
        path: fullPath,
        file: info.file,
        example: example,
        messages: messages
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
