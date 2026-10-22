type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string };

export async function verifySupabaseUser(request: Request): Promise<AuthResult> {
  const authorization = request.headers.get("authorization");
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    return { ok: false, status: 401, error: "A valid sign-in session is required." };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return { ok: false, status: 500, error: "Supabase auth is not configured on the server." };
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/user`, {
      headers: {
        "apikey": anonKey,
        "authorization": authorization,
      },
    });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, status: 401, error: "Your sign-in session is invalid or expired." };
    }
    if (!response.ok) {
      return { ok: false, status: 503, error: "Could not verify your sign-in session." };
    }

    const user = await response.json();
    if (typeof user?.id !== "string") {
      return { ok: false, status: 401, error: "Your sign-in session is invalid." };
    }

    return { ok: true, userId: user.id };
  } catch {
    return { ok: false, status: 503, error: "Could not verify your sign-in session." };
  }
}
