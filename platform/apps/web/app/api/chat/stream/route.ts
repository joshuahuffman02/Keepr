import { apiUrl } from "@/lib/api-config";

const encoder = new TextEncoder();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const getBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const toAttachments = (value: unknown) => {
  if (!Array.isArray(value)) return undefined;
  const attachments = value.filter(
    (entry) =>
      isRecord(entry) &&
      typeof entry.name === "string" &&
      typeof entry.contentType === "string" &&
      typeof entry.size === "number",
  );
  return attachments.length > 0 ? attachments : undefined;
};

const toHistory = (value: unknown) => {
  if (!Array.isArray(value)) return undefined;
  const entries = value.filter(
    (entry) =>
      isRecord(entry) &&
      (entry.role === "user" || entry.role === "assistant") &&
      typeof entry.content === "string",
  );
  return entries.length > 0 ? entries : undefined;
};

const chunkText = (text: string) => {
  const words = text.split(/(\s+)/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += 3) {
    chunks.push(words.slice(i, i + 3).join(""));
  }
  return chunks;
};

const sendEvent = (
  controller: ReadableStreamDefaultController,
  payload: Record<string, unknown>,
) => {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
};

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const json = await request.json();
    if (!isRecord(json)) {
      return new Response("Invalid request body", { status: 400 });
    }
    body = json;
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  const mode = getString(body.mode);
  if (!mode || !["public", "guest", "staff", "support"].includes(mode)) {
    return new Response("Invalid mode", { status: 400 });
  }

  const message = getString(body.message) ?? "";

  const campgroundId = getString(body.campgroundId);
  if ((mode === "public" || mode === "guest" || mode === "staff") && !campgroundId) {
    return new Response("campgroundId is required", { status: 400 });
  }

  const conversationId = getString(body.conversationId);
  const sessionId = getString(body.sessionId);
  const context = getString(body.context);
  const history = toHistory(body.history);
  const attachments = toAttachments(body.attachments);
  const visibility = getString(body.visibility);
  const resolvedVisibility =
    visibility === "internal" || visibility === "public" ? visibility : undefined;
  const trimmedMessage = message.trim();

  if ((mode === "public" || mode === "support") && !trimmedMessage) {
    return new Response("Message is required", { status: 400 });
  }
  if (
    (mode === "guest" || mode === "staff") &&
    !trimmedMessage &&
    (!attachments || attachments.length === 0)
  ) {
    return new Response("Message or attachment is required", { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const authHeader = request.headers.get("authorization");
  if (authHeader) headers["Authorization"] = authHeader;
  const guestHeader = request.headers.get("x-guest-id");
  if (guestHeader) headers["x-guest-id"] = guestHeader;

  let endpoint = "";
  let payload: Record<string, unknown> = {};

  if (mode === "public") {
    endpoint = `/ai/public/campgrounds/${campgroundId}/chat`;
    payload = {
      sessionId,
      message: trimmedMessage,
      history,
    };
  } else if (mode === "support") {
    endpoint = "/ai/support/chat";
    payload = {
      sessionId,
      message: trimmedMessage,
      history,
      context,
    };
  } else if (mode === "guest") {
    endpoint = `/chat/portal/${campgroundId}/message`;
    payload = {
      conversationId,
      sessionId,
      message: trimmedMessage,
      attachments,
      visibility: resolvedVisibility,
      context: {},
    };
  } else {
    endpoint = `/chat/campgrounds/${campgroundId}/message`;
    payload = {
      conversationId,
      sessionId,
      message: trimmedMessage,
      attachments,
      visibility: resolvedVisibility,
      context: {},
    };
  }

  let apiResponse: Response;
  try {
    apiResponse = await fetch(apiUrl(endpoint), {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    return new Response("Failed to reach API", { status: 502 });
  }

  if (!apiResponse.ok) {
    const errorText = await apiResponse.text();
    return new Response(errorText || "Upstream error", { status: apiResponse.status });
  }

  const data: unknown = await apiResponse.json();
  const meta: Record<string, unknown> = {};
  let content = "";

  if (mode === "public") {
    if (isRecord(data)) {
      content = getString(data.message) ?? "";
      if (Array.isArray(data.recommendations)) meta.recommendations = data.recommendations;
      if (Array.isArray(data.clarifyingQuestions))
        meta.clarifyingQuestions = data.clarifyingQuestions;
      if (typeof data.action === "string") meta.action = data.action;
      if (isRecord(data.bookingDetails)) meta.bookingDetails = data.bookingDetails;
    }
  } else if (mode === "support") {
    if (isRecord(data)) {
      content = getString(data.message) ?? "";
      if (Array.isArray(data.helpArticles)) meta.helpArticles = data.helpArticles;
      const showTicketPrompt = getBoolean(data.showTicketPrompt);
      if (showTicketPrompt !== undefined) meta.showTicketPrompt = showTicketPrompt;
    }
  } else {
    if (isRecord(data)) {
      content = getString(data.content) ?? "";
      if (typeof data.conversationId === "string") meta.conversationId = data.conversationId;
      if (typeof data.messageId === "string") meta.messageId = data.messageId;
      if (Array.isArray(data.parts)) meta.parts = data.parts;
      if (Array.isArray(data.toolCalls)) meta.toolCalls = data.toolCalls;
      if (Array.isArray(data.toolResults)) meta.toolResults = data.toolResults;
      if (isRecord(data.actionRequired)) meta.actionRequired = data.actionRequired;
      if (data.visibility === "internal" || data.visibility === "public") {
        meta.visibility = data.visibility;
      }
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      sendEvent(controller, { type: "data", data: meta });
      if (content) {
        for (const chunk of chunkText(content)) {
          sendEvent(controller, { type: "text", value: chunk });
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      }
      sendEvent(controller, { type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
