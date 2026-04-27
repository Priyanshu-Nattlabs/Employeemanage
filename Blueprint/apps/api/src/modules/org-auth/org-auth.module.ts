import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  CompanyOrgStructure,
  CompanyOrgStructureSchema,
  CompanyUser,
  CompanyUserSchema,
  RolePreparation,
  RolePreparationSchema,
  RoleRecommendation,
  RoleRecommendationSchema,
  SkillTest,
  SkillTestSchema,
} from "../shared/schemas";
import { OrgAuthController } from "./org-auth.controller";
import { OrgAuthService } from "./org-auth.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CompanyUser.name, schema: CompanyUserSchema },
      { name: RolePreparation.name, schema: RolePreparationSchema },
      { name: SkillTest.name, schema: SkillTestSchema },
      { name: CompanyOrgStructure.name, schema: CompanyOrgStructureSchema },
      { name: RoleRecommendation.name, schema: RoleRecommendationSchema },
    ]),
  ],
  controllers: [OrgAuthController],
  providers: [OrgAuthService],
  exports: [OrgAuthService]
})
export class OrgAuthModule {}

