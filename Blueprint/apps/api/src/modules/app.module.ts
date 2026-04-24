import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { BlueprintModule } from "./blueprint/blueprint.module";
import { SkillTestModule } from "./skill-test/skill-test.module";
import { RolePreparationModule } from "./role-preparation/role-preparation.module";
import { AiModule } from "./shared/ai.module";
import { UserProfileModule } from "./user-profile/user-profile.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    UserProfileModule
  ]
})
export class AppModule {}

