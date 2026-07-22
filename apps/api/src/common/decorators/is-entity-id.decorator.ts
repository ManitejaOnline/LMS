import { Matches, type ValidationOptions } from 'class-validator';

/**
 * Prisma entity primary keys in this project use `@default(cuid())`,
 * not UUID. DTOs must validate cuid-shaped ids — `@IsUUID()` rejects
 * every legitimate media / lesson / course id.
 */
export const ENTITY_ID_PATTERN = /^c[a-z0-9]{24,32}$/i;

export function IsEntityId(validationOptions?: ValidationOptions) {
  return Matches(ENTITY_ID_PATTERN, {
    message: '$property must be a valid entity id',
    ...validationOptions,
  });
}
