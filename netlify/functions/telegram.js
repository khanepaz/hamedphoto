export default async (req) => {
    try {
        // فقط درخواست POST از Telegram را قبول می‌کنیم
        if (req.method !== "POST") {
            return new Response("Method Not Allowed", {
                status: 405
            });
        }

        // دریافت اطلاعات ارسالی Telegram
        const update = await req.json();

        console.log("Telegram update:", JSON.stringify(update));

        /*
         * اگر پیام شامل عکس باشد
         */
        if (update.message?.photo) {

            const photos = update.message.photo;

            // Telegram چند سایز از عکس می‌فرستد.
            // آخرین مورد معمولاً بزرگ‌ترین سایز است.
            const largestPhoto =
                photos[photos.length - 1];

            const photoInfo = {
                file_id: largestPhoto.file_id,
                width: largestPhoto.width,
                height: largestPhoto.height,

                message_id:
                    update.message.message_id,

                chat_id:
                    update.message.chat.id,

                date:
                    update.message.date,

                caption:
                    update.message.caption || ""
            };

            console.log(
                "New photo:",
                JSON.stringify(photoInfo)
            );

            /*
             * فعلاً فقط پاسخ موفق می‌دهیم.
             * در مرحله بعد اینجا ذخیره‌سازی عکس
             * و اتصال به سایت را اضافه می‌کنیم.
             */

            return new Response(
                JSON.stringify({
                    ok: true,
                    type: "photo",
                    photo: photoInfo
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


        /*
         * اگر پیام عکس نبود
         */
        return new Response(
            JSON.stringify({
                ok: true,
                type: "other"
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
                error: "Internal Server Error"
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
