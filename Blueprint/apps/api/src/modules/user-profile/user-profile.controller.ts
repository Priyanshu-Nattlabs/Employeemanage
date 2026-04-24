import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import { UserProfileService } from "./user-profile.service";

@Controller("api/user-profile")
export class UserProfileController {
  constructor(private readonly service: UserProfileService) {}

  @Get(":userId")
  get(@Param("userId") userId: string) {
    return this.service.get(decodeURIComponent(userId));
  }

  @Put(":userId")
  upsert(@Param("userId") userId: string, @Body() body: any) {
    return this.service.upsert(decodeURIComponent(userId), body || {});
  }
}

