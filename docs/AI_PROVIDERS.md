# Connecting a language model (optional)

Aurevyn ships with **no model dependency**. Every automated decision — sourcing
score, pricing, margin floor, team briefings, workflow plans — is deterministic
and testable without a network call. That is deliberate: a store must behave the
same at 03:00 as it does at noon, and an invented number is worse than no number.

If you later want a model for *wording* (product descriptions, email polish),
the cheapest useful setup is an OpenAI-compatible endpoint. Nothing in the store
depends on it; it stays optional.

## Free / low-cost options that speak the OpenAI API

Rates change often — check the provider's own pricing page before relying on a
number.

| Provider | Free tier in practice | Notes |
| --- | --- | --- |
| **Groq** | Generous free requests on open models (Llama, Qwen, GPT-OSS) | Very fast; good for short copy. OpenAI-compatible base URL. |
| **Google AI Studio (Gemini)** | Free tier on Flash-class models with daily limits | Free tier data may be used to improve products — read the terms. |
| **OpenRouter** | A rotating set of `:free` models | One key for many models; free models are rate-limited and can be withdrawn. |
| **Cerebras** | Free developer tier on select models | Very high tokens/sec; limited model choice. |

For a resale store the volume is tiny — a few hundred short completions a month
— so any of these is enough. Do not put a paid key in the browser.

## How to add one safely

1. Add the variables to `src/lib/env.ts` **first** (the schema is the only
   place environment is read):

   ```
   AI_BASE_URL      # e.g. https://api.groq.com/openai/v1
   AI_API_KEY       # server-side only
   AI_MODEL         # e.g. llama-3.3-70b-versatile
   ```

2. Call it only from a server module, behind `getAiStatus()` in
   `src/lib/ai/provider.ts`, so a missing key falls back to the deterministic
   helpers instead of throwing.

3. Keep the existing rules:
   - the model may **propose**, never approve;
   - never let it publish a product, change a price, issue a refund or message a
     customer;
   - cap tokens per call and per day (`aiCeo.monthlyTokenBudget`);
   - never log the key or the raw prompt containing customer data.

4. Store the key in Vercel → Project → Settings → Environment Variables (or the
   platform secret store). Never in `.env` committed to git, never in chat.

## What not to do

- Do not ask a model for a product's return rate, sales volume or "trending"
  score. Those come from Meesho data the owner pasted, or they stay unknown.
- Do not let a model generate prices. The pricing engine is auditable; a model
  is not.
- Do not paste customer names, phone numbers or addresses into a prompt.
