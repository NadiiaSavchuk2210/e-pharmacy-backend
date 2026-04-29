import {
  IsEmail,
  IsPhoneNumber,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const NAME_REGEX = /^[A-Za-zА-Яа-яІіЇїЄєҐґ' -]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/;

export class RegisterUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(NAME_REGEX, {
    message: 'name can contain only letters, spaces, apostrophes, and hyphens',
  })
  name: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsPhoneNumber()
  phone: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(PASSWORD_REGEX, {
    message:
      'password must contain uppercase, lowercase, number, and special character',
  })
  password: string;
}
