# GULI AI Agent Architecture

Date: 2026-09-17
Status: Phase 1 backend foundation

## Goal

Replace the current simulated `Guli AI` chat behavior with a real, server-side multimodal AI agent for the admin panel.

Required capabilities:
- Text understanding and generation
- Image understanding: product photos, receipts, screenshots and UI/error evidence
- Voice input: speech-to-text followed by agent reasoning
- Live GULI database analysis
- Web search when current external information is required
- Recommendations based on orders, products, customers, payments and customer messages
- Strict admin authentication and server-side API keys

## Current finding

`src/admin/components/AdminGuliChatTab.tsx` currently contains a local `generateAIResponse()` function with hard-coded responses and a `setTimeout()` simulation. The UI already supports text input, image selection and browser microphone recording, but those inputs are not connected to a real AI backend.

The existing component also stores chat history in browser `localStorage`; this remains a UI history mechanism and is not a trusted source of operational data.

## Phase 1 implementation

Added:
- `backend/guliAiAgent.js`
- `backend/guliAiAgentRuntime.js`
- backend start-script registration

Endpoint:
- `POST /api/admin/ai/chat`
- `GET /api/admin/ai/health`

Authentication:
- Existing GULI admin bearer token verification is required.
- `OPENAI_API_KEY` stays server-side.

AI provider:
- OpenAI Responses API
- Default reasoning model: `gpt-5.6-terra`
- Configurable with `GULI_AI_MODEL`
- Voice transcription default: `gpt-4o-transcribe`
- Configurable with `GULI_AI_TRANSCRIBE_MODEL`

The current OpenAI model catalog documents text+image input for the latest GPT-5.6 models and lists function calling and web search as supported tools. It also lists dedicated transcription models for speech input.

## Read-only GULI tools in Phase 1

The agent can request:
- `get_dashboard_snapshot`
- `get_recent_orders`
- `search_products`
- `get_recent_customer_messages`
- `get_customers_snapshot`
- web search

No mutating action is exposed yet. This is intentional: the first production integration must prove data accuracy and security before allowing the AI to change orders, products, messages, banners or payments.

## Security requirements

1. Browser never receives `OPENAI_API_KEY`.
2. AI endpoint requires an authenticated admin bearer token.
3. Supabase service credentials remain server-side.
4. AI must not invent live business values.
5. Tool failures must be reported as missing/incomplete data, not silently converted to successful results.
6. Destructive actions require a future explicit admin confirmation layer.
7. Customer information should be minimized to fields necessary for the requested operation.
8. AI must never claim a deployment, merge, payment approval or other side effect unless the server actually performed it.

## Phase 2 — frontend wiring

Replace the local simulation in `AdminGuliChatTab.tsx` with the real `/api/admin/ai/chat` endpoint.

Payload contract:

```json
{
  "text": "Bugungi savdoni tahlil qil",
  "history": [],
  "image": {
    "base64": "...",
    "mimeType": "image/jpeg"
  },
  "audio": {
    "base64": "...",
    "mimeType": "audio/webm"
  }
}
```

The frontend must convert local `File` / `Blob` inputs to base64 before sending. Browser-only `blob:` URLs must never be sent to the backend as if they were persistent media URLs.

## Phase 3 — deeper operations intelligence

Add read tools for:
- payment/receipt state
- revenue by date range
- refunds/cancellations
- inventory by size/color
- customer conversion and repeat purchases
- notification/broadcast history
- system/health events
- deployment/runtime errors where a trusted log source is available

## Phase 4 — controlled actions

Introduce explicit action tools with confirmation:
- update order status
- prepare customer reply
- send customer/admin message
- update product metadata
- create/update promotion
- generate reports

Every mutating action must produce an audit event containing admin identity, AI session ID, requested action, arguments, confirmation state, execution result and timestamp.

## Phase 5 — persistent AI memory

Store AI conversations and operational summaries server-side only after the data retention and privacy policy is defined. Do not use browser `localStorage` as the authoritative AI memory.

## Architecture target

```text
Admin Panel
   |
   v
GULI AI Chat UI
   |
   v
/api/admin/ai/chat  <-- Admin Auth
   |
   +--> OpenAI Responses API
   |      +--> text
   |      +--> image
   |      +--> web search
   |      +--> tool calls
   |
   +--> Voice transcription
   |
   +--> GULI Tool Registry
          +--> Orders
          +--> Products
          +--> Customers
          +--> Payments
          +--> Messages
          +--> Analytics
          +--> Health / Logs
          +--> Controlled Actions
   |
   v
Supabase / canonical GULI backend
```
