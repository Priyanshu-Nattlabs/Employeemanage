import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { BlueprintController } from "./blueprint.controller";
import { BlueprintService } from "./blueprint.service";
import { BlueprintSeeder } from "./blueprint.seeder";
import { Blueprint, BlueprintSchema, RolePreparation, RolePreparationSchema, UserProfile, UserProfileSchema } from "../shared/schemas";
import { AiModule } from "../shared/ai.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Blueprint.name, schema: BlueprintSchema },
      { name: RolePreparation.name, schema: RolePreparationSchema },
      { name: UserProfile.name, schema: UserProfileSchema }
    ]),
    AiModule
  ],
  controllers: [BlueprintController],
  providers: [BlueprintService, BlueprintSeeder],
  exports: [BlueprintService]
})
export class BlueprintModule {}

