module.exports = function(root, requireModule) {
  const moment = requireModule('moment');

  return function(self, types) {
    return {
      'userName': types.String.notNull.required,
      'firstName': types.String,
      'middleName': types.String,
      'lastName': types.String.max(1024),
      'dob': types.Date.notNull,
      'age': types.Integer.virtual.setter((val, model) => {
        if (!model)
          return;

        var format = (model.schema instanceof Function) ? model.schema().getFieldProp('dob', 'format') : undefined;
        return moment().diff(moment(model.dob, format), 'years');
      }),
      'dependents': types.ArrayOf(types.User),
      'roles': types.ArrayOf(types.Role)
    };
  };
};
