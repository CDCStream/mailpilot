import { buildLlmsTxt, llmsTxtResponse } from "@/lib/llms-txt";

export function GET() {
  return llmsTxtResponse(buildLlmsTxt());
}
