export { RENDERER_VERSION, escapeHtml, formatDocumentNumber, formatUsd, renderDocument, renderDocumentPreview, unsupportedRendererHtml } from './render';
export type { DocumentLine, DocumentPayload, DocumentType, PaymentProjection, PaymentTerms } from './render';
export { roundHalfUpBps } from './money';
export {
  OTHER_COST_CATEGORIES,
  OTHER_COST_LABELS,
  TAX_CATEGORIES,
  computeJobPricing,
  solveLaborForRevenue,
} from './pricing';
export type {
  JobPricingInput,
  JobPricingResult,
  OtherCostCategory,
  PricingCostInput,
  TaxableCategory,
} from './pricing';
