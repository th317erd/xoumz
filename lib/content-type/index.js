module.exports = function(root, requireModule) {
  const ContentTypeText = requireModule('./content-type/content-type-text'),
        ContentTypeJSON = requireModule('./content-type/content-type-json'),
        ContentTypeFile = requireModule('./content-type/content-type-file'),
        ContentTypeStream = requireModule('./content-type/content-type-stream'),
        ContentType = requireModule('./content-type/content-type');

  Object.assign(root, ContentTypeText, ContentTypeJSON, ContentTypeFile, ContentTypeStream, ContentType);
};
