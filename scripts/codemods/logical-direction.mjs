#!/usr/bin/env node
/**
 * P2 codemod — physical Tailwind direction utilities to logical ones.
 *
 * AST-driven, never a regex over file text. Ten English phrases in this repo
 * match a bare /\bright-\w+/ ("right-rail", "right-to-left", "right-hand",
 * "right-column-title", "left-rule", ...), and a text-level pass corrupts
 * every one of them.
 *
 * Uses the TypeScript compiler API rather than jscodeshift: `typescript` is
 * already a dependency, and this is a client-handover repo where a build-time
 * dependency added for one migration is a dependency someone inherits.
 *
 *   node scripts/codemods/logical-direction.mjs --dry     # report only
 *   node scripts/codemods/logical-direction.mjs --write
 */
import ts from "typescript";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const WRITE = process.argv.includes("--write");

/** Utilities with a true logical equivalent. Order matters: longest first. */
const MAP = [
  ["text-left", "text-start"],
  ["text-right", "text-end"],
  ["float-left", "float-start"],
  ["float-right", "float-end"],
  ["scroll-ml", "scroll-ms"],
  ["scroll-mr", "scroll-me"],
  ["rounded-tl", "rounded-ss"],
  ["rounded-tr", "rounded-se"],
  ["rounded-bl", "rounded-es"],
  ["rounded-br", "rounded-ee"],
  ["rounded-l", "rounded-s"],
  ["rounded-r", "rounded-e"],
  ["border-l", "border-s"],
  ["border-r", "border-e"],
  ["ml", "ms"],
  ["mr", "me"],
  ["pl", "ps"],
  ["pr", "pe"],
  ["left", "start"],
  ["right", "end"],
];

/**
 * No logical form exists — these need an explicit ltr:/rtl: pair, which is a
 * judgement call about intent rather than a mechanical swap. Reported, never
 * rewritten.
 */
const NEEDS_PAIR = /^-?(translate-x|origin-(left|right)|object-(left|right)|bg-(left|right))(-|$)/;

/** Splits `md:hover:-ml-2` into { variants:"md:hover:", neg:"-", rest:"ml-2" }. */
function parseToken(token) {
  const m = token.match(/^((?:[\w[\]=^~*.$/-]+:)*)(-?)(.+)$/);
  if (!m) return null;
  return { variants: m[1] ?? "", neg: m[2] ?? "", rest: m[3] };
}

/** Longest first, so `text-left` wins over `left` and `rounded-tl` over `rounded-l`. */
const MAP_BY_LENGTH = [...MAP].sort((a, b) => b[0].length - a[0].length);

function mapToken(token) {
  const parsed = parseToken(token);
  if (!parsed) return null;
  // `data-[side=left]:` etc. is *physical placement* from Radix — a physical
  // utility keyed off it is already correct in both directions.
  if (/data-\[side=(left|right)\]/.test(parsed.variants)) return null;

  for (const [from, to] of MAP_BY_LENGTH) {
    // Match the whole utility (`text-left`) or its prefix before a value
    // (`ml-2`, `rounded-tl-sm`). The `-` boundary is what stops `rounded-l`
    // from eating `rounded-l`+`g`, or `pl` from eating any `pl`+`ace-*`
    // utility. (Written spliced like that on purpose: Tailwind scans this
    // directory, and a real class name in a comment ships a stray rule.)
    if (parsed.rest === from) {
      return `${parsed.variants}${parsed.neg}${to}`;
    }
    if (parsed.rest.startsWith(`${from}-`)) {
      return `${parsed.variants}${parsed.neg}${to}${parsed.rest.slice(from.length)}`;
    }
  }
  return null;
}

/** Class strings where a physical value is deliberate and must not change. */
function skipReason(classString) {
  // `left-1/2` paired with `-translate-x-1/2` is centring, not direction:
  // `start-1/2` flips to right:50% while the translate does not, and the
  // element jumps half its own width.
  if (/(^|\s)-?translate-x-1\/2(\s|$)/.test(classString) &&
      /(^|\s)(left|right)-1\/2(\s|$)/.test(classString)) {
    return "centring pair (left-1/2 + -translate-x-1/2)";
  }
  return null;
}

const findings = { converted: 0, pairs: [], skipped: [], files: new Set() };

function transformClassString(text, file) {
  const skip = skipReason(text);
  if (skip) {
    findings.skipped.push({ file, text: text.trim(), reason: skip });
    return text;
  }
  let changed = false;
  const out = text
    .split(/(\s+)/)
    .map((tok) => {
      if (!tok.trim()) return tok;
      // Check the data-[side=] exemption BEFORE reporting a needed pair:
      // `data-[side=left]:-translate-x-1` is Radix physical placement and is
      // already correct in both directions. Reporting it would send a reviewer
      // to fix something that is not broken.
      const parsed = parseToken(tok);
      const sidePinned = parsed && /data-\[side=(left|right)\]/.test(parsed.variants);
      if (!sidePinned && NEEDS_PAIR.test(tok)) {
        findings.pairs.push({ file, token: tok });
        return tok;
      }
      const mapped = mapToken(tok);
      if (mapped && mapped !== tok) {
        changed = true;
        findings.converted++;
        return mapped;
      }
      return tok;
    })
    .join("");
  if (changed) findings.files.add(file);
  return out;
}

const CLASS_FNS = new Set(["cn", "clsx", "classNames", "twMerge", "cva"]);
const CLASS_ID = /(class|Class|classes|Styles?)$/;

function collectStringNodes(sourceFile) {
  /** @type {{start:number,end:number,text:string}[]} */
  const edits = [];

  const pushLiteral = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      edits.push({ start: node.getStart(sourceFile) + 1, end: node.getEnd() - 1, text: node.text });
    } else if (ts.isTemplateExpression(node)) {
      // Quasis only — never the ${} expressions.
      pushSpan(node.head);
      node.templateSpans.forEach((s) => pushSpan(s.literal));
    } else if (ts.isConditionalExpression(node)) {
      pushLiteral(node.whenTrue);
      pushLiteral(node.whenFalse);
    } else if (ts.isBinaryExpression(node)) {
      pushLiteral(node.left);
      pushLiteral(node.right);
    } else if (ts.isArrayLiteralExpression(node)) {
      node.elements.forEach(pushLiteral);
    } else if (ts.isObjectLiteralExpression(node)) {
      node.properties.forEach((p) => {
        if (ts.isPropertyAssignment(p)) pushLiteral(p.initializer);
      });
    } else if (ts.isCallExpression(node) && isClassCall(node)) {
      node.arguments.forEach(pushLiteral);
    }
  };

  const pushSpan = (lit) => {
    const raw = lit.getText(sourceFile);
    const inner = raw.replace(/^[`}]/, "").replace(/(\${|`)$/, "");
    const start = lit.getStart(sourceFile) + (raw.startsWith("`") || raw.startsWith("}") ? 1 : 0);
    edits.push({ start, end: start + inner.length, text: inner });
  };

  const isClassCall = (node) =>
    ts.isIdentifier(node.expression) && CLASS_FNS.has(node.expression.text);

  const visit = (node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(sourceFile).match(/^(className|class)$/)) {
      if (node.initializer) {
        if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          pushLiteral(node.initializer.expression);
        } else {
          pushLiteral(node.initializer);
        }
      }
    } else if (ts.isCallExpression(node) && isClassCall(node)) {
      node.arguments.forEach(pushLiteral);
    } else if (ts.isVariableDeclaration(node) && node.name.getText(sourceFile).match(CLASS_ID) && node.initializer) {
      pushLiteral(node.initializer);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  // Dedupe by span. A `cn(...)` inside a className attribute is reached twice —
  // once through the JsxAttribute branch and again when the walker arrives at
  // the CallExpression itself — and applying the same replacement to the same
  // span twice corrupts the text rather than being idempotent. It shows up as
  // an inserted character (`zoom-out-95` becoming `zoom-out-955`), which the
  // type-checker cannot see and only the emitted-CSS diff catches.
  const seen = new Set();
  return edits.filter((e) => {
    const key = `${e.start}:${e.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const files = execFileSync(
  "git",
  ["ls-files", "app/**/*.tsx", "app/**/*.ts", "components/**/*.tsx", "lib/**/*.tsx", "lib/**/*.ts"],
  { encoding: "utf8" },
).trim().split("\n").filter(Boolean);

for (const file of files) {
  const src = readFileSync(file, "utf8");
  if (!/class|cn\(|cva\(/.test(src)) continue;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = collectStringNodes(sf);
  if (!edits.length) continue;

  let out = src;
  // Apply back-to-front so offsets stay valid.
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    const replaced = transformClassString(e.text, file);
    if (replaced !== e.text) out = out.slice(0, e.start) + replaced + out.slice(e.end);
  }
  if (out !== src && WRITE) writeFileSync(file, out);
}

console.log(`converted ${findings.converted} utilities across ${findings.files.size} files`);
if (findings.pairs.length) {
  const byToken = {};
  for (const p of findings.pairs) byToken[p.token] = (byToken[p.token] ?? 0) + 1;
  console.log(`\nneed an explicit ltr:/rtl: pair (${findings.pairs.length}) — review by hand:`);
  Object.entries(byToken).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log(`  ${String(n).padStart(3)}  ${t}`));
}
if (findings.skipped.length) {
  console.log(`\nskipped as deliberate (${findings.skipped.length}):`);
  findings.skipped.forEach((s) => console.log(`  ${s.file}: ${s.reason}`));
}
if (!WRITE) console.log("\n(dry run — pass --write to apply)");
