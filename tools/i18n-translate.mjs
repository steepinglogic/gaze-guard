import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcPath = path.join(root, "_locales/zh_TW/messages.json");
const srcJson = readFileSync(srcPath, "utf8");

const ALL_TARGETS = [
  { code: "en",    name: "English" },
  { code: "zh_CN", name: "Simplified Chinese (mainland China usage)" },
  { code: "ja",    name: "Japanese" },
  { code: "ko",    name: "Korean" },
  { code: "fr",    name: "French" },
  { code: "de",    name: "German" },
  { code: "es",    name: "Spanish" },
];
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);
const TARGETS = ONLY.length ? ALL_TARGETS.filter(t => ONLY.includes(t.code)) : ALL_TARGETS;

function buildPrompt(targetName) {
  return [
    `You are a professional UI translator for a Chrome browser extension called "Gaze Guard" — a tool that uses the webcam to detect when someone is peeking at your screen and triggers a visual alert. All processing is local; no data leaves the device.`,
    ``,
    `Translate every "message" field in the JSON below from Traditional Chinese (zh-TW) to ${targetName}.`,
    ``,
    `Rules:`,
    `1. Output VALID JSON ONLY. No markdown fences, no commentary, no preamble.`,
    `2. Preserve the JSON structure exactly. Keep every key. Do NOT translate keys.`,
    `3. Do NOT modify any "placeholders" object — copy them verbatim.`,
    `4. Preserve placeholder tokens like $COUNT$, $DIST$, $CM$, $N$, $W$ — they MUST appear unchanged in the translated message.`,
    `5. Preserve HTML tags exactly: <b>, </b>, <br>.`,
    `6. Preserve symbols like ✓ ✗ → and surrounding whitespace.`,
    `7. Keep "Gaze Guard" as the product name (do not translate).`,
    `8. Use natural, concise UI language appropriate for ${targetName}. Avoid awkward literal translations.`,
    `9. For "kofiSupport" keep it as English "Support me on Ko-fi" regardless of target language.`,
    ``,
    `Source JSON:`,
    srcJson,
  ].join("\n");
}

for (const t of TARGETS) {
  const outDir = path.join(root, "_locales", t.code);
  const outFile = path.join(outDir, "messages.json");
  console.log(`→ translating ${t.code} (${t.name})…`);

  const prompt = buildPrompt(t.name);
  const r = spawnSync("gemini", ["-p", prompt], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: 300_000,
  });

  if (r.error) {
    console.error(`  ✗ spawn error:`, r.error.message);
    continue;
  }
  if (r.status !== 0) {
    console.error(`  ✗ exit ${r.status}: ${r.stderr?.slice(0, 200)}`);
    continue;
  }

  let body = (r.stdout || "").trim();
  body = body.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

  try {
    const parsed = JSON.parse(body);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(outFile, JSON.stringify(parsed, null, 2) + "\n", "utf8");
    console.log(`  ✓ wrote ${path.relative(root, outFile)} (${Object.keys(parsed).length} keys)`);
  } catch (e) {
    console.error(`  ✗ JSON parse failed:`, e.message);
    const dump = path.join(outDir, "_raw.txt");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(dump, body, "utf8");
    console.error(`     raw dumped to ${path.relative(root, dump)}`);
  }
}
