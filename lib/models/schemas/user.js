module.exports = function(root, requireModule) {
  const moment = requireModule('moment');

  return function(self, types) {
    return {
      'username': types.String,
      'firstName': types.String,
      'middleName': types.String,
      'lastName': types.String,
      'dob': types.DateTime,
      'age': types.Integer.virtual.setter((val, model) => {
        if (!model)
          return;

        var format = (model.schema instanceof Function) ? model.schema().getFieldProp('dob', 'format') : undefined;
        return moment().diff(moment(model.dob, format), 'years');
      }),
      'dependents': types.ArrayOf(types.User)
    };
  };
};
