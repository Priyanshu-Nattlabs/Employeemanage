import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CompanyUser, CompanyUserSchema, RolePreparation, RolePreparationSchema, SkillTest, SkillTestSchema } from "../shared/schemas";
import { OrgAuthController } from "./org-auth.controller";
import { OrgAuthService } from "./org-auth.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CompanyUser.name, schema: CompanyUserSchema },
      { name: RolePreparation.name, schema: RolePreparationSchema },
      { name: SkillTest.name, schema: SkillTestSchema },
    ]),
  ],
  controllers: [OrgAuthController],
  providers: [OrgAuthService],
  exports: [OrgAuthService]
})
export class OrgAuthModule {}

