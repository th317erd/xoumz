import { defineSchema } from '../../lib/schema';
import { Dependent } from '../models';

module.exports = defineSchema(Dependent, (engine) => {
  return {
    firstName: '',
    lastName: String,
    isDependent: {
      type: Boolean,
      field: 'dependent',
      getValue: () => true,
      setValue: (model, fieldName) => (model[fieldName] = true)
    }
  }
});
