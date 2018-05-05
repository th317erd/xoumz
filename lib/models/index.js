module.exports = function(root, requireModule) {
  const ModelBase = requireModule('./models/model-base'),
        Models = requireModule('./models/models');

  root.export(ModelBase, Models);
};
