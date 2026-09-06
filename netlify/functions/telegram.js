const TELEGRAM_API = "https://api.telegram.org/bot";


// ============================================================
// Environment Variables
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


function isAdmin(userId) {

    return getAdminIds().includes(
        String(userId)
    );

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
// Callback پاسخ
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
            "Callback answer error:",
            error
        );

    }

}


// ============================================================
// GitHub Headers
// ============================================================

function githubHeaders() {

    return {

        "Authorization":
            `Bearer ${GITHUB_TOKEN}`,

        "Accept":
            "application/vnd.github+json",

        "X-GitHub-Api-Version":
            "2022-11-28"

    };

}


// ============================================================
// GitHub File URL
// ============================================================

function githubFileUrl(path) {

    return (
        `https://api.github.com/repos/` +
        `${GITHUB_REPO}/contents/${path}` +
        `?ref=${GITHUB_BRANCH}`
    );

}


// ============================================================
// خواندن فایل JSON از GitHub
// ============================================================

async function readGithubJson(path) {

    const response =
        await fetch(
            githubFileUrl(path),
            {
                headers:
                    githubHeaders()
            }
        );


    if (!response.ok) {

        const errorText =
            await response.text();

        throw new Error(
            `GitHub read error (${response.status}): ${errorText}`
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


    return {

        data,

        sha:
            file.sha

    };

}


// ============================================================
// نوشتن فایل JSON در GitHub
// ============================================================

async function writeGithubJson(
    path,
    data,
    sha,
    message
) {

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
            `${GITHUB_REPO}/contents/${path}`,
            {
                method: "PUT",

                headers: {

                    ...githubHeaders(),

                    "Content-Type":
                        "application/json"

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
            "GitHub write error: " +
            JSON.stringify(result)
        );

    }


    return result;

}


// ============================================================
// Images JSON
// ============================================================

async function readImages() {

    return readGithubJson(
        "data/images.json"
    );

}


// ============================================================
// Sessions JSON
// ============================================================

async function readSessions() {

    try {

        return await readGithubJson(
            "data/sessions.json"
        );

    } catch (error) {

        /*
         اگر فایل sessions.json هنوز ساخته نشده باشد،
         ساختار اولیه را برمی‌گردانیم.
        */

        console.error(
            "Sessions read error:",
            error
        );


        return {

            data: {
                sessions: {}
            },

            sha: null

        };

    }

}


// ============================================================
// ذخیره Session
// ============================================================

async function saveSessions(
    data,
    sha,
    message
) {

    if (!data.sessions) {

        data.sessions = {};

    }


    /*
      اگر فایل وجود نداشته باشد
      باید PUT بدون sha انجام شود.
    */

    if (!sha) {

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
                `${GITHUB_REPO}/contents/data/sessions.json`,
                {
                    method: "PUT",

                    headers: {

                        ...githubHeaders(),

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            message,

                            content:
                                encodedContent,

                            branch:
                                GITHUB_BRANCH

                        })

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                "GitHub sessions create error: " +
                JSON.stringify(result)
            );

        }


        return result;

    }


    return writeGithubJson(
        "data/sessions.json",
        data,
        sha,
        message
    );

}


// ============================================================
// Main Menu
// ============================================================

function mainMenu() {

    return {

        inline_keyboard: [

            [
                {
                    text:
                        "➕ افزودن تصویر",

                    callback_data:
                        "ADD_IMAGE"
                }
            ],

            [
                {
                    text:
                        "🖼 مدیریت تصاویر",

                    callback_data:
                        "MANAGE_IMAGES"
                }
            ],

            [
                {
                    text:
                        "📂 دسته‌بندی‌ها",

                    callback_data:
                        "CATEGORIES"
                }
            ],

            [
                {
                    text:
                        "ℹ️ راهنما",

                    callback_data:
                        "HELP"
                }
            ]

        ]

    };

}


// ============================================================
// Management Menu
// ============================================================

function managementMenu() {

    return {

        inline_keyboard: [

            [
                {
                    text:
                        "➕ افزودن تصویر",

                    callback_data:
                        "ADD_IMAGE"
                }
            ],

            [
                {
                    text:
                        "🗑 حذف تصویر",

                    callback_data:
                        "DELETE_IMAGE"
                }
            ],

            [
                {
                    text:
                        "✏️ ویرایش تصویر",

                    callback_data:
                        "EDIT_IMAGE"
                }
            ],

            [
                {
                    text:
                        "📋 لیست تصاویر",

                    callback_data:
                        "LIST_IMAGES"
                }
            ],

            [
                {
                    text:
                        "🔙 منوی اصلی",

                    callback_data:
                        "MAIN_MENU"
                }
            ]

        ]

    };

}


// ============================================================
// Send Main Menu
// ============================================================

async function sendMainMenu(chatId) {

    await telegram(
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
// Cancel Session
// ============================================================

async function cancelSession(userId) {

    const {
        data,
        sha
    } =
        await readSessions();


    if (
        data.sessions &&
        data.sessions[String(userId)]
    ) {

        delete data.sessions[
            String(userId)
        ];


        await saveSessions(
            data,
            sha,
            `Cancel session ${userId}`
        );

    }

}


// ============================================================
// دریافت Session کاربر
// ============================================================

async function getSession(userId) {

    const {
        data
    } =
        await readSessions();


    if (!data.sessions) {

        data.sessions = {};

    }


    return (
        data.sessions[
            String(userId)
        ] || null
    );

}


// ============================================================
// ذخیره Session کاربر
// ============================================================

async function setSession(
    userId,
    session
) {

    const {
        data,
        sha
    } =
        await readSessions();


    if (!data.sessions) {

        data.sessions = {};

    }


    data.sessions[
        String(userId)
    ] =
        session;


    await saveSessions(
        data,
        sha,
        `Update session ${userId}`
    );

}


// ============================================================
// حذف Session کاربر
// ============================================================

async function deleteSession(userId) {

    const {
        data,
        sha
    } =
        await readSessions();


    if (!data.sessions) {

        return;

    }


    delete data.sessions[
        String(userId)
    ];


    await saveSessions(
        data,
        sha,
        `Delete session ${userId}`
    );

}


// ============================================================
// بزرگ‌ترین نسخه عکس
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
// شروع افزودن تصویر
// ============================================================

async function startAddImage(chatId) {

    await telegram(
        "sendMessage",
        {

            chat_id:
                chatId,

            text:
                "➕ *افزودن تصویر*\n\n" +
                "📸 لطفاً تصویر موردنظر را ارسال کنید.\n\n" +
                "بعد از ارسال تصویر، نام و دسته‌بندی آن را از شما می‌پرسم.\n\n" +
                "❌ برای لغو: /cancel",

            parse_mode:
                "Markdown"

        }
    );

}


// ============================================================
// درخواست نام
// ============================================================

async function askImageName(chatId) {

    await telegram(
        "sendMessage",
        {

            chat_id:
                chatId,

            text:
                "✅ تصویر دریافت شد.\n\n" +
                "✏️ حالا *نام تصویر* را وارد کنید.\n\n" +
                "مثال:\n" +
                "نمایشگاه بین‌المللی تهران\n\n" +
                "نام تصویر اجباری است.\n\n" +
                "❌ برای لغو: /cancel",

            parse_mode:
                "Markdown"

        }
    );

}


// ============================================================
// درخواست دسته‌بندی
// ============================================================

async function askImageCategory(chatId) {

    await telegram(
        "sendMessage",
        {

            chat_id:
                chatId,

            text:
                "📂 حالا *دسته‌بندی* تصویر را وارد کنید.\n\n" +
                "حداقل یک دسته‌بندی الزامی است.\n\n" +
                "مثال:\n" +
                "نمایشگاه\n\n" +
                "اگر چند دسته دارید، با کاما جدا کنید:\n" +
                "نمایشگاه, محصولات, 1405\n\n" +
                "❌ برای لغو: /cancel",

            parse_mode:
                "Markdown"

        }
    );

}


// ============================================================
// پیش‌نمایش اطلاعات
// ============================================================

async function showImagePreview(
    chatId,
    session
) {

    const categories =
        session.categories.join(
            "، "
        );


    await telegram(
        "sendMessage",
        {

            chat_id:
                chatId,

            text:
                "👁 *پیش‌نمایش تصویر*\n\n" +

                `🖼 نام:\n${session.name}\n\n` +

                `📂 دسته‌بندی:\n${categories}\n\n` +

                "آیا اطلاعات صحیح است؟",

            parse_mode:
                "Markdown",

            reply_markup: {

                inline_keyboard: [

                    [
                        {
                            text:
                                "✅ ذخیره نهایی",

                            callback_data:
                                "SAVE_IMAGE"
                        }
                    ],

                    [
                        {
                            text:
                                "✏️ تغییر نام",

                            callback_data:
                                "CHANGE_NAME"
                        },

                        {
                            text:
                                "📂 تغییر دسته‌بندی",

                            callback_data:
                                "CHANGE_CATEGORY"
                        }
                    ],

                    [
                        {
                            text:
                                "❌ لغو",

                            callback_data:
                                "CANCEL_ADD"
                        }
                    ]

                ]

            }

        }
    );

}


// ============================================================
// ذخیره نهایی تصویر
// ============================================================

async function saveImageFinal(
    chatId,
    userId
) {

    const session =
        await getSession(
            userId
        );


    if (!session) {

        await telegram(
            "sendMessage",
            {

                chat_id:
                    chatId,

                text:
                    "❌ نشست افزودن تصویر پیدا نشد.\n\n" +
                    "لطفاً دوباره از /start شروع کنید."

            }
        );

        return;

    }


    if (
        !session.file_id ||
        !session.name ||
        !Array.isArray(session.categories) ||
        session.categories.length === 0
    ) {

        await telegram(
            "sendMessage",
            {

                chat_id:
                    chatId,

                text:
                    "❌ اطلاعات تصویر کامل نیست."

            }
        );

        return;

    }


    // ========================================================
    // ارسال عکس به کانال
    // ========================================================

    const channelMessage =
        await telegram(
            "sendPhoto",
            {

                chat_id:
                    CHANNEL_ID,

                photo:
                    session.file_id,

                caption:
                    session.name

            }
        );


    // ========================================================
    // خواندن images.json
    // ========================================================

    const {
        data,
        sha
    } =
        await readImages();


    if (!Array.isArray(data.images)) {

        data.images = [];

    }


    // ========================================================
    // ID
    // ========================================================

    const newId =
        String(
            Date.now()
        );


    // ========================================================
    // رکورد تصویر
    // ========================================================

    const imageRecord = {

        id:
            newId,

        file_id:
            session.file_id,

        telegram_message_id:
            channelMessage.message_id,

        name:
            session.name,

        categories:
            session.categories,

        caption:
            session.name,

        width:
            session.width,

        height:
            session.height,

        created_at:
            new Date().toISOString()

    };


    // ========================================================
    // ذخیره در images.json
    // ========================================================

    data.images.push(
        imageRecord
    );


    try {

        await writeGithubJson(
            "data/images.json",
            data,
            sha,
            `Add image ${newId}`
        );

    } catch (error) {

        /*
          اگر GitHub شکست خورد، عکس در کانال ذخیره شده.
          این موضوع را به کاربر اعلام می‌کنیم.
        */

        console.error(
            "Image GitHub save error:",
            error
        );


        await telegram(
            "sendMessage",
            {

                chat_id:
                    chatId,

                text:
                    "⚠️ عکس در کانال ذخیره شد اما ثبت اطلاعات در GitHub با خطا مواجه شد.\n\n" +
                    "لطفاً فعلاً دوباره همین عکس را ارسال نکنید."

            }
        );


        return;

    }


    // ========================================================
    // حذف Session
    // ========================================================

    await deleteSession(
        userId
    );


    // ========================================================
    // پاسخ موفق
    // ========================================================

    await telegram(
        "sendMessage",
        {

            chat_id:
                chatId,

            text:
                "🎉 *تصویر با موفقیت ثبت شد!*\n\n" +

                `🖼 نام:\n${session.name}\n\n` +

                `📂 دسته‌بندی:\n${session.categories.join("، ")}\n\n` +

                "تصویر اکنون در گالری سایت قابل نمایش است.",

            parse_mode:
                "Markdown",

            reply_markup:
                mainMenu()

        }
    );

}


// ============================================================
// Handler
// ============================================================

export default async (req) => {

    try {

        // ======================================================
        // فقط POST
        // ======================================================

        if (req.method !== "POST") {

            return new Response(
                "Method Not Allowed",
                {
                    status: 405
                }
            );

        }


        // ======================================================
        // Update
        // ======================================================

        const update =
            await req.json();


        console.log(
            "Telegram update:",
            JSON.stringify(update)
        );


        // ======================================================
        // Environment
        // ======================================================

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


        // ======================================================
        // CHANNEL POST
        // ======================================================

        if (update.channel_post) {

            const channelPost =
                update.channel_post;


            const text =
                channelPost.text ||
                channelPost.caption ||
                "";


            const channelId =
                channelPost.chat?.id;


            // --------------------------------------------------
            // دریافت Channel ID
            // --------------------------------------------------

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
                        status: 200
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
                    status: 200
                }
            );

        }


        // ======================================================
        // CALLBACK QUERY
        // ======================================================

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


            // --------------------------------------------------
            // Admin
            // --------------------------------------------------

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


            // ==================================================
            // MAIN MENU
            // ==================================================

            if (
                action ===
                "MAIN_MENU"
            ) {

                await sendMainMenu(
                    chatId
                );

            }


            // ==================================================
            // ADD IMAGE
            // ==================================================

            else if (
                action ===
                "ADD_IMAGE"
            ) {

                await cancelSession(
                    userId
                );


                await setSession(
                    userId,
                    {
                        state:
                            "waiting_photo",

                        created_at:
                            new Date().toISOString()
                    }
                );


                await startAddImage(
                    chatId
                );

            }


            // ==================================================
            // SAVE IMAGE
            // ==================================================

            else if (
                action ===
                "SAVE_IMAGE"
            ) {

                await saveImageFinal(
                    chatId,
                    userId
                );

            }


            // ==================================================
            // CHANGE NAME
            // ==================================================

            else if (
                action ===
                "CHANGE_NAME"
            ) {

                const session =
                    await getSession(
                        userId
                    );


                if (!session) {

                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text:
                                "❌ نشست پیدا نشد. دوباره از /start شروع کنید."

                        }
                    );

                } else {

                    session.state =
                        "waiting_name";


                    await setSession(
                        userId,
                        session
                    );


                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text:
                                "✏️ نام جدید تصویر را وارد کنید:"

                        }
                    );

                }

            }


            // ==================================================
            // CHANGE CATEGORY
            // ==================================================

            else if (
                action ===
                "CHANGE_CATEGORY"
            ) {

                const session =
                    await getSession(
                        userId
                    );


                if (!session) {

                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text:
                                "❌ نشست پیدا نشد. دوباره از /start شروع کنید."

                        }
                    );

                } else {

                    session.state =
                        "waiting_category";


                    await setSession(
                        userId,
                        session
                    );


                    await askImageCategory(
                        chatId
                    );

                }

            }


            // ==================================================
            // CANCEL ADD
            // ==================================================

            else if (
                action ===
                "CANCEL_ADD"
            ) {

                await cancelSession(
                    userId
                );


                await telegram(
                    "sendMessage",
                    {

                        chat_id:
                            chatId,

                        text:
                            "❌ افزودن تصویر لغو شد.",

                        reply_markup:
                            mainMenu()

                    }
                );

            }


            // ==================================================
            // MANAGEMENT
            // ==================================================

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
                            "🖼 *مدیریت تصاویر*\n\n" +
                            "یکی از گزینه‌های زیر را انتخاب کنید:",

                        parse_mode:
                            "Markdown",

                        reply_markup:
                            managementMenu()

                    }
                );

            }


            // ==================================================
            // LIST IMAGES
            // ==================================================

            else if (
                action ===
                "LIST_IMAGES"
            ) {

                const {
                    data
                } =
                    await readImages();


                const images =
                    Array.isArray(
                        data.images
                    )
                        ? data.images
                        : [];


                if (
                    images.length === 0
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
                        `🖼 *تعداد تصاویر: ${images.length}*\n\n`;


                    images
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
                        images.length > 30
                    ) {

                        text +=
                            `\n... و ${images.length - 30} تصویر دیگر`;

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


            // ==================================================
            // CATEGORIES
            // ==================================================

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


                (
                    Array.isArray(
                        data.images
                    )
                        ? data.images
                        : []
                ).forEach(
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


            // ==================================================
            // DELETE IMAGE
            // ==================================================

            else if (
                action ===
                "DELETE_IMAGE"
            ) {

                const {
                    data
                } =
                    await readImages();


                const images =
                    Array.isArray(
                        data.images
                    )
                        ? data.images
                        : [];


                if (
                    images.length === 0
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
                        images
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
                                "🗑 *تصویر موردنظر برای حذف را انتخاب کنید:*",

                            parse_mode:
                                "Markdown",

                            reply_markup: {
                                inline_keyboard:
                                    keyboard
                            }

                        }
                    );

                }

            }


            // ==================================================
            // DELETE CONFIRM
            // ==================================================

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


            // ==================================================
            // DELETE FINAL
            // ==================================================

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


                    // ------------------------------------------
                    // حذف از کانال
                    // ------------------------------------------

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
                                "Telegram delete error:",
                                deleteError
                            );

                        }

                    }


                    // ------------------------------------------
                    // حذف از JSON
                    // ------------------------------------------

                    data.images.splice(
                        index,
                        1
                    );


                    await writeGithubJson(
                        "data/images.json",
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
                                "تصویر از گالری نیز حذف خواهد شد.",

                            reply_markup:
                                managementMenu()

                        }
                    );

                }

            }


            // ==================================================
            // EDIT IMAGE
            // ==================================================

            else if (
                action ===
                "EDIT_IMAGE"
            ) {

                await telegram(
                    "sendMessage",
                    {

                        chat_id:
                            chatId,

                        text:
                            "✏️ بخش ویرایش تصویر را در مرحله بعدی کامل می‌کنیم.\n\n" +
                            "فعلاً افزودن و حذف تصویر فعال است.",

                        reply_markup:
                            managementMenu()

                    }
                );

            }


            // ==================================================
            // HELP
            // ==================================================

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

                            "➕ افزودن تصویر\n" +
                            "ابتدا تصویر را ارسال کنید، سپس نام و دسته‌بندی را وارد کنید.\n\n" +

                            "🖼 مدیریت تصاویر\n" +
                            "برای مشاهده، حذف و مدیریت تصاویر.\n\n" +

                            "📂 دسته‌بندی‌ها\n" +
                            "لیست دسته‌بندی‌های موجود.\n\n" +

                            "❌ /cancel\n" +
                            "لغو عملیات جاری.",

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


        // ======================================================
        // MESSAGE
        // ======================================================

        if (update.message) {

            const message =
                update.message;


            const chatId =
                message.chat?.id;


            const userId =
                message.from?.id;


            // ==================================================
            // /start
            // ==================================================

            if (
                message.text?.trim() ===
                "/start"
            ) {

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

                } else {

                    await cancelSession(
                        userId
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


            // ==================================================
            // /myid
            // ==================================================

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


            // ==================================================
            // /cancel
            // ==================================================

            if (
                message.text?.trim() ===
                "/cancel"
            ) {

                if (isAdmin(userId)) {

                    await cancelSession(
                        userId
                    );


                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text:
                                "❌ عملیات لغو شد.",

                            reply_markup:
                                mainMenu()

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


            // ==================================================
            // ADMIN CHECK
            // ==================================================

            if (!isAdmin(userId)) {

                return new Response(
                    JSON.stringify({
                        ok: true
                    }),
                    {
                        status: 200
                    }
                );

            }


            // ==================================================
            // دریافت عکس
            // ==================================================

            if (message.photo) {

                const session =
                    await getSession(
                        userId
                    );


                // ----------------------------------------------
                // کاربر در حالت افزودن عکس نیست
                // ----------------------------------------------

                if (
                    !session ||
                    session.state !==
                    "waiting_photo"
                ) {

                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text:
                                "📸 برای افزودن تصویر ابتدا از منوی /start گزینه «➕ افزودن تصویر» را انتخاب کنید."

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


                // ----------------------------------------------
                // بزرگ‌ترین عکس
                // ----------------------------------------------

                const photo =
                    getLargestPhoto(
                        message.photo
                    );


                if (!photo) {

                    throw new Error(
                        "Photo data is missing"
                    );

                }


                // ----------------------------------------------
                // ذخیره موقت عکس
                // ----------------------------------------------

                session.state =
                    "waiting_name";


                session.file_id =
                    photo.file_id;


                session.width =
                    photo.width;


                session.height =
                    photo.height;


                session.telegram_user_id =
                    userId;


                session.telegram_chat_id =
                    chatId;


                session.updated_at =
                    new Date().toISOString();


                await setSession(
                    userId,
                    session
                );


                await askImageName(
                    chatId
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


            // ==================================================
            // پیام متنی
            // ==================================================

            if (message.text) {

                const text =
                    message.text.trim();


                const session =
                    await getSession(
                        userId
                    );


                if (!session) {

                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text:
                                "از منوی /start استفاده کنید."

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


                // ==================================================
                // انتظار نام
                // ==================================================

                if (
                    session.state ===
                    "waiting_name"
                ) {

                    if (!text) {

                        await telegram(
                            "sendMessage",
                            {

                                chat_id:
                                    chatId,

                                text:
                                    "❌ نام تصویر نمی‌تواند خالی باشد.\n\nلطفاً نام تصویر را وارد کنید."

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


                    if (
                        text.length > 150
                    ) {

                        await telegram(
                            "sendMessage",
                            {

                                chat_id:
                                    chatId,

                                text:
                                    "❌ نام تصویر بیش از حد طولانی است.\n\nلطفاً نام کوتاه‌تری وارد کنید."

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


                    session.name =
                        text;


                    session.state =
                        "waiting_category";


                    session.updated_at =
                        new Date().toISOString();


                    await setSession(
                        userId,
                        session
                    );


                    await askImageCategory(
                        chatId
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


                // ==================================================
                // انتظار دسته‌بندی
                // ==================================================

                if (
                    session.state ===
                    "waiting_category"
                ) {

                    const categories =
                        text
                            .split(",")
                            .map(
                                item =>
                                    item.trim()
                            )
                            .filter(Boolean);


                    if (
                        categories.length === 0
                    ) {

                        await telegram(
                            "sendMessage",
                            {

                                chat_id:
                                    chatId,

                                text:
                                    "❌ حداقل یک دسته‌بندی الزامی است.\n\nمثلاً:\nمحصولات"

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


                    // حذف دسته‌های تکراری
                    const uniqueCategories =
                        Array.from(
                            new Set(
                                categories
                            )
                        );


                    session.categories =
                        uniqueCategories;


                    session.state =
                        "waiting_confirmation";


                    session.updated_at =
                        new Date().toISOString();


                    await setSession(
                        userId,
                        session
                    );


                    await showImagePreview(
                        chatId,
                        session
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


                // ==================================================
                // اگر در حالت confirmation متن فرستاد
                // ==================================================

                if (
                    session.state ===
                    "waiting_confirmation"
                ) {

                    await telegram(
                        "sendMessage",
                        {

                            chat_id:
                                chatId,

                            text:
                                "👁 اطلاعات تصویر آماده تأیید است.\n\n" +
                                "لطفاً از دکمه‌های زیر استفاده کنید.",

                            reply_markup: {

                                inline_keyboard: [

                                    [
                                        {
                                            text:
                                                "✅ ذخیره نهایی",

                                            callback_data:
                                                "SAVE_IMAGE"
                                        }
                                    ],

                                    [
                                        {
                                            text:
                                                "✏️ تغییر نام",

                                            callback_data:
                                                "CHANGE_NAME"
                                        },

                                        {
                                            text:
                                                "📂 تغییر دسته‌بندی",

                                            callback_data:
                                                "CHANGE_CATEGORY"
                                        }
                                    ],

                                    [
                                        {
                                            text:
                                                "❌ لغو",

                                            callback_data:
                                                "CANCEL_ADD"
                                        }
                                    ]

                                ]

                            }

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

            }

        }


        // ======================================================
        // Response
        // ======================================================

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
