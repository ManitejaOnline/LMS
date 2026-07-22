import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants/metadata.keys';

/** Marks a route as publicly accessible (skips JWT auth guard). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
