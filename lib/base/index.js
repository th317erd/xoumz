module.exports = function(root, requireModule) {
  const Utils = requireModule('./base/utils');
  const MimeTypes = requireModule('./base/mime-types');
  const Validation = requireModule('./base/validation');

  const Chainable = requireModule('./base/chainable');
  const Collections = requireModule('./base/collections');
  const EngineBase = requireModule('./base/engine-base');
  const ConfigEngine = requireModule('./base/config-engine');
  const Logger = requireModule('./base/logger');
  const QueryBuilder = requireModule('./base/query-builder');
  const StreamUtils = requireModule('./base/stream-utils');

  root.export(Chainable, Collections, EngineBase, ConfigEngine, QueryBuilder, StreamUtils, {
    Logger,
    Utils,
    MimeTypes,
    Validation
  });
};
