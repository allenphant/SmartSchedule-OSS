import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// ============================================
// 簡易 Rate Limiting (Memory-based)
// ============================================
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, limit = 10, windowMs = 60000): boolean {
    const now = Date.now();
    const record = rateLimitMap.get(ip);
    if (!record || now > record.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
        return true;
    }
    if (record.count >= limit) return false;
    record.count++;
    return true;
}

const PUBLIC_PATHS = ['/login', '/register', '/auth'];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Rate limit for auth routes
    if (pathname.startsWith('/auth/')) {
        const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
        if (!checkRateLimit(ip, 5, 60000)) {
            return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
        }
    }

    // ============================================
    // Supabase Session Refresh
    // IMPORTANT: supabaseResponse MUST be the base response so cookies get
    // properly written. When redirecting, copy cookies from supabaseResponse
    // to the redirect response — otherwise page.tsx loses the session and
    // redirects back to /login, creating an infinite loop.
    // ============================================
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return request.cookies.getAll(); },
                setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        request.cookies.set(name, value);
                        supabaseResponse.cookies.set(name, value, options);
                    });
                },
            },
        }
    );

    // 刷新 session（自動處理 token 過期）
    const { data: { user } } = await supabase.auth.getUser();

    const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));

    // 用這個 helper 建立 redirect response 並帶上 session cookies
    function redirectWithCookies(to: string) {
        const url = request.nextUrl.clone();
        const [path, search] = to.split('?');
        url.pathname = path;
        if (search) {
            url.search = search;
        }
        const res = NextResponse.redirect(url);
        // ← 關鍵：把 Supabase 更新後的 cookie 複製過去
        supabaseResponse.cookies.getAll().forEach(({ name, value }) => {
            res.cookies.set(name, value);
        });
        return res;
    }

    // 未登入 → 擋住所有非 public 頁面
    if (!user && !isPublic) {
        return redirectWithCookies('/login?reason=middleware_auth_fail');
    }

    // 已登入 → 處理 Onboarding 邏輯
    if (user) {
        // checks if user meta says onboarded
        // Note: is_onboarded might be missing for old manual users, assume true if missing? 
        // No, current manual users don't have it. 
        // BUT manual users logic: they register via /register -> triggers? 
        // We should manual users to default to onboarded? 
        // Actually, the handle_new_user trigger only runs on INSERT.
        // Existing users won't be affected.
        // For Google users, we set is_onboarded=false (or undefined) initially?
        // Let's rely on the fact that ONLY Google users will have `app_metadata.provider = 'google'`?
        // Or just: if !is_onboarded AND provider contains google?
        // Safest: If user is authenticated, check if they have a profile?
        // DB check is expensive.
        // Let's use metadata.
        const isOnboarded = user.user_metadata?.is_onboarded === true;
        const isGoogleUser = user.app_metadata?.provider === 'google';

        // Only enforce onboarding for Google users who are not Onboarded
        if (isGoogleUser && !isOnboarded && !pathname.startsWith('/onboarding') && !pathname.startsWith('/auth')) {
            return redirectWithCookies('/onboarding');
        }

        // Prevent accessing onboarding if already onboarded
        if (isOnboarded && pathname.startsWith('/onboarding')) {
            return redirectWithCookies('/schedule');
        }

        if (isPublic) {
            return redirectWithCookies('/schedule');
        }
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
