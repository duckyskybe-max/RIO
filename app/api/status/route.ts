import { llmEnabled } from "@/lib/server";

export const GET = () => Response.json({ llm: llmEnabled() });
