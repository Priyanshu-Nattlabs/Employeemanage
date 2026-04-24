import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { RolePreparationController } from "./role-preparation.controller";
import { RolePreparationService } from "./role-preparation.service";
import { Blueprint, BlueprintSchema, RolePreparation, RolePreparationSchema, SkillTest, SkillTestSchema } from "../shared/schemas";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RolePreparation.name, schema: RolePreparationSchema },
      { name: Blueprint.name, schema: BlueprintSchema },
      { name: SkillTest.name, schema: SkillTestSchema }
    ])
  ],
  controllers: [RolePreparationController],
  providers: [RolePreparationService],
  exports: [RolePreparationService]
})
export class RolePreparationModule {}

