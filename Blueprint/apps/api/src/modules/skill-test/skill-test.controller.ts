import { Body, Controller, Get, NotFoundException, Param, Post, Query } from "@nestjs/common";
import { SkillTestService } from "./skill-test.service";

@Controller("api/skill-test")
export class SkillTestController {
  constructor(private readonly service: SkillTestService) {}

  @Post("start")
  start(@Query("studentId") studentId: string, @Query("roleName") roleName: string, @Query("skillName") skillName: string) {
    return this.service.start(studentId, decodeURIComponent(roleName), decodeURIComponent(skillName));
  }

  @Post("start-known-skills")
  startKnownSkills(
    @Query("studentId") studentId: string,
    @Query("roleName") roleName: string,
    @Body() body?: { selectedSkills?: string[] }
  ) {
    return this.service.startKnownSkillsTest(studentId, decodeURIComponent(roleName), body?.selectedSkills || []);
  }

  @Get("in-progress")
  async inProgress(
    @Query("studentId") studentId: string,
    @Query("roleName")  roleName: string,
    @Query("skillName") skillName: string,
  ) {
    const test = await this.service.getInProgress(studentId, decodeURIComponent(roleName), decodeURIComponent(skillName));
    if (!test) throw new NotFoundException("No in-progress test found");
    return test;
  }

  @Get("in-progress-known-skills")
  async inProgressKnownSkills(
    @Query("studentId") studentId: string,
    @Query("roleName") roleName: string
  ) {
    const test = await this.service.getKnownSkillsInProgress(studentId, decodeURIComponent(roleName));
    if (!test) throw new NotFoundException("No in-progress combined known skills test found");
    return test;
  }

  @Get("result")
  result(@Query("studentId") studentId: string, @Query("roleName") roleName: string, @Query("skillName") skillName: string) {
    return this.service.latestResult(studentId, decodeURIComponent(roleName), decodeURIComponent(skillName));
  }

  @Get("all-by-role")
  allByRole(
    @Query("studentId") studentId: string,
    @Query("roleName")  roleName: string,
  ) {
    return this.service.allResultsByRole(studentId, decodeURIComponent(roleName));
  }

  @Get(":testId")
  getById(@Param("testId") testId: string) { return this.service.getById(testId); }

  @Post(":testId/answer")
  answer(@Param("testId") testId: string, @Body() body: { questionNumber: number; answer: string }) {
    return this.service.answer(testId, body.questionNumber, body.answer);
  }

  @Post(":testId/submit")
  submit(
    @Param("testId") testId: string,
    @Body() body?: { answers?: Record<string, string> },
  ) {
    return this.service.submit(testId, body?.answers);
  }

}

