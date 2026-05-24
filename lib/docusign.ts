/**
 * Sprint 13 — DocuSign envelope creation + webhook verification.
 *
 * Uses JWT bearer auth (DocuSign's recommended server-to-server flow).
 * Falls back to no-op when env isn't configured so the rest of the
 * Form A / NOC / offer flow still runs (admin manually emails docs
 * during the gap).
 *
 * Webhook events (Connect) ping /api/webhooks/docusign with envelope
 * status updates; we verify with HMAC-SHA256 against
 * DOCUSIGN_WEBHOOK_SECRET.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { env, isDocuSignConfigured } from "@/lib/env";

export type EnvelopeSigner = {
  name: string;
  email: string;
  role: string;
};

export type CreateEnvelopeInput = {
  templateId?: string;
  documentBase64?: string;
  documentName?: string;
  emailSubject: string;
  signers: EnvelopeSigner[];
  // Optional metadata stored on the envelope (referenced in webhooks).
  customFields?: Record<string, string>;
};

export type CreateEnvelopeResult = {
  ok: boolean;
  envelopeId?: string;
  status?: string;
  reason?: string;
};

/** Acquire an access token via JWT bearer grant. Returns null when
 *  env isn't set OR the exchange fails. Caches in-memory for
 *  ~50 minutes (token life is 1 hour). */
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  if (!isDocuSignConfigured) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  try {
    // Build the JWT manually to avoid pulling in jose for one use.
    const header = {
      alg: "RS256",
      typ: "JWT",
    };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: env.DOCUSIGN_INTEGRATION_KEY,
      sub: env.DOCUSIGN_USER_ID,
      iat: now,
      exp: now + 3600,
      aud: "account-d.docusign.com",
      scope: "signature impersonation",
    };
    const { createSign } = await import("node:crypto");
    const enc = (o: object) =>
      Buffer.from(JSON.stringify(o))
        .toString("base64")
        .replace(/=+$/, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
    const signingInput = `${enc(header)}.${enc(payload)}`;
    const signer = createSign("RSA-SHA256");
    signer.update(signingInput);
    const signature = signer
      .sign(env.DOCUSIGN_PRIVATE_KEY ?? "", "base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const jwt = `${signingInput}.${signature}`;
    const res = await fetch("https://account-d.docusign.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    if (!res.ok) {
      console.error("[docusign jwt]", res.status, await res.text().catch(() => ""));
      return null;
    }
    const json = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    cachedToken = {
      value: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
    return json.access_token;
  } catch (e) {
    console.error("[docusign jwt threw]", (e as Error).message);
    return null;
  }
}

export async function createEnvelope(
  input: CreateEnvelopeInput,
): Promise<CreateEnvelopeResult> {
  if (!isDocuSignConfigured) {
    return { ok: false, reason: "DocuSign not configured" };
  }
  const token = await getAccessToken();
  if (!token) return { ok: false, reason: "JWT exchange failed" };

  const base =
    env.DOCUSIGN_BASE_URL ?? "https://demo.docusign.net/restapi";
  const accountId = env.DOCUSIGN_ACCOUNT_ID!;
  const url = `${base}/v2.1/accounts/${accountId}/envelopes`;

  const recipients = {
    signers: input.signers.map((s, i) => ({
      email: s.email,
      name: s.name,
      recipientId: String(i + 1),
      routingOrder: String(i + 1),
      roleName: s.role,
    })),
  };

  const body: Record<string, unknown> = {
    emailSubject: input.emailSubject,
    status: "sent",
    recipients,
  };

  if (input.templateId) {
    body.templateId = input.templateId;
    body.templateRoles = input.signers.map((s, i) => ({
      email: s.email,
      name: s.name,
      roleName: s.role,
      routingOrder: String(i + 1),
    }));
  } else if (input.documentBase64) {
    body.documents = [
      {
        documentBase64: input.documentBase64,
        name: input.documentName ?? "Document.pdf",
        fileExtension: "pdf",
        documentId: "1",
      },
    ];
  }

  if (input.customFields) {
    body.customFields = {
      textCustomFields: Object.entries(input.customFields).map(([k, v]) => ({
        name: k,
        value: v,
        required: "false",
        show: "false",
      })),
    };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, reason: `${res.status} ${text.slice(0, 200)}` };
    }
    const json = (await res.json()) as {
      envelopeId: string;
      status: string;
    };
    return { ok: true, envelopeId: json.envelopeId, status: json.status };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

/** Verify a DocuSign Connect HMAC signature. They send the body and
 *  the signature header `X-DocuSign-Signature-1` is base64 HMAC-SHA256
 *  of the raw body using the secret. */
export function verifyDocuSignWebhook(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!env.DOCUSIGN_WEBHOOK_SECRET || !signatureHeader) return false;
  const expected = createHmac("sha256", env.DOCUSIGN_WEBHOOK_SECRET)
    .update(rawBody)
    .digest();
  let presented: Buffer;
  try {
    presented = Buffer.from(signatureHeader, "base64");
  } catch {
    return false;
  }
  if (presented.length !== expected.length) return false;
  return timingSafeEqual(presented, expected);
}
