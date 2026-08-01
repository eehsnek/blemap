/** Promote a matched precase into a full published case. */
export async function promotePrecaseToCase(precase, submissionText) {
  return createCase({
    topic: precase.title,
    summary: submissionText,
    permalinks: [precase.permalink],
    subreddits: precase.subreddit ? [precase.subreddit] : [],
    ai_status: "submission-matched",
  });
}