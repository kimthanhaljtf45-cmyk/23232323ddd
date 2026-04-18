import { IsString, IsOptional, IsEmail } from 'class-validator';

export class GoogleAuthDto {
  @IsString()
  idToken: string; // Google ID token from frontend

  @IsOptional()
  @IsString()
  referralCode?: string; // Optional referral code during signup
}

export class GoogleAuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: {
    _id: string;
    email: string;
    firstName: string;
    lastName?: string;
    role: string;
    isOnboarded: boolean;
  };
  isNewUser: boolean;
  needsOnboarding: boolean;
}
