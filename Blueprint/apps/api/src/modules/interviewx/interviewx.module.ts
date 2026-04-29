import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { OrgAuthModule } from "../org-auth/org-auth.module";
import {
  InterviewXEmployeeInterview,
  InterviewXEmployeeInterviewSchema,
} from "../shared/schemas";
import { InterviewXController } from "./interviewx.controller";
import { InterviewXService } from "./interviewx.service";

@Module({
  imports: [
    OrgAuthModule,
    MongooseModule.forFeature([
      { name: InterviewXEmployeeInterview.name, schema: InterviewXEmployeeInterviewSchema },
    ]),
  ],
  controllers: [InterviewXController],
  providers: [InterviewXService],
})
export class InterviewXModule {}

