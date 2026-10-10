// Stop: the agent may not finish while `pnpm check` is red.
// Exit 2 blocks the stop and sends stderr back to the agent as its next instruction.
import { git, readInput, run, shouldRunGate, tail } from "./lib.ts";

const input = await readInput();

const runGate = shouldRunGate({
  stopHookActive: input.stop_hook_active === true,
  dirty: git("status", "--porcelain") !== "",
  aheadOfMain: Number(git("rev-list", "--count", "main..HEAD") || 0) > 0,
});
if (!runGate) process.exit(0);

const gate = run("pnpm", ["check"]);
if (!gate.ok) {
  process.stderr.write(
    "`pnpm check` is failing, so the task is not done. Fix the failures below and re-run it. " +
      "If you cannot fix them, stop and tell the user exactly what is failing; do not claim success.\n\n" +
      tail(gate.output, 80),
  );
  process.exit(2);
}
