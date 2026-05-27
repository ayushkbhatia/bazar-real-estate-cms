const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";

export const log = {
  step(label: string) {
    console.log(`\n${BOLD}${CYAN}▸ ${label}${RESET}`);
  },
  ok(msg: string) {
    console.log(`  ${GREEN}✓${RESET} ${msg}`);
  },
  warn(msg: string) {
    console.log(`  ${YELLOW}!${RESET} ${msg}`);
  },
  fail(msg: string) {
    console.log(`  ${RED}✗${RESET} ${msg}`);
  },
  dim(msg: string) {
    console.log(`  ${DIM}${msg}${RESET}`);
  },
  summary(rows: { label: string; before: number; after: number }[]) {
    console.log(`\n${BOLD}Summary${RESET}`);
    const width = Math.max(...rows.map((r) => r.label.length));
    for (const r of rows) {
      const delta = r.after - r.before;
      const sign = delta > 0 ? `+${delta}` : delta === 0 ? "·" : `${delta}`;
      const color = delta > 0 ? GREEN : delta < 0 ? RED : DIM;
      console.log(
        `  ${r.label.padEnd(width)}  ${String(r.before).padStart(4)} → ${String(r.after).padStart(4)}  ${color}${sign}${RESET}`,
      );
    }
  },
};
