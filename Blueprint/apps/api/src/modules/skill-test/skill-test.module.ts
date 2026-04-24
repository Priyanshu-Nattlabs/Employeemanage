import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { SkillTestController } from "./skill-test.controller";
import { SkillTestService } from "./skill-test.service";
import { Blueprint, BlueprintSchema, SkillTest, SkillTestSchema } from "../shared/schemas";
import { RolePreparationModule } from "../role-preparation/role-preparation.module";
import { AiModule } from "../shared/ai.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SkillTest.name, schema: SkillTestSchema },
      { name: Blueprint.name, schema: BlueprintSchema }
    ]),
    RolePreparationModule,
    AiModule
  ],
  controllers: [SkillTestController],
  providers: [SkillTestService]
})
export class SkillTestModule {}

