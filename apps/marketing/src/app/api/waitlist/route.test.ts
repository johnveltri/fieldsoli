import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { POST } from "./route";

const validBody = {
  firstName: "Jane",
  email: "jane@example.com",
  trades: ["plumbing"],
  usesSoftware: false,
  trackingTools: ["notes_paper_memory"],
  jobSources: ["referrals"],
  privacyAccepted: true,
};

function makeRequest(
  body: unknown,
  headers: Record<string, string> = { "Content-Type": "application/json" },
) {
  return new Request("http://localhost/api/waitlist", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function mockSupabase({
  insertError = null,
  updateError = null,
  rateLimitAllowed = true,
  rateLimitError = null,
}: {
  insertError?: { code?: string; message?: string } | null;
  updateError?: { code?: string; message?: string } | null;
  rateLimitAllowed?: boolean;
  rateLimitError?: { code?: string; message?: string } | null;
} = {}) {
  const insert = vi.fn().mockResolvedValue({ error: insertError });
  const eq = vi.fn().mockResolvedValue({ error: updateError });
  const update = vi.fn().mockReturnValue({ eq });
  const rpc = vi.fn().mockResolvedValue({ data: rateLimitAllowed, error: rateLimitError });
  vi.mocked(getSupabaseAdmin).mockReturnValue({
    from: vi.fn().mockReturnValue({ insert, update }),
    rpc,
  } as never);
  return { insert, update, eq, rpc };
}

describe("POST /api/waitlist", () => {
  beforeEach(() => {
    vi.mocked(getSupabaseAdmin).mockReset();
    process.env.WAITLIST_RATE_LIMIT_SALT = "test-rate-limit-secret";
  });

  it("returns 400 for invalid JSON", async () => {
    const response = await POST(makeRequest("{"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "Invalid request body.",
    });
  });

  it("returns 400 for invalid payload", async () => {
    const response = await POST(makeRequest({ firstName: "", email: "bad" }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "Please check your entries and try again.",
    });
  });

  it("rejects cross-origin requests", async () => {
    const response = await POST(makeRequest(validBody, {
      "Content-Type": "application/json",
      Origin: "https://attacker.example",
    }));
    expect(response.status).toBe(403);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("rejects oversized request bodies", async () => {
    const response = await POST(makeRequest({ ...validBody, firstName: "a".repeat(17_000) }));
    expect(response.status).toBe(413);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("silently accepts honeypot submissions without writing", async () => {
    const response = await POST(makeRequest({ ...validBody, website: "spam.example" }));
    expect(response.status).toBe(201);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("accepts the safe form-encoded fallback", async () => {
    const { insert } = mockSupabase();
    const body = new URLSearchParams({
      firstName: "Jane",
      email: "jane@example.com",
      trades: "plumbing",
      usesSoftware: "no",
      trackingTools: "notes_paper_memory",
      jobSources: "referrals",
      privacyAccepted: "true",
    }).toString();

    const response = await POST(makeRequest(body, {
      "Content-Type": "application/x-www-form-urlencoded",
    }));

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledOnce();
  });

  it("rejects a form fallback without an explicit software choice", async () => {
    const body = new URLSearchParams({
      firstName: "Jane",
      email: "jane@example.com",
      trades: "plumbing",
      trackingTools: "notes_paper_memory",
      jobSources: "referrals",
      privacyAccepted: "true",
    }).toString();

    const response = await POST(makeRequest(body, {
      "Content-Type": "application/x-www-form-urlencoded",
    }));

    expect(response.status).toBe(400);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns 201 and inserts a consented signup on success", async () => {
    const { insert, rpc } = mockSupabase();

    const response = await POST(makeRequest(validBody));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true, message: "You're on the list!" });
    expect(rpc).toHaveBeenCalledWith("consume_waitlist_rate_limit", {
      p_key_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_limit: 10,
    });
    expect(insert).toHaveBeenCalledWith({
      first_name: "Jane",
      email: "jane@example.com",
      trades: ["plumbing"],
      uses_software: false,
      tracking_tools: ["notes_paper_memory"],
      job_sources: ["referrals"],
      privacy_policy_version: "2026-09-20",
      privacy_accepted_at: expect.any(String),
      terms_version: "2026-09-20",
      terms_accepted_at: expect.any(String),
      marketing_consent: true,
    });
    const insertedRecord = insert.mock.calls[0]?.[0];
    expect(insertedRecord.terms_accepted_at).toBe(insertedRecord.privacy_accepted_at);
  });

  it("returns 429 when the IP rate limit is exhausted", async () => {
    const { insert } = mockSupabase({ rateLimitAllowed: false });
    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("3600");
    expect(insert).not.toHaveBeenCalled();
  });

  it("fails closed when rate limiting is unavailable", async () => {
    const { insert } = mockSupabase({ rateLimitError: { code: "XX000" } });
    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(503);
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns 200 and refreshes consent when the email is already on the list", async () => {
    const { update, eq } = mockSupabase({
      insertError: { code: "23505", message: "duplicate key value" },
    });
    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      message: "You're already on the list. We'll be in touch soon.",
    });
    expect(update).toHaveBeenCalledWith({
      first_name: "Jane",
      trades: ["plumbing"],
      uses_software: false,
      tracking_tools: ["notes_paper_memory"],
      job_sources: ["referrals"],
      privacy_policy_version: "2026-09-20",
      privacy_accepted_at: expect.any(String),
      terms_version: "2026-09-20",
      terms_accepted_at: expect.any(String),
      marketing_consent: true,
    });
    const updatedRecord = update.mock.calls[0]?.[0];
    expect(updatedRecord.terms_accepted_at).toBe(updatedRecord.privacy_accepted_at);
    expect(eq).toHaveBeenCalledWith("email", "jane@example.com");
  });

  it("returns 500 when consent refresh fails for a duplicate email", async () => {
    mockSupabase({
      insertError: { code: "23505", message: "duplicate key value" },
      updateError: { code: "42501", message: "permission denied" },
    });
    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });

  it("returns 500 for unexpected insert failures", async () => {
    mockSupabase({ insertError: { code: "XX000", message: "boom" } });
    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
