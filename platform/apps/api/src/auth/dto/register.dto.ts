import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

export class RegisterDto {
    @IsEmail()
    email!: string;

    @IsString()
    @MinLength(12, { message: 'Password must be at least 12 characters' })
    @Matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/,
        { message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' }
    )
    password!: string;

    @IsString()
    firstName!: string;

    @IsString()
    lastName!: string;
}

