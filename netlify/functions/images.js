
export default async (req) => {
    try {

        // فقط GET
        if (req.method !== "GET") {
            return new Response(
                JSON.stringify({
                    ok: false,
                    error: "Method Not Allowed"
                }),
                {
                    status: 405,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        // =====================================================
        // Environment Variables
        // =====================================================

        const GITHUB_TOKEN =
            process.env.GITHUB_TOKEN;

        const GITHUB_REPO =
            process.env.GITHUB_REPO;

        const GITHUB_BRANCH =
            process.env.GITHUB_BRANCH || "main";

        if (!GITHUB_TOKEN || !GITHUB_REPO) {
            throw new Error(
                "GITHUB_TOKEN or GITHUB_REPO is not configured"
            );
        }

        // =====================================================
        // آدرس images.json در GitHub
        // =====================================================

        const githubFileUrl =
            `https://api.github.com/repos/${GITHUB_REPO}/contents/data/images.json?ref=${GITHUB_BRANCH}`;

        // =====================================================
        // دریافت فایل از GitHub
        // =====================================================

        const response =
            await fetch(githubFileUrl, {
                method: "GET",

                headers: {
                    "Authorization":
                        `Bearer ${GITHUB_TOKEN}`,

                    "Accept":
                        "application/vnd.github+json",

                    "X-GitHub-Api-Version":
                        "2022-11-28"
                }
            });

        if (!response.ok) {

            const errorText =
                await response.text();

            throw new Error(
                `GitHub error (${response.status}): ${errorText}`
            );
        }

        const githubFile =
            await response.json();

        // =====================================================
        // Decode کردن images.json
        // =====================================================

        const content =
            Buffer.from(
                githubFile.content,
                "base64"
            ).toString("utf-8");

        const data =
            JSON.parse(content);

        // =====================================================
        // اطمینان از وجود آرایه images
        // =====================================================

        const images =
            Array.isArray(data.images)
                ? data.images
                : [];

        // =====================================================
        // پاسخ به سایت
        // =====================================================

        return new Response(
            JSON.stringify({
                ok: true,
                images: images
            }),
            {
                status: 200,

                headers: {
                    "Content-Type":
                        "application/json",

                    "Cache-Control":
                        "no-cache, no-store, must-revalidate"
                }
            }
        );

    } catch (error) {

        console.error(
            "Images function error:",
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

