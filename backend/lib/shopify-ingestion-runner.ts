import { ingestBrandProducts, loadIngestionCandidateBrands } from './brand-ingestion';
import { logger } from './logger';

export interface ShopifyIngestionSummary {
  brandsProcessed: number;
  productsInserted: number;
  productsUpdated: number;
  failures: number;
}

function parseDomainFilters(argv: string[]): string[] {
  return argv
    .flatMap((arg) => arg.split(','))
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

export async function runShopifyIngestionRunner(options?: {
  domains?: string[];
  currency?: string;
}): Promise<ShopifyIngestionSummary> {
  const domainFilters = options?.domains ?? [];

  logger.info('Starting Shopify ingestion runner');
  if (domainFilters.length > 0) {
    logger.info(`Domain filter active: ${domainFilters.join(', ')}`);
  }

  const brands = await loadIngestionCandidateBrands(domainFilters);
  if (brands.length === 0) {
    logger.warn('No ingestion candidate brands found.');
    return { brandsProcessed: 0, productsInserted: 0, productsUpdated: 0, failures: 0 };
  }

  const summary: ShopifyIngestionSummary = {
    brandsProcessed: 0,
    productsInserted: 0,
    productsUpdated: 0,
    failures: 0,
  };

  for (const brand of brands) {
    summary.brandsProcessed += 1;

    try {
      const result = await ingestBrandProducts(brand.id);
      summary.productsUpdated += result.productsProcessed;
      logger.info(`SUCCESS ${brand.name} (${brand.domain}) -> processed=${result.productsProcessed}, status=${result.ingestionStatus}`);
    } catch (error: unknown) {
      summary.failures += 1;
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`FAILURE ${brand.name} (${brand.domain}): ${message}`);
    }
  }

  logger.info(
    `Shopify ingestion summary: brands_processed=${summary.brandsProcessed}, products_inserted=${summary.productsInserted}, products_updated=${summary.productsUpdated}, failures=${summary.failures}`
  );

  return summary;
}

export function parseDomainArgs(argv: string[]): string[] {
  return parseDomainFilters(argv);
}
