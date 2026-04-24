import { Injectable, Logger } from "@nestjs/common";
import OpenAI from "openai";

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly openai: OpenAI) {}

  /** Call GPT, robustly extract JSON from the response, return fallback on any error. */
  async chatJson<T = any>(prompt: string, system: string, fallback: T): Promise<T> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25_000);
      let resp: any;
      try {
        resp = await this.openai.chat.completions.create(
          {
            model: "gpt-4o-mini",
            temperature: 0.3,
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
          },
          { signal: controller.signal },
        );
      } finally {
        clearTimeout(timer);
      }

      const raw = resp.choices[0]?.message?.content || "";
      const parsed = this.extractJson(raw);
      if (parsed !== null) return parsed as T;

      this.logger.warn(`AI returned non-JSON content. Raw (first 300): ${raw.slice(0, 300)}`);
      return fallback;
    } catch (err: any) {
      const msg: string = err?.message || String(err);
      if (msg.includes("not-configured") || msg.includes("API key") || msg.includes("Incorrect API key")) {
        this.logger.error("OpenAI API key is missing or invalid. Set OPENAI_API_KEY in apps/api/.env");
      } else {
        this.logger.error(`OpenAI call failed: ${msg}`);
      }
      return fallback;
    }
  }

  /** Extract JSON from raw string — handles markdown fences, leading/trailing text. */
  private extractJson(raw: string): any {
    if (!raw?.trim()) return null;

    // 1. Try direct parse
    try { return JSON.parse(raw.trim()); } catch { /* continue */ }

    // 2. Strip ```json ... ``` or ``` ... ``` fences
    const fenced = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
    try { return JSON.parse(fenced); } catch { /* continue */ }

    // 3. Find first { or [ and last } or ]
    const firstBrace = Math.min(
      raw.indexOf("{") === -1 ? Infinity : raw.indexOf("{"),
      raw.indexOf("[") === -1 ? Infinity : raw.indexOf("[")
    );
    const lastBrace = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
    if (firstBrace !== Infinity && lastBrace !== -1 && lastBrace > firstBrace) {
      try { return JSON.parse(raw.slice(firstBrace, lastBrace + 1)); } catch { /* continue */ }
    }

    return null;
  }
}
