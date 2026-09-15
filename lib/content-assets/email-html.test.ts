import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import type { EmailContext } from "./email-html";
import { DEFAULT_EMAIL_BRAND } from "./email-brand";

const SUPABASE = "https://proj.supabase.co";

beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://bazar.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE);
});
afterAll(() => {
  vi.unstubAllEnvs();
});

async function mod() {
  vi.resetModules();
  return import("./email-html");
}

const BRAND = { ...DEFAULT_EMAIL_BRAND, buttonColor: "#123456", linkColor: "#ABCDEF" };

describe("sanitizeEmailBody", () => {
  it("keeps everything the editor can produce", async () => {
    const { sanitizeEmailBody } = await mod();
    const html =
      '<h2>Title</h2><h3>Sub</h3><p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s> <a href="https://x.test">l</a></p>' +
      "<ul><li><p>one</p></li></ul><ol><li><p>two</p></li></ol><blockquote><p>q</p></blockquote><hr>" +
      '<a data-email-button="" href="{{confirm_url}}">Go</a>' +
      `<img src="${SUPABASE}/storage/v1/object/public/media/brand/abc-logo.png" data-media-key="brand/abc-logo.png" alt="Logo" width="200">`;
    const out = sanitizeEmailBody(html);
    for (const tag of ["<h2>", "<h3>", "<strong>", "<em>", "<u>", "<s>", "<ul>", "<ol>", "<blockquote>", "<hr />"]) {
      expect(out, tag).toContain(tag);
    }
    expect(out).toContain('<a href="{{confirm_url}}" data-email-button>Go</a>');
    expect(out).toContain('data-media-key="brand/abc-logo.png"');
    expect(out).toContain('width="200"');
  });

  it("strips scripts, styles, handlers and hostile schemes", async () => {
    const { sanitizeEmailBody } = await mod();
    const out = sanitizeEmailBody(
      '<p style="color:red" onclick="x()">hi</p><script>alert(1)</script><style>p{}</style>' +
        '<a href="javascript:alert(1)">bad</a><iframe src="https://evil.test"></iframe>',
    );
    expect(out).toBe("<p>hi</p><a>bad</a>");
  });

  it("drops images from anywhere but this project's media library", async () => {
    const { sanitizeEmailBody } = await mod();
    expect(sanitizeEmailBody('<img src="https://tracker.test/pixel.gif">')).toBe("");
  });

  it("restores token targets a browser percent-encoded", async () => {
    const { sanitizeEmailBody } = await mod();
    expect(sanitizeEmailBody('<a href="%7B%7Bconfirm_url%7D%7D">x</a>')).toBe(
      '<a href="{{confirm_url}}">x</a>',
    );
  });

  it("is idempotent", async () => {
    const { sanitizeEmailBody } = await mod();
    const once = sanitizeEmailBody('<p>Hi <a href="https://x.test">x</a></p><hr>');
    expect(sanitizeEmailBody(once)).toBe(once);
  });
});

describe("renderEmailBodyHtml", () => {
  const ctx: EmailContext = {
    values: {
      lead_first_name: "Amira",
      confirm_url: "https://bazar.example/newsletter/confirm/abc?x=1&y=2",
      enquiry_message: "Line one\nLine <two>",
    },
    blocks: {
      form_answers: { html: "<table><tr><td>Name</td></tr></table>", text: "Name: Amira" },
    },
  };

  it("inlines styles, because inboxes discard <style>", async () => {
    const { renderEmailBodyHtml } = await mod();
    const out = renderEmailBodyHtml("<h2>Welcome</h2><p>Hi</p>", ctx, BRAND);
    expect(out).toMatch(/<h2 style="[^"]*font-family:Georgia/);
    expect(out).toContain('<p style="margin:0 0 14px">Hi</p>');
  });

  it("draws a button in the brand colour, on its own line, pointing at the token's value", async () => {
    const { renderEmailBodyHtml } = await mod();
    const out = renderEmailBodyHtml(
      '<a data-email-button="" href="{{confirm_url}}">Confirm</a>',
      ctx,
      BRAND,
    );
    expect(out).toContain("background:#123456");
    expect(out).toContain('href="https://bazar.example/newsletter/confirm/abc?x=1&amp;y=2"');
    expect(out.startsWith('<p style="margin:22px 0"><a ')).toBe(true);
  });

  it("colours ordinary links with the link colour", async () => {
    const { renderEmailBodyHtml } = await mod();
    const out = renderEmailBodyHtml('<p><a href="https://x.test">x</a></p>', ctx, BRAND);
    expect(out).toContain("color:#ABCDEF");
  });

  it("escapes token values and keeps their line breaks", async () => {
    const { renderEmailBodyHtml } = await mod();
    const out = renderEmailBodyHtml("<p>{{enquiry_message}}</p>", ctx, BRAND);
    expect(out).toContain("Line one<br>Line &lt;two&gt;");
  });

  it("swaps a panel token on its own line for the whole panel", async () => {
    const { renderEmailBodyHtml } = await mod();
    const out = renderEmailBodyHtml("<p>{{form_answers}}</p>", ctx, BRAND);
    expect(out).toBe("<table><tr><td>Name</td></tr></table>");
  });

  it("uses a panel's text form when it is written inside a sentence", async () => {
    const { renderEmailBodyHtml } = await mod();
    const out = renderEmailBodyHtml("<p>See {{form_answers}} here</p>", ctx, BRAND);
    expect(out).toContain("See Name: Amira here");
  });

  it("drops a line whose only token has no value", async () => {
    const { renderEmailBodyHtml } = await mod();
    const out = renderEmailBodyHtml(
      "<p>Hello</p><p>{{property_line}}</p><blockquote><p>{{advisor_notes}}</p></blockquote><p>Bye</p>",
      ctx,
      BRAND,
    );
    expect(out).toBe('<p style="margin:0 0 14px">Hello</p><p style="margin:0 0 14px">Bye</p>');
  });

  it("refuses a token value that would make a link run script", async () => {
    const { renderEmailBodyHtml } = await mod();
    const out = renderEmailBodyHtml(
      '<p><a href="{{lead_first_name}}">x</a></p>',
      { values: { lead_first_name: "javascript:alert(1)" } },
      BRAND,
    );
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("href=");
  });

  it("never expands a token a lead typed into their own data", async () => {
    const { renderEmailBodyHtml } = await mod();
    const out = renderEmailBodyHtml(
      '<p>Hi {{lead_first_name}}</p><p>{{form_answers}}</p><a data-email-button="" href="{{confirm_url}}">Go</a>',
      {
        values: {
          lead_first_name: "{{confirm_url}}",
          confirm_url: "https://bazar.example/c",
        },
        blocks: {
          form_answers: { html: "<table><tr><td>{{confirm_url}}</td></tr></table>", text: "x" },
        },
      },
      BRAND,
    );
    expect(out).toContain("Hi {{confirm_url}}</p>");
    expect(out).toContain("<td>{{confirm_url}}</td>");
    expect(out.match(/https:\/\/bazar\.example\/c/g)?.length).toBe(1);
  });

  it("makes a relative link absolute", async () => {
    const { renderEmailBodyHtml } = await mod();
    const out = renderEmailBodyHtml('<p><a href="/contact">c</a></p>', ctx, BRAND);
    expect(out).toContain('href="https://bazar.example/contact"');
  });

  it("strips an unknown token rather than sending braces", async () => {
    const { renderEmailBodyHtml } = await mod();
    const out = renderEmailBodyHtml("<p>Hi {{propery_ref}}x</p>", ctx, BRAND);
    expect(out).toContain("Hi x");
  });

  it("re-points an image at the current project from its key", async () => {
    const { renderEmailBodyHtml } = await mod();
    const out = renderEmailBodyHtml(
      '<img src="https://old.supabase.co/x.png" data-media-key="brand/abc-logo.png" alt="L">',
      ctx,
      BRAND,
    );
    expect(out).toContain(`src="${SUPABASE}/storage/v1/object/public/media/brand/abc-logo.png"`);
  });
});

describe("renderEmailBodyText", () => {
  it("flattens structure into readable plain text", async () => {
    const { renderEmailBodyText } = await mod();
    const out = renderEmailBodyText(
      "<h2>Welcome</h2><p>Hi {{lead_first_name}},</p>" +
        "<ul><li><p>one</p></li><li><p>two</p></li></ul>" +
        "<ol><li><p>first</p></li><li><p>second</p></li></ol>" +
        "<blockquote><p>{{enquiry_message}}</p></blockquote>" +
        '<p>Read <a href="https://x.test/a">the guide</a>.</p>' +
        '<a data-email-button="" href="{{confirm_url}}">Confirm</a>' +
        "<p>{{form_answers}}</p><p>{{property_line}}</p><p>Bye &amp; thanks</p>",
      {
        values: {
          lead_first_name: "Amira",
          enquiry_message: "Is it free?",
          confirm_url: "https://bazar.example/c",
        },
        blocks: { form_answers: { html: "<table></table>", text: "Name: Amira" } },
      },
    );
    expect(out).toBe(
      [
        "Welcome",
        "",
        "Hi Amira,",
        "",
        "· one",
        "· two",
        "",
        "1. first",
        "2. second",
        "",
        "> Is it free?",
        "",
        "Read the guide (https://x.test/a).",
        "",
        "Confirm: https://bazar.example/c",
        "",
        "Name: Amira",
        "",
        "Bye & thanks",
      ].join("\n"),
    );
  });

  it("drops a quote whose only token is empty", async () => {
    const { renderEmailBodyText } = await mod();
    expect(
      renderEmailBodyText("<p>a</p><blockquote><p>{{advisor_notes}}</p></blockquote><p>b</p>", {
        values: {},
      }),
    ).toBe("a\n\nb");
  });
});

describe("textBodyToHtml", () => {
  it("turns paragraphs and line breaks into markup, escaped", async () => {
    const { textBodyToHtml } = await mod();
    expect(textBodyToHtml("Hi <you>,\n\nLine\nbreak")).toBe(
      "<p>Hi &lt;you&gt;,</p><p>Line<br>break</p>",
    );
  });
});
