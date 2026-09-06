
const TELEGRAM_API = "https://api.telegram.org/bot";

export default async (req) => {
    try {

        // فقط GET
        if (req.method !== "GET") {
            return new Response("Method Not Allowed", {
                status: 405
            });
        }

        // =====================================================
        // دریافت file_id از URL
        // مثال:
        // /.netlify/functions/image?file_id=XXXXXXXX
        // =====================================================

        const url = new URL(req.url);

        const fileId =
            url.searchParams.get("file_id");

        if (!fileId) {
            return new Response(
                "file_id is required",
                {
                    status: 400
                }
            );
        }

        // =====================================================
        // Telegram Bot Token
        // =====================================================

        const BOT_TOKEN =
            process.env.TELEGRAM_BOT_TOKEN;

        if (!BOT_TOKEN) {
            throw new Error(
                "TELEGRAM_BOT_TOKEN is not configured"
            );
        }

        // =====================================================
        // مرحله اول:
        // گرفتن file_path از Telegram
        // =====================================================

        const telegramResponse =
            await fetch(
                `${TELEGRAM_API}${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`
            );

        const telegramResult =
            await telegramResponse.json();

        if (!telegramResponse.ok ||
            !telegramResult.ok) {

            throw new Error(
                "Telegram getFile error: " +
                JSON.stringify(telegramResult)
            );
        }

        const filePath =
            telegramResult.result.file_path;

        if (!filePath) {
            throw new Error(
                "Telegram did not return file_path"
            );
        }

        // =====================================================
        // مرحله دوم:
        // دریافت فایل واقعی عکس از Telegram
        // =====================================================

        const imageResponse =
            await fetch(
                `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`
            );

        if (!imageResponse.ok) {

            throw new Error(
                `Telegram file error: ${imageResponse.status}`
            );
        }

        // =====================================================
        // نوع فایل
        // =====================================================

        const contentType =
            imageResponse.headers.get(
                "content-type"
            ) || "image/jpeg";

        // =====================================================
        // تبدیل به ArrayBuffer
        // =====================================================

        const imageBuffer =
            await imageResponse.arrayBuffer();

        // =====================================================
        // ارسال تصویر به مرورگر
        // =====================================================

        return new Response(
            imageBuffer,
            {
                status: 200,

                headers: {
                    "Content-Type":
                        contentType,

                    "Cache-Control":
                        "public, max-age=31536000, immutable"
                }
            }
        );

    } catch (error) {

        console.error(
            "Image function error:",
            error
        );

        return new Response(
            JSON.stringify({
                ok: false,
                error: error.message
            }),
            {
                status: 500,

                headers: {
                    "Content-Type":
                        "application/json"
                }
            }
        );
    }
};
