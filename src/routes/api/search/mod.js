// routes/traidmode-search.js
import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const router = express.Router();

class TraidModeSearch {
  constructor() {
    this.siteBase = "https://traidmode.com";
    this.headers = {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140.0.7339.207 Mobile Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ar,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
      Referer: "https://traidmode.com",
      Connection: "keep-alive",
    };
    this.excludePathPrefixes = [
      "/",
      "/blog",
      "/f-a-q",
      "/faq",
      "/contact",
      "/about",
      "/category",
      "/tag",
      "/page",
      "/author",
      "/sitemap",
      "/privacy",
      "/terms",
      "/archive",
      "/login",
      "/register",
    ];
    this.excludeTitleKeywords = [
      "home",
      "الرئيسية",
      "blog",
      "faq",
      "contact",
      "about",
      "privacy",
      "terms",
      "category",
      "tag",
    ];
  }

  resolveAndFilter(href, titleRaw) {
    try {
      if (!href || href === "#" || href.trim().length === 0) return null;

      let resolvedUrl;
      try {
        resolvedUrl = new URL(href, this.siteBase).toString();
      } catch {
        return null;
      }

      const urlObj = new URL(resolvedUrl);
      const pathname = urlObj.pathname.replace(/\/+$/, "");
      const title = (titleRaw || "").toString().trim();

      const lowerPath = pathname.toLowerCase();
      for (const prefix of this.excludePathPrefixes) {
        if (prefix === "/" && (lowerPath === "" || lowerPath === "/")) return null;
        if (prefix !== "/" && lowerPath.startsWith(prefix)) return null;
      }

      const lowerTitle = title.toLowerCase();
      for (const kw of this.excludeTitleKeywords) {
        if (lowerTitle.includes(kw)) return null;
      }

      if (
        lowerPath.includes("/?s=") ||
        lowerPath.includes("/page/") ||
        lowerPath.includes("/tag/") ||
        lowerPath.includes("/category/")
      ) {
        return null;
      }

      if (
        urlObj.hostname &&
        !urlObj.hostname.includes("traidmode.com") &&
        !urlObj.pathname.toLowerCase().includes(".apk")
      ) {
        return null;
      }

      const finalUrl = resolvedUrl;
      const finalTitle = title || finalUrl.split("/").pop().split("?")[0] || finalUrl;

      return { url: finalUrl, title: finalTitle.replace(/\s+/g, " ").trim() };
    } catch {
      return null;
    }
  }

  async search(query) {
    try {
      const searchUrl = `${this.siteBase}/?s=${encodeURIComponent(query)}`;
      const response = await fetch(searchUrl, {
        headers: this.headers,
        redirect: "follow",
        timeout: 15000,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const html = await response.text();
      const $ = cheerio.load(html);
      const results = [];

      $(".post, article, .search-result, .app-item").each((i, elem) => {
        const $elem = $(elem);
        const link = $elem.find("a").first();
        const rawHref = link.attr("href") || "";
        const titleRaw =
          link.attr("title") ||
          link.text() ||
          $elem.find("h2, h3, .title, .post-title").first().text();
        const description = $elem.find(".excerpt, .description, p").first().text().trim();

        const resolved = this.resolveAndFilter(rawHref, titleRaw);
        if (!resolved) return;

        const { url, title } = resolved;
        results.push({ title, url, description: description || "" });
      });

      if (results.length === 0) {
        $("a").each((i, elem) => {
          const $a = $(elem);
          const href = $a.attr("href") || "";
          const titleRaw = $a.attr("title") || $a.text().trim();
          const resolved = this.resolveAndFilter(href, titleRaw);
          if (!resolved) return;
          if (!results.find((r) => r.url === resolved.url)) {
            results.push({ title: resolved.title, url: resolved.url, description: "" });
          }
        });
      }

      return results.slice(0, 10);
    } catch (error) {
      throw new Error(`فشل البحث: ${error.message}`);
    }
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query)
      return res.status(400).json({ status: false, message: "⚠️ اسم التطبيق مطلوب (query)" });

    const traidSearch = new TraidModeSearch();
    const results = await traidSearch.search(query);

    if (!results || results.length === 0) {
      return res.status(404).json({ status: false, message: "❌ لم يتم العثور على نتائج" });
    }

    res.json({
      status: true,
      message: "✅ تم البحث بنجاح",
      query: query,
      count: results.length,
      results: results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء البحث",
      error: err.message,
    });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const query = req.query.query || req.query.q;

    if (!query)
      return res.status(400).json({ status: false, message: "⚠️ اسم التطبيق مطلوب (query أو q)" });

    const traidSearch = new TraidModeSearch();
    const results = await traidSearch.search(query);

    if (!results || results.length === 0) {
      return res.status(404).json({ status: false, message: "❌ لم يتم العثور على نتائج" });
    }

    res.json({
      status: true,
      message: "✅ تم البحث بنجاح",
      query: query,
      count: results.length,
      results: results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء البحث",
      error: err.message,
    });
  }
});

export default router;