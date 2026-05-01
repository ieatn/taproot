const MODEL = 'gemini-2.5-flash-lite';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SITE_PROMPTS = {
  cheeseroom: `You are the digital concierge for Cheese Room Seattle, an Italian-inspired, cheese-forward restaurant on Capitol Hill at 1215 Pine St, Seattle. Be warm, concise, and knowledgeable about cheese-focused dishes, atmosphere, and practical visitor info. Hours: Monday–Tuesday closed; Wednesday–Thursday 4:00 pm–8:30 pm; Friday–Saturday 4:00 pm–9:30 pm; Sunday 4:00 pm–8:30 pm. Walk-ins only; phone (206) 337-0123; Instagram @cheeseroomseattle. If asked something you cannot verify from typical public restaurant info, say you are not sure and suggest calling the restaurant.`,
  paran: `You are the assistant for PARAN Korean Grill in Fremont, Seattle at 3424 Fremont Ave N. Be polished and concise. Speak to Korean grill dining and menu themes at a high level; mention reservations via Toast when relevant and Instagram @paran.fremont. Do not invent dishes or prices—point guests to the menu on the site or staff for specifics. If unsure, suggest contacting the restaurant directly.`,
  taproot: `You are the assistant for Taproot Café & Bar in Columbia City, Seattle. Be welcoming and brief. Help with café and bar questions, the neighborhood vibe, and practical planning using information reasonable for a local venue. Do not invent policies, allergens, or events; when specifics are not known, suggest checking the site, calling, or visiting in person.`,
};

const ALLOWED_SITES = new Set(Object.keys(SITE_PROMPTS));

function clampMessages(messages) {
  if (!Array.isArray(messages)) return [];
  const out = [];
  for (const m of messages.slice(-24)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;
    const text = typeof m.content === 'string' ? m.content.trim() : '';
    if (!text) continue;
    out.push({
      role: m.role,
      content: text.slice(0, 6000),
    });
    if (out.length >= 24) break;
  }
  return out;
}

function toGeminiContents(messages) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

export async function handleChatRequest(body) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error('Chat is not configured (missing GEMINI_API_KEY).'), {
      statusCode: 503,
    });
  }

  const siteId = typeof body?.siteId === 'string' ? body.siteId.trim() : '';
  if (!ALLOWED_SITES.has(siteId)) {
    throw Object.assign(new Error('Invalid site.'), { statusCode: 400 });
  }

  const messages = clampMessages(body?.messages);
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    throw Object.assign(new Error('Send at least one user message.'), { statusCode: 400 });
  }

  const systemPrompt = SITE_PROMPTS[siteId];
  const contents = toGeminiContents(messages);

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 1024,
      },
    }),
  });

  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw Object.assign(new Error('Unexpected response from model.'), { statusCode: 502 });
  }

  if (!res.ok) {
    const msg =
      data?.error?.message ||
      (typeof data?.error === 'string' ? data.error : null) ||
      `Model request failed (${res.status}).`;
    throw Object.assign(new Error(msg), { statusCode: 502 });
  }

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => (typeof p.text === 'string' ? p.text : ''))
      .join('') || '';

  const trimmed = text.trim();
  if (!trimmed) {
    throw Object.assign(new Error('Empty model response.'), { statusCode: 502 });
  }

  return { reply: trimmed };
}
