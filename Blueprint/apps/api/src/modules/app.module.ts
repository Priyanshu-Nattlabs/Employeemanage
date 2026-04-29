import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import path from "path";
import { BlueprintModule } from "./blueprint/blueprint.module";
import { SkillTestModule } from "./skill-test/skill-test.module";
import { RolePreparationModule } from "./role-preparation/role-preparation.module";
import { AiModule } from "./shared/ai.module";
import { UserProfileModule } from "./user-profile/user-profile.module";
import { OrgAuthModule } from "./org-auth/org-auth.module";
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Load root ".env" (repo) + API ".env" (apps/api) for all run modes.
      // This makes SMTP/Gmail settings in the root ".env" available to the backend.
      envFilePath: [
        path.resolve(__dirname, "../../../../.env"),
        path.resolve(__dirname, "../../../.env"),
      ],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>("MONGODB_URI") || "mongodb://localhost:27017/job_blueprint_v2"
      })
    }),
    AiModule,
    BlueprintModule,
    SkillTestModule,
    RolePreparationModule,
    UserProfileModule,
    OrgAuthModule
  ]
})
export class AppModule {}

