import type { Logger } from '../application/ports/system'

/**
 * Graceful shutdown on SIGTERM/SIGINT: stop taking work, finish in-flight
 * work, close connections. A second signal (or a 30s timeout) forces exit.
 */
export function onShutdown(logger: Logger, cleanup: () => Promise<void>): void {
  let shuttingDown = false

  const handler = async (signal: NodeJS.Signals) => {
    if (shuttingDown) process.exit(1)
    shuttingDown = true
    logger.info({ signal }, 'shutting down')

    const force = setTimeout(() => {
      logger.error({}, 'shutdown timed out, forcing exit')
      process.exit(1)
    }, 30_000)
    force.unref()

    try {
      await cleanup()
      process.exit(0)
    } catch (err) {
      logger.error({ err }, 'error during shutdown')
      process.exit(1)
    }
  }

  process.on('SIGTERM', handler)
  process.on('SIGINT', handler)
}
