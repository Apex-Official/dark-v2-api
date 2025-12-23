import express from "express";
import axios from "axios";
import FormDataPkg from "form-data";

const router = express.Router();
const FormData = FormDataPkg;

class PinterestLensAPI {
  constructor() {
    this.baseUrl = "https://api.pinterest.com/v3/visual_search/lens/search/";
    this.headers = {
      "User-Agent": "Pinterest for Android/13.46.4 (SM-A035F; 13)",
      "accept-language": "en-US",
      "x-pinterest-app-type-detailed": "3",
      "x-pinterest-device": "SM-A035F",
      "x-pinterest-webview-supported": "true",
      "x-pinterest-appstate": "active",
      "x-node-id": "true",
      authorization:
        "Bearer pina_AEATFWAVACMDGAYAGDAP6D67TA4UNGYBABHO3M5XFGHSUQWYSNO6UKXQPNPMK2FIUMRBNQTEPR3H6K2UXSKRIMMSNQ4WOXYA",
    };
  }

  async getImageBuffer(imageUrl) {
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    return Buffer.from(response.data);
  }

  async search(imageUrl, limit = 10) {
    if (!imageUrl) throw new Error("Image URL is required");

    const buffer = await this.getImageBuffer(imageUrl);

    const form = new FormData();
    form.append("image", buffer, {
      filename: "image.jpg",
      contentType: "image/jpeg",
    });
    form.append("camera_type", "0");
    form.append("source_type", "1");
    form.append("video_autoplay_disabled", "0");
    form.append("page_size", String(limit));
    form.append(
      "fields",
      "pin.{comment_count,is_eligible_for_related_products,type,image_crop,id,embed,grid_title,native_creator(),is_native,has_variants,is_premiere,done_by_me,dominant_color,domain,is_stale_product,collection_pin(),recommendation_reason,is_hidden,created_at,tracking_params,is_eligible_for_pdp,is_call_to_create,aggregated_pin_data(),is_repin,board(),pinner(),story_pin_data(),shopping_flags,carousel_data(),story_pin_data_id,call_to_create_responses_count,cacheable_id,is_full_width,is_video,call_to_action_text,link_domain(),music_attributions,is_promoted,link,sponsorship,is_unsafe,description,link_user_website(),title,is_cpc_ad,image_signature,alt_text,is_visualization_enabled,ip_eligible_for_stela,via_pinner,videos(),top_interest,category},user.{type,follower_count,explicitly_followed_by_me,is_default_image,save_behavior,is_partner,id,is_verified_merchant,first_name,show_creator_profile,last_name,is_private_profile,partner(),full_name,allow_idea_pin_downloads,image_medium_url,username,should_show_messaging},board.{privacy,type,url,layout,followed_by_me,tracking_params,owner(),name,section_count,id,category,created_at,has_custom_cover,image_cover_url,is_collaborative,collaborated_by_me,collaborating_users()},aggregatedpindata.{is_shop_the_look,comment_count,is_stela,has_xy_tags,did_it_data,aggregated_stats,id},pin.images[200x,236x,736x,290x]"
    );

    const { data } = await axios.post(this.baseUrl, form, {
      headers: {
        ...form.getHeaders(),
        ...this.headers,
      },
    });

    return this.formatResults(data);
  }

  formatResults(data) {
    if (!data?.data || data.data.length === 0) {
      return [];
    }

    return data.data.map((item) => {
      const image =
        item.images?.["736x"]?.url || item.images?.["236x"]?.url || null;
      const pinnerName =
        item.pinner?.full_name || item.pinner?.username || "غير معروف";
      const boardName = item.board?.name || "غير معروفة";
      const title = item.title || "بدون عنوان";
      const description = item.description || "لا يوجد وصف";
      const createdAt = item.created_at
        ? new Date(item.created_at).toLocaleDateString("ar-SA")
        : "غير متوفر";
      const saves = item.aggregated_pin_data?.aggregated_stats?.saves || 0;
      const comments = item.aggregated_pin_data?.comment_count || 0;
      const pinLink =
        item.link || `https://www.pinterest.com/pin/${item.id || item.cacheable_id}/`;

      return {
        id: item.id || item.cacheable_id,
        title,
        description,
        image,
        pinLink,
        pinner: {
          name: pinnerName,
          username: item.pinner?.username || null,
        },
        board: {
          name: boardName,
          url: item.board?.url || null,
        },
        stats: {
          saves,
          comments,
        },
        createdAt,
      };
    });
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { imageUrl, limit = 10 } = req.body;

    if (!imageUrl) {
      return res
        .status(400)
        .json({ status: false, message: "⚠️ رابط الصورة مطلوب (imageUrl)" });
    }

    const pinterest = new PinterestLensAPI();
    const results = await pinterest.search(imageUrl, limit);

    if (results.length === 0) {
      return res.status(404).json({
        status: false,
        message: "❌ لم يتم العثور على نتائج مشابهة على Pinterest",
      });
    }

    res.json({
      status: true,
      message: "✅ تم الحصول على النتائج بنجاح",
      count: results.length,
      results,
    });
  } catch (err) {
    console.error("❌ Pinterest Lens Error:", err);

    let errorMsg = "❌ حدث خطأ أثناء البحث في Pinterest Lens";
    let statusCode = 500;

    if (err.response) {
      statusCode = err.response.status;
      if (err.response.status === 401) {
        errorMsg = "⚠️ خطأ في المصادقة - يرجى تحديث التوكن";
      } else if (err.response.status === 429) {
        errorMsg = "⚠️ تم تجاوز حد الطلبات - حاول مرة أخرى لاحقاً";
        statusCode = 429;
      }
    }

    res.status(statusCode).json({
      status: false,
      message: errorMsg,
      error: err.message,
    });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const { imageUrl, limit = 10 } = req.query;

    if (!imageUrl) {
      return res
        .status(400)
        .json({ status: false, message: "⚠️ رابط الصورة مطلوب (imageUrl)" });
    }

    const pinterest = new PinterestLensAPI();
    const results = await pinterest.search(imageUrl, Number(limit));

    if (results.length === 0) {
      return res.status(404).json({
        status: false,
        message: "❌ لم يتم العثور على نتائج مشابهة على Pinterest",
      });
    }

    res.json({
      status: true,
      message: "✅ تم الحصول على النتائج بنجاح",
      count: results.length,
      results,
    });
  } catch (err) {
    console.error("❌ Pinterest Lens Error:", err);

    let errorMsg = "❌ حدث خطأ أثناء البحث في Pinterest Lens";
    let statusCode = 500;

    if (err.response) {
      statusCode = err.response.status;
      if (err.response.status === 401) {
        errorMsg = "⚠️ خطأ في المصادقة - يرجى تحديث التوكن";
      } else if (err.response.status === 429) {
        errorMsg = "⚠️ تم تجاوز حد الطلبات - حاول مرة أخرى لاحقاً";
        statusCode = 429;
      }
    }

    res.status(statusCode).json({
      status: false,
      message: errorMsg,
      error: err.message,
    });
  }
});

export default router;