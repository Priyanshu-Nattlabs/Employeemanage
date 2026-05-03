import { IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class RegisterEmployeeDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  fullName!: string;

  @IsString()
  designation!: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  industry?: string;

  @IsString()
  companyName!: string;

  /** Optional; if not provided we infer from email. Must be a domain like `example.com` (no @). */
  @IsOptional()
  @Matches(/^[a-z0-9.-]+\.[a-z]{2,}$/i, { message: "companyDomain must be a valid domain like example.com" })
  companyDomain?: string;

  @IsString()
  employeeId!: string;

  @IsIn(["EMPLOYEE", "MANAGER", "HR"])
  currentRole!: "EMPLOYEE" | "MANAGER" | "HR";

  @IsString()
  mobileNo!: string;

  @IsOptional()
  @IsEmail()
  reportingManagerEmail?: string;
}

export class RegisterAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  fullName!: string;

  @IsString()
  companyName!: string;

  @IsOptional()
  @Matches(/^[a-z0-9.-]+\.[a-z]{2,}$/i, { message: "companyDomain must be a valid domain like example.com" })
  companyDomain?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class VerifyEmailOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: "otp must be a 6-digit code" })
  otp!: string;
}

export class ResendEmailOtpDto {
  @IsEmail()
  email!: string;
}

export class ForgotPasswordRequestOtpDto {
  @IsEmail()
  email!: string;
}

export class ForgotPasswordConfirmDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: "otp must be a 6-digit code" })
  otp!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class CompleteInviteDto {
  @IsString()
  @MinLength(8)
  newPassword!: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsString()
  @MinLength(2)
  designation!: string;

  @IsString()
  @MinLength(5)
  mobileNo!: string;

  @IsOptional()
  @IsString()
  employeeId?: string;
}

