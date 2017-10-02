import { Schema, generateUUID } from '../../../index';
import { User, Dependent } from '../models';

module.exports = Schema.defineSchema(User, (engine) => {
  return {
    generateID: () => ('US_' + generateUUID()),
    fields: Schema.filterSchemaToEngine({
      firstName: { type: String, field: 'first_name', 'field:sql': 'first_name_sql' },
      lastName: { type: String, field: 'last_name', 'field:sql': 'last_name_sql' },
      dependents: [Dependent]
    }, engine)
  }
});
