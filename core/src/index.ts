import { config, assertConfig } from './config.js';
import { runAgentTurn, type CallBudget } from './agent.js';
import { fetchPendingCommand } from './api.js';

assertConfig();

console.log(
  `[aye-core] starting dailyLimit=${config.dailyCallLimit} ` +
    `apiUrl=${config.agentApiUrl} commandUrl=${config.commandApiUrl}`,
);

const callBudget: CallBudget = { remaining: config.dailyCallLimit };
let dailyResetAt = nextUtcMidnightMs();

function nextUtcMidnightMs(): number {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

let stop = false;
function shutdown(sig: string) {
  console.log(`[aye-core] ${sig} — exiting`);
  stop = true;
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function runTurn(prompt: string) {
  try {
    const r = await runAgentTurn({ callBudget, prompt });
    if (r.skipped) {
      console.warn(`[aye-core] turn skipped: ${r.reason}`);
    } else {
      const allCalls = (r.steps ?? []).flatMap((s) => s.toolCalls ?? []);
      const tools = allCalls.map((c) => c.toolName).join(',') || '-';
      const text = (r.text ?? '').replace(/\s+/g, ' ').slice(0, 200);
      console.log(
        `[aye-core] turn ok finish=${r.finishReason} tools=[${tools}] usage=${JSON.stringify(r.usage)} text="${text}"`,
      );
      for (const s of r.steps ?? []) {
        for (const tr of s.toolResults ?? []) {
          const out = JSON.stringify((tr as { result?: unknown }).result).slice(0, 200);
          console.log(`[aye-core]   tool ${tr.toolName} → ${out}`);
        }
      }
    }
  } catch (e) {
    console.error(`[aye-core] turn error: ${(e as Error).message}`);
  }
}

async function loop() {
  while (!stop) {
    if (Date.now() >= dailyResetAt) {
      callBudget.remaining = config.dailyCallLimit;
      dailyResetAt = nextUtcMidnightMs();
      console.log(`[aye-core] daily call budget reset → ${callBudget.remaining}`);
    }

    const cmd = await fetchPendingCommand();
    if (cmd) {
      console.log(`[aye-core] command received id=${cmd.id} prompt="${cmd.prompt.slice(0, 120)}"`);
      await runTurn(cmd.prompt);
    }

    if (stop) break;
    await sleep(config.commandPollMs);
  }
  process.exit(0);
}

// main loop
loop().catch((e) => {
  console.error('[aye-core] fatal:', e);
  process.exit(1);
});
