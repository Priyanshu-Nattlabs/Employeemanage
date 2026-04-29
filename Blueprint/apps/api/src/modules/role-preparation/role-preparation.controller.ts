import { Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";
import { RolePreparationService } from "./role-preparation.service";

@Controller("api/role-preparation")
export class RolePreparationController {
  constructor(private readonly service: RolePreparationService) {}

  @Post("start/:roleName")
  start(@Param("roleName") roleName: string, @Query("studentId") studentId: string, @Body() body?: any) {
    return this.service.start(
      studentId,
      decodeURIComponent(roleName),
      body?.ganttChartData,
      body?.targetStartDate,
      body?.targetCompletionDate,
      body?.activate ?? true,
      body?.employeeLevel
    );
  }

  @Put("known-skills/:roleName")
  setKnownSkills(
    @Param("roleName") roleName: string,
    @Query("studentId") studentId: string,
    @Body() body?: { knownSkills?: string[]; ganttChartData?: Record<string, unknown> }
  ) {
    return this.service.configureKnownSkills(
      studentId,
      decodeURIComponent(roleName),
      body?.knownSkills || [],
      body?.ganttChartData
    );
  }

  @Put("skill/:roleName/:skillName")
  updateSkill(
    @Param("roleName") roleName: string,
    @Param("skillName") skillName: string,
    @Query("studentId") studentId: string,
    @Query("completed") completed: string
  ) {
    return this.service.updateSkill(studentId, decodeURIComponent(roleName), decodeURIComponent(skillName), completed === "true");
  }

  @Put("subtopic/:roleName/:skillName")
  toggleSubtopic(
    @Param("roleName") roleName: string,
    @Param("skillName") skillName: string,
    @Query("studentId") studentId: string,
    @Query("month") month: string,
    @Query("topicIndex") topicIndex: string,
    @Query("completed") completed: string
  ) {
    return this.service.toggleSubtopic(
      studentId,
      decodeURIComponent(roleName),
      decodeURIComponent(skillName),
      Number(month),
      Number(topicIndex),
      completed === "true"
    );
  }

  @Get("all")
  getAll(@Query("studentId") studentId: string) { return this.service.getAll(studentId); }

  @Get("ongoing")
  getOngoing(@Query("studentId") studentId: string) { return this.service.getOngoing(studentId); }

  @Get(["analytics/:roleName", "analytics/:roleName/"])
  analytics(@Param("roleName") roleName: string, @Query("studentId") studentId: string) {
    return this.service.analytics(studentId, decodeURIComponent(roleName));
  }

  @Get(":roleName")
  get(@Param("roleName") roleName: string, @Query("studentId") studentId: string) {
    return this.service.get(studentId, decodeURIComponent(roleName));
  }

  @Delete(":roleName")
  async remove(@Param("roleName") roleName: string, @Query("studentId") studentId: string) {
    return this.service.remove(studentId, decodeURIComponent(roleName));
  }
}

