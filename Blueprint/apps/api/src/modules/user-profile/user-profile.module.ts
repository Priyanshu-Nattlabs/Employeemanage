import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UserProfileController } from "./user-profile.controller";
import { UserProfileService } from "./user-profile.service";
import { UserProfile, UserProfileSchema } from "../shared/schemas";

@Module({
  imports: [MongooseModule.forFeature([{ name: UserProfile.name, schema: UserProfileSchema }])],
  controllers: [UserProfileController],
  providers: [UserProfileService],
  exports: [UserProfileService]
})
export class UserProfileModule {}

