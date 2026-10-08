const STATUSES = new Set(["RUNNING", "PASSED", "FAILED", "BLOCKED", "ABORTED"]);

export function deriveCfgRuntime03RetryCount(commands) {
  const seen = new Set();
  let retries = 0;
  for (const command of commands) {
    const key = `${command.sequence}:${command.index}`;
    if (seen.has(key)) retries += 1;
    seen.add(key);
  }
  return retries;
}

export function validateCfgRuntime03AttemptLedger(ledger) {
  if (!ledger || !Array.isArray(ledger.attempts)) throw attemptError("ledger_shape", "attempts array is required");
  const identifiers = new Set();
  ledger.attempts.forEach((attempt, index) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(attempt.attemptId ?? ""))) throw attemptError("attempt_id", `invalid attempt at index ${index}`);
    if (identifiers.has(attempt.attemptId)) throw attemptError("attempt_reuse", `duplicate attempt ${attempt.attemptId}`);
    identifiers.add(attempt.attemptId);
    if (!STATUSES.has(attempt.status)) throw attemptError("attempt_status", `invalid status for ${attempt.attemptId}`);
    if (!Array.isArray(attempt.commands)) throw attemptError("attempt_commands", `commands are required for ${attempt.attemptId}`);
    const commandKeys = new Set();
    for (const command of attempt.commands) {
      const key = `${command.sequence}:${command.index}`;
      if (commandKeys.has(key)) throw attemptError("command_retry", `${attempt.attemptId} repeats ${key}`);
      commandKeys.add(key);
      if (Number(command.retryCount ?? 0) !== 0) throw attemptError("command_retry", `${attempt.attemptId} reports an internal command retry`);
    }
    const expectedRetryCount = deriveCfgRuntime03RetryCount(attempt.commands);
    if (attempt.retryCount !== expectedRetryCount) throw attemptError("retry_falsification", `${attempt.attemptId} retryCount ${attempt.retryCount} differs from derived ${expectedRetryCount}`);
    if (attempt.status === "PASSED" && (!attempt.completedAt || !attempt.postStateHash)) {
      throw attemptError("attempt_completion", `${attempt.attemptId} is incompletely sealed`);
    }
  });
  return true;
}

export function assertCfgRuntime03AcceptanceAttempt(attempt, requirements = { focused: 43, ordered: 27 }) {
  if (attempt.status !== "PASSED") throw attemptError("acceptance_status", "acceptance attempt must pass");
  if (attempt.retryCount !== 0) throw attemptError("acceptance_retry", "zero-retry acceptance applies only to an internally clean first attempt for its profile");
  for (const [suite, expected] of Object.entries(requirements)) {
    const commands = attempt.commands.filter((entry) => entry.sequence === suite);
    if (commands.length !== expected || commands.some((entry) => entry.exitCode !== 0 || entry.retryCount !== 0)) {
      throw attemptError("acceptance_commands", `${suite} is not a complete ${expected}-command zero-retry sequence`);
    }
  }
  return true;
}

function attemptError(category, message) {
  const error = new Error(`${category}: ${message}`);
  error.category = category;
  return error;
}
