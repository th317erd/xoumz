import { noe } from '../utils';

export function required(val) {
  if (noe(val))
    throw new Error('Value required');
}
