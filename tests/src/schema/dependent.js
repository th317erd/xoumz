import { Schema, generateUUID } from '../../../index';
import { Dependent } from '../models';

module.exports = Schema.defineSchema(Dependent, (engine) => {
  return {
    generateID: () => ('DP_' + generateUUID()),
    fields: {
      firstName: '',
      lastName: String,
      isDependent: {
        type: Boolean,
        field: 'dependent',
        getValue: () => true,
        setValue: (model, fieldName) => (model[fieldName] = true)
      }
    }
  }
});
