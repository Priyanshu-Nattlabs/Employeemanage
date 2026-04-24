import { Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { AiService } from "./ai.service";

@Module({
  providers: [
    {
      provide: OpenAI,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const key = config.get<string>("OPENAI_API_KEY");
        if (!key || !key.trim() || key === "not-configured") {
          new Logger("AiModule").warn(
            "OPENAI_API_KEY is not set in apps/api/.env — AI features (Gantt topics, skill tests) will return fallback data."
          );
          return new OpenAI({ apiKey: "not-configured" });
        }
        new Logger("AiModule").log("OpenAI client initialised successfully.");
        return new OpenAI({ apiKey: key.trim() });
      }
    },
    AiService
  ],
  exports: [AiService]
})
export class AiModule {}
