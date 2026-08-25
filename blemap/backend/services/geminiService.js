import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

export async function generateCaseTitle(posts) {
  const prompt = `
You are given multiple discussion posts that belong to the same semantic cluster.

Generate:
1. A concise case title (5-10 words).
2. A one-sentence summary (max 40 words).

Return ONLY valid JSON.

Example:

{
  "title": "...",
  "summary": "..."
}

Posts:
${posts.join("\n")}
`;

  const result = await model.generateContent(prompt);

  let text = result.response.text().trim();

  // Remove ```json
  text = text.replace(/^```json\s*/i, "");

  // Remove ```
  text = text.replace(/```$/, "");

  return text.trim();
}