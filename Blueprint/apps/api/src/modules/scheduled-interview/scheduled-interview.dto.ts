import { IsIn, IsInt, IsISO8601, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateScheduledInterviewDto {
  @IsString()
  employeeId!: string;

  @IsString()
  @MaxLength(240)
  targetRoleName!: string;

  @IsISO8601()
  scheduledAt!: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  meetingLink?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class PatchScheduledInterviewDto {
  @IsOptional()
  @IsIn(["SCHEDULED", "COMPLETED", "CANCELLED"])
  status?: "SCHEDULED" | "COMPLETED" | "CANCELLED";

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  reportUrl?: string;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  meetingLink?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
