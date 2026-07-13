/**
 * karute-api : Anthropic API プロキシ Worker
 * フロント（index.html）からのリクエストを受け、APIキーを注入して
 * api.anthropic.com へ転送する。キーはWorker Secret に保存し、フロントには出さない。
 *
 * デプロイ後、index.html の API_ENDPOINT をこのWorkerの /v1/messages に差し替える。
 */

// 許可するオリジン（配信ドメインに合わせて変更）
const ALLOW_ORIGINS = [
  "https://tamjump.github.io",
  "https://karute.tamjump.com",
];

function corsHeaders(origin) {
  const allow = ALLOW_ORIGINS.includes(origin) ? origin : ALLOW_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: cors });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid json" }, 400, cors);
    }

    // モデルとmax_tokensを正規化（フロントの値に依存せず安全側に固定）
    body.model = env.MODEL || "claude-sonnet-5";
    if (!body.max_tokens || body.max_tokens < 2048) body.max_tokens = 4096;

    try {
      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });
      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: { ...cors, "content-type": "application/json" },
      });
    } catch (e) {
      return json({ error: "upstream error", detail: String(e) }, 502, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}
