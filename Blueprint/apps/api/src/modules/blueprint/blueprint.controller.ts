import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { BlueprintService } from "./blueprint.service";

@Controller("api/blueprint")
export class BlueprintController {
  constructor(private readonly service: BlueprintService) {}

  @Post("seed-demo") seedDemo() { return this.service.seedDemoData(); }

  @Get("all") getAll() { return this.service.getAllBlueprints(); }
  @Get("industries") getIndustries() { return this.service.getNamesByType("industry"); }
  @Get("educations") getEducations() { return this.service.getNamesByType("education"); }
  @Get("specializations") getSpecializations() { return this.service.getNamesByType("specialization"); }
  @Get("roles") getRoles() { return this.service.getNamesByType("role"); }
  @Get(["role/:roleName", "role/:roleName/"])
  getRole(@Param("roleName") roleName: string, @Query("level") level?: string) {
    return this.service.getRole(decodeURIComponent(roleName), level ? decodeURIComponent(level) : undefined);
  }
  @Get(["role/:roleName/trending-jobs", "role/:roleName/trending-jobs/"])
  getRoleTrendingJobs(
    @Param("roleName") roleName: string,
    @Query("industry") industry?: string,
    @Query("education") education?: string,
    @Query("specialization") specialization?: string
  ) {
    return this.service.getTrendingJobsInsights(
      decodeURIComponent(roleName),
      industry ? decodeURIComponent(industry) : undefined,
      education ? decodeURIComponent(education) : undefined,
      specialization ? decodeURIComponent(specialization) : undefined
    );
  }
  @Get("skills") getSkills(@Query("query") query?: string) { return this.service.getAllSkillNames(query); }
  @Get("role/:roleName/proficiency-delta")
  getRoleProficiencyDelta(@Param("roleName") roleName: string, @Query("level") level?: string) {
    return this.service.getSkillProficiencyDelta(
      decodeURIComponent(roleName),
      level ? decodeURIComponent(level) : undefined
    );
  }
  @Get("role/:roleName/mappings") getRoleMappings(@Param("roleName") roleName: string) { return this.service.roleMappings(decodeURIComponent(roleName)); }

  @Get("role/:roleName/gantt")
  getRoleGantt(
    @Param("roleName") roleName: string,
    @Query("userId") userId: string,
    @Query("duration") duration?: string,
    @Query("level") level?: string
  ) {
    return this.service.getRoleWithGantt(
      decodeURIComponent(roleName),
      userId,
      duration ? Number(duration) : undefined,
      level ? decodeURIComponent(level) : undefined
    );
  }

  @Post("role/:roleName/gantt/replan")
  replanGantt(
    @Param("roleName") roleName: string,
    @Body() body: { skills: any[]; priorityOrder?: string[]; breakMonths?: number[]; duration?: number },
  ) {
    return this.service.replanGantt(decodeURIComponent(roleName), body);
  }

  @Post("role/:roleName/contextual")
  getContextualRole(
    @Param("roleName") roleName: string,
    @Query("industry")  industry?: string,
    @Query("education") education?: string,
    @Query("specialization") specialization?: string,
    @Query("level") level?: string,
  ) {
    return this.service.getContextualRole(
      decodeURIComponent(roleName),
      industry  ? decodeURIComponent(industry)  : undefined,
      education ? decodeURIComponent(education) : undefined,
      specialization ? decodeURIComponent(specialization) : undefined,
      level ? decodeURIComponent(level) : undefined,
    );
  }

  @Get(["industry/:industryName", "industry/:industryName/"])
  async industryDetail(@Param("industryName") industryName: string) {
    return this.service.getDocByTypeAndName("industry", decodeURIComponent(industryName));
  }

  @Get("education/:educationName")
  async educationDetail(@Param("educationName") educationName: string) {
    return this.service.getDocByTypeAndName("education", decodeURIComponent(educationName));
  }

  @Get("industry/:industryName/roles")
  async rolesByIndustry(@Param("industryName") industryName: string) {
    const docs = await this.service.getByType("industry");
    return docs.find((d) => d.name === decodeURIComponent(industryName))?.roles || [];
  }

  @Get("industry/:industryName/education")
  async educationByIndustry(@Param("industryName") industryName: string) {
    const docs = await this.service.getByType("industry");
    return docs.find((d) => d.name === decodeURIComponent(industryName))?.educations || [];
  }

  @Get("education/:educationName/specializations")
  async specializationsByEducation(@Param("educationName") educationName: string) {
    const docs = await this.service.getByType("education");
    return docs.find((d) => d.name === decodeURIComponent(educationName))?.specializations || [];
  }

  @Get("specialization/:specializationName/roles")
  async rolesBySpecialization(@Param("specializationName") specializationName: string) {
    const docs = await this.service.getByType("specialization");
    return docs.find((d) => d.name === decodeURIComponent(specializationName))?.roles || [];
  }

  @Get("specialization/:specializationName")
  async specializationDetail(@Param("specializationName") specializationName: string) {
    return this.service.getDocByTypeAndName("specialization", decodeURIComponent(specializationName));
  }

  @Get("education/:educationName/roles")
  async rolesByEducation(@Param("educationName") educationName: string) {
    const docs = await this.service.getByType("education");
    return docs.find((d) => d.name === decodeURIComponent(educationName))?.roles || [];
  }

  /** Free APIs: Wikipedia, Open Library, Semantic Scholar — no API keys. */
  @Get("study-resources")
  studyResources(@Query("topic") topic?: string) {
    const t = topic?.trim();
    if (!t) return { query: "", wikipedia: [], books: [], papers: [], videos: [] };
    return this.service.getStudyResources(t);
  }

  @Get(["remaining-months", "remaining-months/"])
  remainingMonths(@Query("userId") userId?: string) {
    if (!userId) return { months: 12 };
    return this.service.getRemainingMonths(decodeURIComponent(userId));
  }

  @Get("roles/filter")
  async filteredRoles(
    @Query("industry") industry?: string,
    @Query("education") education?: string,
    @Query("specialization") specialization?: string
  ) {
    const [allRoles, byIndustry, byEducation, bySpec] = await Promise.all([
      this.service.getNamesByType("role"),
      industry ? this.rolesByIndustry(encodeURIComponent(industry)) : Promise.resolve<string[]>([]),
      education ? this.rolesByEducation(encodeURIComponent(education)) : Promise.resolve<string[]>([]),
      specialization ? this.rolesBySpecialization(encodeURIComponent(specialization)) : Promise.resolve<string[]>([])
    ]);
    const sets = [byIndustry, byEducation, bySpec].filter((s) => s.length > 0);
    if (!sets.length) return allRoles;
    return sets.reduce((acc, cur) => acc.filter((x) => cur.includes(x)));
  }

  @Get("role/:roleName/skill/:skillName/topics")
  getTopics(
    @Param("roleName") roleName: string,
    @Param("skillName") skillName: string,
    @Query("totalMonths") _totalMonths: string,
    @Query("startMonth") startMonth: string,
    @Query("endMonth") endMonth: string
  ) {
    return this.service.getSkillTopics(decodeURIComponent(roleName), decodeURIComponent(skillName), Number(startMonth), Number(endMonth));
  }

  @Post("role/:roleName/map-industry")
  async mapRoleIndustry(@Param("roleName") roleName: string, @Query("industryName") industryName: string) {
    const ok = await this.service.map("industry", decodeURIComponent(industryName), "roles", decodeURIComponent(roleName));
    if (!ok) throw new BadRequestException("failed");
    return { message: "ok" };
  }

  @Post("role/:roleName/map-education")
  async mapRoleEducation(@Param("roleName") roleName: string, @Query("educationName") educationName: string) {
    const ok = await this.service.map("education", decodeURIComponent(educationName), "roles", decodeURIComponent(roleName));
    if (!ok) throw new BadRequestException("failed");
    return { message: "ok" };
  }

  @Post("role/:roleName/map-specialization")
  async mapRoleSpecialization(@Param("roleName") roleName: string, @Query("specializationName") specializationName: string) {
    const ok = await this.service.map("specialization", decodeURIComponent(specializationName), "roles", decodeURIComponent(roleName));
    if (!ok) throw new BadRequestException("failed");
    return { message: "ok" };
  }

  @Post("industry/:industryName/map-education")
  async mapIndustryEducation(@Param("industryName") industryName: string, @Query("educationName") educationName: string) {
    const ok = await this.service.map("industry", decodeURIComponent(industryName), "educations", decodeURIComponent(educationName));
    if (!ok) throw new BadRequestException("failed");
    return { message: "ok" };
  }

  @Post("specialization/:specializationName/map-education")
  async mapSpecializationEducation(@Param("specializationName") specializationName: string, @Query("educationName") educationName: string) {
    const ok = await this.service.map("education", decodeURIComponent(educationName), "specializations", decodeURIComponent(specializationName));
    if (!ok) throw new BadRequestException("failed");
    return { message: "ok" };
  }

  @Delete("role/:roleName/unmap-industry")
  async unmapRoleIndustry(@Param("roleName") roleName: string, @Query("industryName") industryName: string) {
    const ok = await this.service.unmap("industry", decodeURIComponent(industryName), "roles", decodeURIComponent(roleName));
    if (!ok) throw new BadRequestException("failed");
    return { message: "ok" };
  }

  @Delete("role/:roleName/unmap-education")
  async unmapRoleEducation(@Param("roleName") roleName: string, @Query("educationName") educationName: string) {
    const ok = await this.service.unmap("education", decodeURIComponent(educationName), "roles", decodeURIComponent(roleName));
    if (!ok) throw new BadRequestException("failed");
    return { message: "ok" };
  }

  @Delete("role/:roleName/unmap-specialization")
  async unmapRoleSpecialization(@Param("roleName") roleName: string, @Query("specializationName") specializationName: string) {
    const ok = await this.service.unmap("specialization", decodeURIComponent(specializationName), "roles", decodeURIComponent(roleName));
    if (!ok) throw new BadRequestException("failed");
    return { message: "ok" };
  }

  @Delete("industry/:industryName/unmap-education")
  async unmapIndustryEducation(@Param("industryName") industryName: string, @Query("educationName") educationName: string) {
    const ok = await this.service.unmap("industry", decodeURIComponent(industryName), "educations", decodeURIComponent(educationName));
    if (!ok) throw new BadRequestException("failed");
    return { message: "ok" };
  }

  @Delete("specialization/:specializationName/unmap-education")
  async unmapSpecializationEducation(@Param("specializationName") specializationName: string, @Query("educationName") educationName: string) {
    const ok = await this.service.unmap("education", decodeURIComponent(educationName), "specializations", decodeURIComponent(specializationName));
    if (!ok) throw new BadRequestException("failed");
    return { message: "ok" };
  }
}

