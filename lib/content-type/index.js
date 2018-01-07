module.exports = function(root, requireModule) {
  const ContentTypeJSON = requireModule('./content-type/content-type-json'),
        ContentTypeFile = requireModule('./content-type/content-type-file'),
        ContentType = requireModule('./content-type/content-type');

  Object.assign(root, ContentTypeJSON, ContentTypeFile, ContentType);
};
