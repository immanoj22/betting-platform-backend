import Redis from "ioredis";

// Bug fix (BS-GAME-004): the engine previously guarded itself with only an
// in-process `running` flag — if a second instance of this service ever ran
// (a redeploy overlap, an autoscale blip, a misconfigured second process),
// both would drive the crash loop and both would scan for payouts,
// correctness leaning entirely on the on-chain program rejecting the
// duplicate. This adds a real cross-process lock via Redis (SET NX + a TTL,
// renewed on every tick) so only one process's loop is ever actually active
// at a time — a second instance acquires nothing and stays idle.
const LOCK_KEY = "crashEngine:leader-lock";
const LOCK_TTL_MS = 5000;

export default class CrashEngine {
  constructor(handleCrashGameSession, intervalMs = 100) {
    this.handleCrashGameSession = handleCrashGameSession;
    this.intervalMs = intervalMs;
    this.running = false;
    this.redis = new Redis();
    this.instanceId = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  async acquireOrRenewLock() {
    try {
      // Try to become leader (only succeeds if no one else holds the lock).
      const acquired = await this.redis.set(
        LOCK_KEY,
        this.instanceId,
        "PX",
        LOCK_TTL_MS,
        "NX",
      );
      if (acquired) return true;

      // Already leader? Renew our own TTL so we don't lose leadership mid-run.
      const currentHolder = await this.redis.get(LOCK_KEY);
      if (currentHolder === this.instanceId) {
        await this.redis.set(LOCK_KEY, this.instanceId, "PX", LOCK_TTL_MS);
        return true;
      }

      return false;
    } catch (err) {
      console.error("CrashEngine lock error:", err);
      // Fail closed: if Redis is unreachable, don't claim leadership.
      return false;
    }
  }

  async releaseLock() {
    try {
      const currentHolder = await this.redis.get(LOCK_KEY);
      if (currentHolder === this.instanceId) {
        await this.redis.del(LOCK_KEY);
      }
    } catch (err) {
      console.error("CrashEngine unlock error:", err);
    }
  }

  async loop() {
    if (!this.running) return;

    try {
      const isLeader = await this.acquireOrRenewLock();
      if (isLeader) {
        await this.handleCrashGameSession();
      }
    } catch (err) {
      console.error("Crash Engine Error:", err);
    }

    setTimeout(() => this.loop(), this.intervalMs);
  }

  start() {
    if (this.running) return;
    this.running = true;

    console.log(`CrashEngine started at ${this.intervalMs}ms interval.`);

    this.loop();
  }

  async stop() {
    this.running = false;
    await this.releaseLock();
    console.log("CrashEngine stopped.");
  }
}
