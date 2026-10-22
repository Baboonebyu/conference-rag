import { verifySupabaseUser } from "../_shared/auth.ts";
import { getCorsHeaders, isAllowedOrigin } from "../_shared/cors.ts";

function jsonResponse(body: unknown, status: number, headers: Headers): Response {
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request: Request): Promise<Response> => {
  const headers = getCorsHeaders(request);
  const origin = request.headers.get("origin");

  if (origin && !isAllowedOrigin(origin)) {
    return jsonResponse({ error: "Origin is not allowed." }, 403, headers);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "POST") {
    headers.set("allow", "POST, OPTIONS");
    return jsonResponse({ error: "Method not allowed." }, 405, headers);
  }

  const auth = await verifySupabaseUser(request);
  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status, headers);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400, headers);
  }

  const question = (body as { question?: unknown } | null)?.question;
  if (typeof question !== "string" || question.trim().length === 0) {
    return jsonResponse({ error: "A non-empty question is required." }, 400, headers);
  }

  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiKey) {
    return jsonResponse({ error: "Embedding service is not configured." }, 500, headers);
  }

  let openAiResponse: Response;
  try {
    openAiResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${openAiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: question.trim(),
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return jsonResponse({ error: "Could not reach the embedding service." }, 502, headers);
  }

  if (!openAiResponse.ok) {
    // Log only the status; never log the API key or the user's question.
    console.error(`OpenAI embedding request failed with status ${openAiResponse.status}.`);
    if (openAiResponse.status === 429) {
      return jsonResponse({ error: "The embedding service is temporarily rate-limited." }, 503, headers);
    }
    return jsonResponse({ error: "The embedding service could not process the question." }, 502, headers);
  }

  let openAiData: { data?: Array<{ embedding?: unknown }> };
  try {
    openAiData = await openAiResponse.json();
  } catch {
    return jsonResponse({ error: "The embedding service returned an invalid response." }, 502, headers);
  }

  const embedding = openAiData.data?.[0]?.embedding;
  if (
    !Array.isArray(embedding) ||
    embedding.length !== 1536 ||
    !embedding.every((value) => typeof value === "number" && Number.isFinite(value))
  ) {
    return jsonResponse({ error: "The embedding service returned an invalid vector." }, 502, headers);
  }

  return jsonResponse({ embedding }, 200, headers);
});
