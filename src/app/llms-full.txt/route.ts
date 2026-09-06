import { buildLlmsFullTxt, llmsTxtResponse } from "@/lib/llms-txt";

export function GET() {
  return llmsTxtResponse(buildLlmsFullTxt());
}
