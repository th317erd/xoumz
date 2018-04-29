module.exports = function(root, requireModule) {
  const ModelBase = requireModule('./models/model-base'),
        Models = requireModule('./models/models');

  Object.assign(root, ModelBase, {
    Models
  });
};
