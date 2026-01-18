import express from "express";
import cors from "cors";
import "dotenv/config";
import OpenAI from "openai";

import { getUserFromAuthHeader } from "./auth.js";
import { loadUserVotes } from "./analysis.js";
import { buildPrompt } from "./prompt.js";

const app = express();
app.use(cors());
app.use(express.json());

// ---- basic env validation ----
const PORT = Number(process.env.PORT || 4000);

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY in .env");
  process.exit(1);
}
if (!process.env.SUPABASE_URL) {
  console.error("Missing SUPABASE_URL in .env");
  process.exit(1);
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// --------------------
// Utils
// --------------------

function parseModelJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    const firstBrace = content.indexOf("{");
    const lastBrace = content.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      const err = new Error("Model returned non-JSON.");
      err.status = 502;
      err.raw = content;
      throw err;
    }
    const slice = content.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(slice);
    } catch {
      const err = new Error("Model returned invalid JSON.");
      err.status = 502;
      err.raw = content;
      throw err;
    }
  }
}

function sendError(res, err) {
  const status = err?.status ?? err?.statusCode ?? 500;
  const payload = { error: err?.message ?? "Unknown error" };
  if (err?.raw) payload.raw = err.raw;
  res.status(status).json(payload);
}

// --------------------
// Health check
// --------------------

app.get("/health", (_, res) => {
  res.json({ ok: true });
});

// --------------------
// PROD: /analysis
// (Supabase 연동)
// --------------------

app.post("/analysis", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const user = await getUserFromAuthHeader(authHeader);

    const { roomId } = req.body ?? {};
    if (!roomId) return res.status(400).json({ error: "roomId required" });

    const { votes } = await loadUserVotes(roomId, user.id);
    if (!votes || votes.length === 0) {
      return res.status(400).json({ error: "No votes found for user" });
    }

    // 🔥 prompt.js에 시나리오/문항 내장
    const prompt = buildPrompt(votes);

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.25,
      messages: [
        {
          role: "system",
          content:
            "너는 가치/정치 성향 분석가다. 반드시 유효한 JSON 하나만 출력하라. JSON의 모든 문자열은 한국어로 작성하라."
        },
        { role: "user", content: prompt }
      ]
    });

    const content = completion?.choices?.[0]?.message?.content ?? "";
    const parsed = parseModelJson(content);

    res.json({
      roomId,
      userId: user.id,
      analysis: parsed
    });
  } catch (err) {
    console.error(err);
    sendError(res, err);
  }
});

// --------------------
// DEV: /analysis/dev
// (votes만 받음)
// --------------------

app.post("/analysis/dev", async (req, res) => {
  try {
    const { votes } = req.body ?? {};

    if (!votes || !Array.isArray(votes) || votes.length === 0) {
      return res.status(400).json({ error: "votes array required" });
    }

    // MOCK 모드
    if (process.env.MOCK_ANALYSIS === "true") {
      return res.json({
        analysis: {
          최종_라벨: "혼합형(테스트)",
          신뢰도: 50,
          스탯: {
            질서: 60,
            자유: 40,
            성과: 55,
            평등: 45,
            공동체: 50,
            개인: 50
          },
          근거: [
            { 문항: "Q1", 선택: "A", 설명: "테스트용 더미 근거입니다." }
          ],
          요약: "이 응답은 MOCK_ANALYSIS=true일 때 반환되는 테스트용 결과입니다."
        }
      });
    }

    const prompt = buildPrompt(votes);

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.25,
      max_tokens: 800,
      frequency_penalty: 0.2,
      presence_penalty: 0.0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "너는 가치/정치 성향 분석가다. 반드시 유효한 JSON 하나만 출력하라. JSON의 모든 문자열은 한국어로 작성하라."
        },
        { role: "user", content: prompt }
      ]
    });

    const content = completion?.choices?.[0]?.message?.content ?? "";
    const parsed = parseModelJson(content);

    res.json({ analysis: parsed });
  } catch (err) {
    console.error(err);
    sendError(res, err);
  }
});

// --------------------
// Server start
// --------------------

app.listen(PORT, () => {
  console.log(`AI analysis server running on port ${PORT}`);
});