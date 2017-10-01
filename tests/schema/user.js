import { defineSchema, filterSchemaToEngine, generateUUID } from '../../lib/schema';
import { User, Dependent } from '../models';

module.exports = defineSchema(User, (engine) => {
  return {
    generateID: () => ('US_' + generateUUID()),
    fields: filterSchemaToEngine({
      firstName: { type: String, field: 'first_name', 'field:sql': 'first_name_sql' },
      lastName: { type: String, field: 'last_name', 'field:sql': 'last_name_sql' },
      dependents: [Dependent]
    }, engine)
  }
});
