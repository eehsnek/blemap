/**
 * @typedef {object} IngestionAdapter
 * @property {() => Promise<import('../../lib/types.js').CaseRecord[]>} getCasesForAnalysis
 * @property {(permalink: string) => Promise<boolean>} hasSeenPermalink
 * @property {(row: object) => Promise<void>} insertPrecase
 * @property {(permalink: string, patch: object) => Promise<void>} updatePrecase
 * @property {(caseId: string, patch: { permalink?: string, subreddit?: string, pain_delta?: number }) => Promise<void>} mergeCase
 * @property {(row: object) => Promise<{ id: string }>} createCase
 * @property {(stats: object) => Promise<void>} recordScrapeRun
 * @property {() => Promise<object|null>} getLastScrapeRun
 * @property {(limit?: number) => Promise<object[]>} listPrecaseFeed
 */

export {};
