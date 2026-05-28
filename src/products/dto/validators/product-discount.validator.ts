import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

export function IsProductDiscount(validationOptions?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      name: 'isProductDiscount',
      target: target.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value === 'number') {
            return Number.isFinite(value) && value >= 0 && value <= 100;
          }

          return typeof value === 'string' && value.trim().length <= 20;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a number from 0 to 100 or a short string`;
        },
      },
    });
  };
}
