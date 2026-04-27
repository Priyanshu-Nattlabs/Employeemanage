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

  @IsString()
  companyName!: string;

  /** Optional; if not provided we infer from email. Must be a domain like `example.com` (no @). */
  @IsOptional()
  @Matches(/^[a-z0-9.-]+\.[a-z]{2,}$/i, { message: "companyDomain must be a valid domain like example.com" })
  companyDomain?: string;

  @IsString()
  employeeId!: string;

  @IsIn(["EMPLOYEE", "MANAGER"])
  currentRole!: "EMPLOYEE" | "MANAGER";

  @IsString()
  mobileNo!: string;

  @IsEmail()
  reportingManagerEmail!: string;
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

