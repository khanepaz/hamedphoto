const TELEGRAM_API = "https://api.telegram.org/bot";


// ============================================================
// تنظیمات
// ============================================================

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


// ============================================================
// Admin IDs
// ============================================================

function getAdminIds() {

    return (process.env.TELEGRAM_ADMIN_IDS || "")
        .split(",")
        .map(id => id.trim())
        .filter(Boolean);

}


// ============================================================
// Telegram API
// ============================================================

async function telegram(method, body) {

    const response =
        await fetch(
            `${TELEGRAM_API}${BOT_TOKEN}/${method}`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(body)
            }
        );

    const result =
        await response.json();

    if (!response.ok || !result.ok) {

        throw new Error(
            `Telegram ${method} error: ` +
            JSON.stringify(result)
        );

    }

    return result.result;

}


// ============================================================
// بررسی Admin
// ============================================================

function isAdmin(userId) {

    const admins =
        getAdminIds();

    return admins.includes(
        String(userId)
    );

}


// ============================================================
// GitHub URL
// ============================================================

function githubFileUrl() {

    return (
        `https://api.github.com/repos/` +
        `${GITHUB_REPO}/contents/data/images.json` +
        `?ref=${GITHUB_BRANCH}`
    );

}


// ============================================================
// خواندن images.json
// ============================================================

async function readImages() {

    const response =
        await fetch(
            githubFileUrl(),
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


    if (!response.ok) {

        const text =
            await response.text();

        throw new Error(
            `GitHub read error (${response.status}): ${text}`
        );

    }


    const file =
        await response.json();


    const content =
        Buffer.from(
            file.content,
            "base64"
        ).toString("utf-8");


    const data =
        JSON.parse(content);


    if (!Array.isArray(data.images)) {

        data.images = [];

    }


    return {
        data,
        sha: file.sha
    };

}


// ============================================================
// ذخیره images.json
// ============================================================

async function writeImages(data, sha, message) {

    const content =
        JSON.stringify(
            data,
            null,
            2
        );


    const encodedContent =
        Buffer.from(
            content,
            "utf-8"
        ).toString("base64");


    const response =
        await fetch(
            `https://api.github.com/repos/` +
            `${GITHUB_REPO}/contents/data/images.json`,
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

                body:
                    JSON.stringify({

                        message,

                        content:
                            encodedContent,

                        sha,

                        branch:
                            GITHUB_BRANCH

                    })

            }
        );


    const result =
        await response.json();


    if (!response.ok) {

        throw new Error(
            "GitHub update error: " +
            JSON.stringify(result)
        );

    }


    return result;

}


// ============================================================
// ساخت منوی اصلی
// ============================================================

function mainMenu() {

    return {

        inline_keyboard: [

            [
                {
                    text: "➕ افزودن تصویر",
                    callback_data: "ADD_IMAGE"
                }
            ],

            [
                {
                    text: "🖼 مدیریت تصاویر",
                    callback_data: "MANAGE_IMAGES"
                }
            ],

            [
                {
                    text: "📂 دسته‌بندی‌ها",
                    callback_data: "CATEGORIES"
                }
            ],

            [
                {
                    text: "ℹ️ راهنما",
                    callback_data: "HELP"
                }

            ]

        ]

    };

}


// ============================================================
// منوی مدیریت
// ============================================================

function managementMenu() {

    return {

        inline_keyboard: [

            [
                {
                    text: "➕ افزودن تصویر",
                    callback_data: "ADD_IMAGE"
                }
            ],

            [
                {
                    text: "🗑 حذف تصویر",
                    callback_data: "DELETE_IMAGE"
                }
            ],

            [
                {
                    text: "✏️ ویرایش تصویر",
                    callback_data: "EDIT_IMAGE"
                }
            ],

            [
                {
                    text: "📋 لیست تصاویر",
                    callback_data: "LIST_IMAGES"
                }
            ],

            [
                {
                    text: "🔙 منوی اصلی",
                    callback_data: "MAIN_MENU"
                }

            ]

        ]

    };

}


// ============================================================
// ارسال منوی اصلی
// ============================================================

async function sendMainMenu(chatId) {

    return telegram(
        "sendMessage",
        {

            chat_id:
                chatId,

            text:
                "🖼 *Hamed Photo*\n\n" +
                "به پنل مدیریت تصاویر خوش آمدید.\n\n" +
                "لطفاً یک گزینه را انتخاب کنید:",

            parse_mode:
                "Markdown",

            reply_markup:
                mainMenu()

        }
    );

}


// ============================================================
// حذف کیبورد قبلی
// ============================================================

async function answerCallback(callbackId) {

    try {

        await telegram(
            "answerCallbackQuery",
            {
                callback_query_id:
                    callbackId
            }
        );

    } catch (error) {

        console.error(
            "answerCallbackQuery error:",
            error
        );

    }

}


// ============================================================
// استخراج عکس
// ============================================================

function getLargestPhoto(photoArray) {

    if (
        !Array.isArray(photoArray) ||
        photoArray.length === 0
    ) {
        return null;
    }


    return photoArray[
        photoArray.length - 1
    ];

}


// ============================================================
// Handler
// ============================================================

export default async (req) => {

    try {

        // ========================================================
        // فقط POST
        // ========================================================

        if (req.method !== "POST") {

            return new Response(
                "Method Not Allowed",
                {
                    status: 405
                }
            );

        }


        // ========================================================
        // Update
        // ========================================================

        const update =
            await req.json();


        console.log(
            "Telegram update:",
            JSON.stringify(update)
        );


        // ========================================================
        // بررسی Environment
        // ========================================================

        if (
            !BOT_TOKEN ||
            !CHANNEL_ID ||
            !GITHUB_TOKEN ||
            !GITHUB_REPO
        ) {

            throw new Error(
                "Required Environment Variables are not configured"
            );

        }


        // ========================================================
        // CHANNEL POST
        // ========================================================

        if (update.channel_post) {

            const channelPost =
                update.channel_post;


            const text =
                channelPost.text ||
                channelPost.caption ||
                "";


            const channelId =
                channelPost.chat?.id;


            // -----------------------------------------------
            // ابزار موقت دریافت Channel ID
            // -----------------------------------------------

            if (
                text.trim() ===
                "#GET_CHANNEL_ID"
            ) {

                await telegram(
                    "sendMessage",
                    {

                        chat_id:
                            channelId,

                        text:
                            `Chat ID این کانال:\n\n${channelId}`

                    }
                );


                return new Response(
                    JSON.stringify({
                        ok: true
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


        // ========================================================
        // CALLBACK QUERY
        // ========================================================

        if (update.callback_query) {

            const callback =
                update.callback_query;


            const userId =
                callback.from?.id;


            const chatId =
                callback.message?.chat?.id;


            const action =
                callback.data;


            await answerCallback(
                callback.id
            );


            // -----------------------------------------------
            // بررسی دسترسی
            // -----------------------------------------------

            if (!isAdmin(userId)) {

                await telegram(
                    "sendMessage",
                    {

                        chat_id:
                            chatId,

                        text:
                            "⛔ شما اجازه دسترسی به پنل مدیریت را ندارید."

                    }
                );


                return new Response(
                    JSON.stringify({
                        ok: true
                    }),
                    {
                        status: 200
                    }
                );

            }


            // -----------------------------------------------
            // منوی اصلی
            // -----------------------------------------------

            if (
                action ===
                "MAIN_MENU"
            ) {

                await sendMainMenu(
                    chatId
                );

            }


            // -----------------------------------------------
            // افزودن تصویر
            // -----------------------------------------------

            else if (
                action ===
                "ADD_IMAGE"
            ) {

                await telegram(
                    "sendMessage",
                    {

                        chat_id:
                            chatId,

                        text:
                            "📸 لطفاً تصویر موردنظر را ارسال کنید.\n\n" +
                            "بعد از دریافت تصویر، نام و دسته‌بندی آن را از شما می‌خواهم.\n\n" +
                            "برای لغو، /cancel را ارسال کنید."

                    }
                );

            }


            // -----------------------------------------------
            // مدیریت تصاویر
            // -----------------------------------------------

            else if (
                action ===
                "MANAGE_IMAGES"
            ) {

                await telegram(
                    "sendMessage",
                    {

                        chat_id:
                            chatId,

                        text:
                            "🖼 مدیریت تصاویر\n\n" +
                            "یکی از گزینه‌های زیر را انتخاب کنید:",

                        reply_markup:
                            managementMenu()

                    }
                );

            }


            // -----------------------------------------------
            // لیست تصاویر
            // -----------------------------------------------

            else if (
                action ===
                "LIST_IMAGES"
            ) {

                const {
                    data
                } =
                    await readImages();


                if (
                    data.images.length === 0
                ) {

                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text:
                                "📭 هنوز تصویری ثبت نشده است."

                        }
                    );

                } else {

                    let text =
                        "🖼 *لیست تصاویر*\n\n";


                    data.images
                        .slice()
                        .reverse()
                        .slice(0, 30)
                        .forEach(
                            (image, index) => {

                                const name =
                                    image.name ||
                                    "بدون نام";

                                const categories =
                                    Array.isArray(
                                        image.categories
                                    )
                                        ? image.categories.join(
                                            "، "
                                        )
                                        : (
                                            image.category ||
                                            "بدون دسته‌بندی"
                                        );


                                text +=
                                    `${index + 1}. ${name}\n` +
                                    `📂 ${categories}\n\n`;

                            }
                        );


                    if (
                        data.images.length > 30
                    ) {

                        text +=
                            `\n... و ${data.images.length - 30} تصویر دیگر`;

                    }


                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text,

                            parse_mode:
                                "Markdown"

                        }
                    );

                }

            }


            // -----------------------------------------------
            // دسته‌بندی‌ها
            // -----------------------------------------------

            else if (
                action ===
                "CATEGORIES"
            ) {

                const {
                    data
                } =
                    await readImages();


                const categorySet =
                    new Set();


                data.images.forEach(
                    image => {

                        if (
                            Array.isArray(
                                image.categories
                            )
                        ) {

                            image.categories
                                .forEach(
                                    category => {

                                        if (
                                            category &&
                                            category.trim()
                                        ) {

                                            categorySet.add(
                                                category.trim()
                                            );

                                        }

                                    }
                                );

                        } else if (
                            image.category
                        ) {

                            categorySet.add(
                                image.category.trim()
                            );

                        }

                    }
                );


                const categories =
                    Array.from(
                        categorySet
                    ).sort();


                if (
                    categories.length === 0
                ) {

                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text:
                                "📂 هنوز دسته‌بندی‌ای ثبت نشده است."

                        }
                    );

                } else {

                    let text =
                        "📂 *دسته‌بندی‌ها*\n\n";


                    categories.forEach(
                        (category, index) => {

                            text +=
                                `${index + 1}. ${category}\n`;

                        }
                    );


                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text,

                            parse_mode:
                                "Markdown"

                        }
                    );

                }

            }


            // -----------------------------------------------
            // حذف تصویر
            // -----------------------------------------------

            else if (
                action ===
                "DELETE_IMAGE"
            ) {

                const {
                    data
                } =
                    await readImages();


                if (
                    data.images.length === 0
                ) {

                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text:
                                "📭 تصویری برای حذف وجود ندارد."

                        }
                    );

                } else {

                    const keyboard =
                        data.images
                            .slice()
                            .reverse()
                            .slice(0, 30)
                            .map(
                                image => [

                                    {
                                        text:
                                            `🗑 ${image.name || "بدون نام"}`,

                                        callback_data:
                                            `DELETE_CONFIRM_${image.id}`

                                    }

                                ]
                            );


                    keyboard.push(
                        [
                            {
                                text:
                                    "🔙 برگشت",

                                callback_data:
                                    "MANAGE_IMAGES"

                            }
                        ]
                    );


                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text:
                                "🗑 تصویر موردنظر برای حذف را انتخاب کنید:",

                            reply_markup: {
                                inline_keyboard:
                                    keyboard
                            }

                        }
                    );

                }

            }


            // -----------------------------------------------
            // تأیید حذف
            // -----------------------------------------------

            else if (
                action.startsWith(
                    "DELETE_CONFIRM_"
                )
            ) {

                const imageId =
                    action.replace(
                        "DELETE_CONFIRM_",
                        ""
                    );


                const {
                    data
                } =
                    await readImages();


                const image =
                    data.images.find(
                        item =>
                            String(item.id) ===
                            String(imageId)
                    );


                if (!image) {

                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text:
                                "❌ تصویر پیدا نشد."

                        }
                    );

                } else {

                    const categories =
                        Array.isArray(
                            image.categories
                        )
                            ? image.categories.join("، ")
                            : (
                                image.category ||
                                "بدون دسته‌بندی"
                            );


                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text:
                                "⚠️ *آیا مطمئن هستید؟*\n\n" +
                                `🖼 نام: ${image.name || "بدون نام"}\n` +
                                `📂 دسته‌بندی: ${categories}`,

                            parse_mode:
                                "Markdown",

                            reply_markup: {

                                inline_keyboard: [

                                    [
                                        {
                                            text:
                                                "❌ بله، حذف شود",

                                            callback_data:
                                                `DELETE_FINAL_${image.id}`

                                        },

                                        {
                                            text:
                                                "↩️ انصراف",

                                            callback_data:
                                                "MANAGE_IMAGES"

                                        }

                                    ]

                                ]

                            }

                        }
                    );

                }

            }


            // -----------------------------------------------
            // حذف نهایی
            // -----------------------------------------------

            else if (
                action.startsWith(
                    "DELETE_FINAL_"
                )
            ) {

                const imageId =
                    action.replace(
                        "DELETE_FINAL_",
                        ""
                    );


                const {
                    data,
                    sha
                } =
                    await readImages();


                const index =
                    data.images.findIndex(
                        item =>
                            String(item.id) ===
                            String(imageId)
                    );


                if (index === -1) {

                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text:
                                "❌ تصویر پیدا نشد."

                        }
                    );

                } else {

                    const image =
                        data.images[index];


                    // ---------------------------------------
                    // حذف پیام از کانال
                    // ---------------------------------------

                    if (
                        image.telegram_message_id
                    ) {

                        try {

                            await telegram(
                                "deleteMessage",
                                {

                                    chat_id:
                                        CHANNEL_ID,

                                    message_id:
                                        image.telegram_message_id

                                }
                            );

                        } catch (deleteError) {

                            console.error(
                                "Channel delete error:",
                                deleteError
                            );

                        }

                    }


                    // ---------------------------------------
                    // حذف از JSON
                    // ---------------------------------------

                    data.images.splice(
                        index,
                        1
                    );


                    await writeImages(
                        data,
                        sha,
                        `Delete image ${imageId}`
                    );


                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text:
                                "✅ تصویر با موفقیت حذف شد.\n\n" +
                                "تصویر از گالری حذف شد."

                        }
                    );

                }

            }


            // -----------------------------------------------
            // ویرایش
            // -----------------------------------------------

            else if (
                action ===
                "EDIT_IMAGE"
            ) {

                const {
                    data
                } =
                    await readImages();


                if (
                    data.images.length === 0
                ) {

                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text:
                                "📭 تصویری برای ویرایش وجود ندارد."

                        }
                    );

                } else {

                    const keyboard =
                        data.images
                            .slice()
                            .reverse()
                            .slice(0, 30)
                            .map(
                                image => [

                                    {
                                        text:
                                            `✏️ ${image.name || "بدون نام"}`,

                                        callback_data:
                                            `EDIT_SELECT_${image.id}`

                                    }

                                ]
                            );


                    keyboard.push(
                        [
                            {
                                text:
                                    "🔙 برگشت",

                                callback_data:
                                    "MANAGE_IMAGES"

                            }
                        ]
                    );


                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text:
                                "✏️ تصویر موردنظر برای ویرایش را انتخاب کنید:",

                            reply_markup: {
                                inline_keyboard:
                                    keyboard
                            }

                        }
                    );

                }

            }


            // -----------------------------------------------
            // انتخاب تصویر برای ویرایش
            // -----------------------------------------------

            else if (
                action.startsWith(
                    "EDIT_SELECT_"
                )
            ) {

                const imageId =
                    action.replace(
                        "EDIT_SELECT_",
                        ""
                    );


                await telegram(
                    "sendMessage",
                    {

                        chat_id:
                            chatId,

                        text:
                            "✏️ اطلاعات جدید تصویر را در یک پیام ارسال کنید.\n\n" +
                            "فرمت:\n\n" +
                            "نام تصویر | دسته‌بندی\n\n" +
                            "مثال:\n" +
                            "نمایشگاه تهران | نمایشگاه\n\n" +
                            "برای چند دسته‌بندی:\n" +
                            "نمایشگاه تهران | نمایشگاه, محصولات, 1405\n\n" +
                            `شناسه تصویر: ${imageId}\n\n` +
                            "برای لغو /cancel را ارسال کنید."

                    }
                );

            }


            // -----------------------------------------------
            // راهنما
            // -----------------------------------------------

            else if (
                action ===
                "HELP"
            ) {

                await telegram(
                    "sendMessage",
                    {

                        chat_id:
                            chatId,

                        text:
                            "ℹ️ *راهنمای Hamed Photo*\n\n" +

                            "➕ افزودن تصویر:\n" +
                            "تصویر را ارسال می‌کنید، سپس نام و دسته‌بندی تعیین می‌شود.\n\n" +

                            "🗑 حذف تصویر:\n" +
                            "تصویر را از لیست انتخاب کرده و حذف می‌کنید.\n\n" +

                            "✏️ ویرایش:\n" +
                            "نام و دسته‌بندی تصویر قابل تغییر است.\n\n" +

                            "📂 دسته‌بندی:\n" +
                            "هر تصویر باید حداقل یک دسته‌بندی داشته باشد.",

                        parse_mode:
                            "Markdown"

                    }
                );

            }


            return new Response(
                JSON.stringify({
                    ok: true
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


        // ========================================================
        // MESSAGE
        // ========================================================

        if (update.message) {

            const message =
                update.message;


            const chatId =
                message.chat?.id;


            const userId =
                message.from?.id;


            // -----------------------------------------------
            // /start
            // -----------------------------------------------

            if (
                message.text?.trim() ===
                "/start"
            ) {

                if (
                    !isAdmin(userId)
                ) {

                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text:
                                "⛔ شما اجازه دسترسی به پنل مدیریت را ندارید."

                        }
                    );

                } else {

                    await sendMainMenu(
                        chatId
                    );

                }


                return new Response(
                    JSON.stringify({
                        ok: true
                    }),
                    {
                        status: 200
                    }
                );

            }


            // -----------------------------------------------
            // /myid
            // -----------------------------------------------

            if (
                message.text?.trim() ===
                "/myid"
            ) {

                await telegram(
                    "sendMessage",
                    {

                        chat_id:
                            chatId,

                        text:
                            `Telegram User ID شما:\n\n${userId}`

                    }
                );


                return new Response(
                    JSON.stringify({
                        ok: true
                    }),
                    {
                        status: 200
                    }
                );

            }


            // -----------------------------------------------
            // /cancel
            // -----------------------------------------------

            if (
                message.text?.trim() ===
                "/cancel"
            ) {

                if (
                    isAdmin(userId)
                ) {

                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text:
                                "❌ عملیات لغو شد."

                        }
                    );


                    await sendMainMenu(
                        chatId
                    );

                }


                return new Response(
                    JSON.stringify({
                        ok: true
                    }),
                    {
                        status: 200
                    }
                );

            }


            // -----------------------------------------------
            // پیام دارای عکس
            // -----------------------------------------------

            if (
                message.photo
            ) {

                if (
                    !isAdmin(userId)
                ) {

                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text:
                                "⛔ شما اجازه افزودن تصویر ندارید."

                        }
                    );


                    return new Response(
                        JSON.stringify({
                            ok: true
                        }),
                        {
                            status: 200
                        }
                    );

                }


                const photo =
                    getLargestPhoto(
                        message.photo
                    );


                if (!photo) {

                    throw new Error(
                        "Photo data is missing"
                    );

                }


                const fileId =
                    photo.file_id;


                const caption =
                    message.caption ||
                    "";


                // -------------------------------------------
                // ارسال به کانال
                // -------------------------------------------

                const channelMessage =
                    await telegram(
                        "sendPhoto",
                        {

                            chat_id:
                                CHANNEL_ID,

                            photo:
                                fileId,

                            caption:
                                caption

                        }
                    );


                // -------------------------------------------
                // خواندن JSON
                // -------------------------------------------

                const {
                    data,
                    sha
                } =
                    await readImages();


                // -------------------------------------------
                // ID جدید
                // -------------------------------------------

                const newId =
                    String(
                        Date.now()
                    );


                // -------------------------------------------
                // فعلاً نام و دسته‌بندی
                // از caption گرفته می‌شود
                //
                // فرمت:
                // نام | دسته بندی
                // -------------------------------------------

                let name =
                    "";


                let categories =
                    [];


                if (
                    caption.includes("|")
                ) {

                    const parts =
                        caption.split("|");


                    name =
                        parts[0].trim();


                    categories =
                        parts
                            .slice(1)
                            .join("|")
                            .split(",")
                            .map(
                                item =>
                                    item.trim()
                            )
                            .filter(Boolean);

                }


                // -------------------------------------------
                // اگر اطلاعات ناقص باشد
                // عکس در کانال هست ولی در JSON
                // به صورت incomplete ثبت می‌شود.
                // -------------------------------------------

                const imageRecord = {

                    id:
                        newId,

                    file_id:
                        fileId,

                    telegram_message_id:
                        channelMessage.message_id,

                    name:
                        name,

                    categories:
                        categories,

                    caption:
                        caption,

                    width:
                        photo.width,

                    height:
                        photo.height,

                    created_at:
                        new Date().toISOString()

                };


                data.images.push(
                    imageRecord
                );


                await writeImages(
                    data,
                    sha,
                    `Add image ${newId}`
                );


                // -------------------------------------------
                // پاسخ
                // -------------------------------------------

                if (
                    name &&
                    categories.length > 0
                ) {

                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text:
                                "✅ تصویر با موفقیت ثبت شد.\n\n" +
                                `🖼 نام: ${name}\n` +
                                `📂 دسته‌بندی: ${categories.join("، ")}`

                        }
                    );

                } else {

                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text:
                                "⚠️ تصویر دریافت و ذخیره شد، اما نام یا دسته‌بندی کامل نیست.\n\n" +
                                "برای نسخه بعدی این مرحله را کاملاً مرحله‌ای و دکمه‌ای می‌کنیم."

                        }
                    );

                }


                return new Response(
                    JSON.stringify({
                        ok: true,
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

            }


            // -----------------------------------------------
            // پیام متنی معمولی
            // -----------------------------------------------

            if (
                message.text
            ) {

                if (
                    isAdmin(userId)
                ) {

                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text:
                                "از منوی /start استفاده کنید."

                        }
                    );

                }


                return new Response(
                    JSON.stringify({
                        ok: true
                    }),
                    {
                        status: 200
                    }
                );

            }

        }


        // ========================================================
        // پاسخ عمومی
        // ========================================================

        return new Response(
            JSON.stringify({
                ok: true
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
