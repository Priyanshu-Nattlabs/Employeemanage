import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { BlueprintService } from "./blueprint.service";

@Injectable()
export class BlueprintSeeder implements OnModuleInit {
  private readonly logger = new Logger(BlueprintSeeder.name);

  constructor(private readonly blueprint: BlueprintService) {}

  async onModuleInit() {
    const mode = String(process.env.BLUEPRINT_SEED_MODE || "").trim().toLowerCase();
    if (!mode) return;

    // Avoid seeding if collection already has data
    try {
      const existing = await this.blueprint.getAllBlueprints();
      if (Array.isArray(existing) && existing.length > 0) {
        this.logger.log(`Seed skipped: blueprints already present (${existing.length}).`);
        return;
      }
    } catch (e) {
      this.logger.warn(`Seed precheck failed (continuing): ${e}`);
    }

    if (mode === "demo") {
      try {
        const r = await this.blueprint.seedDemoData();
        this.logger.log(`Seed mode=demo complete: ${JSON.stringify(r)}`);
      } catch (e) {
        this.logger.error(`Seed mode=demo failed: ${e}`);
      }
      return;
    }

    this.logger.warn(`Unknown BLUEPRINT_SEED_MODE="${mode}". Supported: "demo".`);
  }
}

