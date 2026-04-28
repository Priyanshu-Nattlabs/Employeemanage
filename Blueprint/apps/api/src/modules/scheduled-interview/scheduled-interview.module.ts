import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { OrgAuthModule } from "../org-auth/org-auth.module";
import { ScheduledInterview, ScheduledInterviewSchema } from "../shared/schemas";
import { ScheduledInterviewController } from "./scheduled-interview.controller";
import { ScheduledInterviewService } from "./scheduled-interview.service";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ScheduledInterview.name, schema: ScheduledInterviewSchema }]),
    OrgAuthModule,
  ],
  controllers: [ScheduledInterviewController],
  providers: [ScheduledInterviewService],
})
export class ScheduledInterviewModule {}
