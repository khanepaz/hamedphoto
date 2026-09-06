const TELEGRAM_API = "https://api.telegram.org/bot";

export default async (req) => {
    try {

        // فقط POST
        if (req.method !== "POST") {
            return new Response("Method Not Allowed", {
                status: 405
            });
        }

        // دریافت Update از Telegram
        const update = await req.json();

        console.log(
            "Telegram update:",
            JSON.stringify(update)
        );

        // =====================================================
        // دریافت Chat ID کانال با کلیدواژه مخصوص
        // =====================================================

        if (update.channel_post) {

            const channelPost = update.channel_post;

            const channelId = channelPost.chat?.id;

            const text =
                channelPost.text ||
                channelPost.caption ||
                "";

            // فقط وقتی کلیدواژه مخصوص ارسال شود
            if (text.trim() === "#GET_CHANNEL_ID") {

                const BOT_TOKEN =
                    process.env.TELEGRAM_BOT_TOKEN;

                if (!BOT_TOKEN) {
                    throw new Error(
                        "TELEGRAM_BOT_TOKEN is not configured"
                    );
                }

                // ارسال Chat ID داخل خود کانال
                const response =
                    await fetch(
                        `${TELEGRAM_API}${BOT_TOKEN}/sendMessage`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({
                                chat_id: channelId,

                                text:
                                    `Chat ID این کانال:\n\n${channelId}`
                            })
                        }
                    );

                const result =
                    await response.json();

                if (!result.ok) {
                    throw new Error(
                        "Cannot send Chat ID to channel: " +
                        JSON.stringify(result)
                    );
                }

                return new Response(
                    JSON.stringify({
                        ok: true,
                        channel_id: channelId
                    }),
                    {
                        status: 200,

                        headers: {
                            "Content-Type":
                                "application/json"
                        }
                    }
                );
            }

            // سایر پیام‌های کانال نادیده گرفته شوند
            return new Response(
                JSON.stringify({
                    ok: true,
                    message:
                        "Channel post ignored"
                }),
                {
                    status: 200,

                    headers: {
                        "Content-Type":
                            "application/json"
                    }
                }
            );
        }

        // =====================================================
        // فقط پیام‌های دارای عکس از کاربر
        // =====================================================

        if (!update.message?.photo) {

            return new Response(
                JSON.stringify({
                    ok: true,
                    message: "No photo"
                }),
                {
                    status: 200,

                    headers: {
                        "Content-Type":
                            "application/json"
                    }
                }
            );
        }

        // =====================================================
        // Environment Variables
        // =====================================================

        const BOT_TOKEN =
            process.env.TELEGRAM_BOT_TOKEN;

        const CHANNEL_ID =
            process.env.TELEGRAM_CHANNEL_ID;

        const GITHUB_TOKEN =
            process.env.GITHUB_TOKEN;

        const GITHUB_REPO =
            process.env.GITHUB_REPO;

        const GITHUB_BRANCH =
            process.env.GITHUB_BRANCH || "main";

        if (
            !BOT_TOKEN ||
            !CHANNEL_ID ||
            !GITHUB_TOKEN ||
            !GITHUB_REPO
        ) {
            throw new Error(
                "Environment Variables are not configured"
            );
        }

        // =====================================================
        // بزرگ‌ترین نسخه عکس
        // =====================================================

        const photos =
            update.message.photo;

        const largestPhoto =
            photos[photos.length - 1];

        const fileId =
            largestPhoto.file_id;

        // Caption
        const caption =
            update.message.caption || "";

        // =====================================================
        // ارسال عکس به کانال
        // =====================================================

        const sendPhotoResponse =
            await fetch(
                `${TELEGRAM_API}${BOT_TOKEN}/sendPhoto`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        chat_id: CHANNEL_ID,
                        photo: fileId,
                        caption: caption
                    })
                }
            );

        const sendPhotoResult =
            await sendPhotoResponse.json();

        if (!sendPhotoResult.ok) {

            throw new Error(
                "Telegram channel error: " +
                JSON.stringify(sendPhotoResult)
            );
        }

        console.log(
            "Photo saved to Telegram channel"
        );

        // =====================================================
        // اطلاعات عکس
        // =====================================================

        const imageRecord = {

            id: String(
                update.message.message_id
            ),

            file_id: fileId,

            width:
                largestPhoto.width,

            height:
                largestPhoto.height,

            caption:
                caption,

            created_at:
                new Date().toISOString()
        };

        // =====================================================
        // خواندن images.json از GitHub
        // =====================================================

        const githubFileUrl =
            `https://api.github.com/repos/${GITHUB_REPO}/contents/data/images.json?ref=${GITHUB_BRANCH}`;

        const getFileResponse =
            await fetch(
                githubFileUrl,
                {
                    headers: {

                        "Authorization":
                            `Bearer ${GITHUB_TOKEN}`,

                        "Accept":
                            "application/vnd.github+json",

                        "X-GitHub-Api-Version":
                            "2022-11-28"
                    }
                }
            );

        if (!getFileResponse.ok) {

            throw new Error(
                "Cannot read images.json from GitHub"
            );
        }

        const githubFile =
            await getFileResponse.json();

        // =====================================================
        // Decode کردن فایل
        // =====================================================

        const currentContent =
            Buffer.from(
                githubFile.content,
                "base64"
            ).toString("utf-8");

        const data =
            JSON.parse(currentContent);

        if (!Array.isArray(data.images)) {
            data.images = [];
        }

        // اضافه کردن عکس جدید
        data.images.push(
            imageRecord
        );

        // =====================================================
        // تبدیل دوباره به JSON
        // =====================================================

        const newContent =
            JSON.stringify(
                data,
                null,
                2
            );

        const encodedContent =
            Buffer.from(
                newContent,
                "utf-8"
            ).toString("base64");

        // =====================================================
        // آپدیت images.json در GitHub
        // =====================================================

        const updateResponse =
            await fetch(
                `https://api.github.com/repos/${GITHUB_REPO}/contents/data/images.json`,
                {
                    method: "PUT",

                    headers: {

                        "Authorization":
                            `Bearer ${GITHUB_TOKEN}`,

                        "Accept":
                            "application/vnd.github+json",

                        "Content-Type":
                            "application/json",

                        "X-GitHub-Api-Version":
                            "2022-11-28"
                    },

                    body: JSON.stringify({

                        message:
                            `Add Telegram image ${imageRecord.id}`,

                        content:
                            encodedContent,

                        sha:
                            githubFile.sha,

                        branch:
                            GITHUB_BRANCH
                    })
                }
            );

        const updateResult =
            await updateResponse.json();

        if (!updateResponse.ok) {

            throw new Error(
                "GitHub update error: " +
                JSON.stringify(updateResult)
            );
        }

        console.log(
            "images.json updated successfully"
        );

        // =====================================================
        // پاسخ نهایی
        // =====================================================

        return new Response(
            JSON.stringify({

                ok: true,

                message:
                    "Image received and saved",

                image:
                    imageRecord
            }),
            {
                status: 200,

                headers: {
                    "Content-Type":
                        "application/json"
                }
            }
        );

    } catch (error) {

        console.error(
            "Telegram function error:",
            error
        );

        return new Response(
            JSON.stringify({

                ok: false,

                error:
                    error.message
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
