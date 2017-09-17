import { defineTypeSchema } from '../../lib/schema';

module.exports = Object.assign(module.exports, {
  User: defineTypeSchema('User', (class User {
  }), (User) => {
    return {
      owner: User,
      firstName: String,
      lastName: String,
      dependents: [User],
      password: [
        {
          type: String
        },
        {
          target: 'json',
          formatValue: function(val, op) {
            return (op === 'get') ? undefined : val;
          }
        }
      ],
      isDependent: [
        {
          type: Boolean
        },
        {
          target: 'json',
          formatValue: function(val, op) {
            return (op === 'get') ? ((!this.owner) ? undefined : true) : val;
          }
        }
      ]
    };
  })
});
