import { env } from '../config/env';
import { logger } from '../lib/logger';

function main(): void {
  logger.info(`Backend workspace ready in ${env.nodeEnv} mode.`);
}

main();
