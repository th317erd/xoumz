function basename(name) {
  return ('' + name).split('/').pop();
}

function getMimeTypeExtensionKey(extension, _isBinary) {
  var isBinary = _isBinary || true;
  return `extension:${(isBinary) ? 'binary' : 'text'}:${extension}`;
}

function expandMimeTypes(mimeTypes) {
  var keys = Object.keys(mimeTypes),
      sourcedMimeTypes = {},
      sourceNames = {},
      expandedMimeTypes = {};

  // Dump all mime types into hash based on 'source'
  for (var i = 0, il = keys.length; i < il; i++) {
    var key = keys[i],
        type = Object.assign({ mimeType: key }, mimeTypes[key]),
        source = ('' + type.source),
        context = sourcedMimeTypes[source];

    if (!context) {
      sourceNames[source] = source;
      context = sourcedMimeTypes[source] = {};
    }

    context[key] = type;
  }

  // Merge together, preferring sources in the order specified
  expandedMimeTypes = Object.assign(
    {},
    sourcedMimeTypes['undefined'] || {},
    sourcedMimeTypes['apache'] || {},
    sourcedMimeTypes['nginx'] || {},
    sourcedMimeTypes['iana'] || {}
  );

  // Now extract extensions and make hash entries for them
  keys = Object.keys(expandedMimeTypes);

  for (var i = 0, il = keys.length; i < il; i++) {
    var key = keys[i],
        type = expandedMimeTypes[key],
        extensions = type.extensions;

    if (extensions) {
      for (var j = 0, jl = extensions.length; j < jl; j++) {
        var extension = (extensions[j] + '').toLowerCase(),
            isBinary = !!key.match(/^text/),
            keyName = getMimeTypeExtensionKey(extension, isBinary);

        if (expandedMimeTypes.hasOwnProperty(keyName)) {
          var currentType = expandedMimeTypes[keyName];

          // If there is a duplicate, prefer the one that DOESN'T start with type/x-*
          if (key.match(/\/x-/))
            type = currentType;
          // Otherwise, prefer the one that DOESN'T start with application/*
          else if (key.match(/^application/) && !currentType.mimeType.match(/^application/))
            type = currentType;
        }

        expandedMimeTypes[keyName] = type;
      }
    }
  }

  // Return final large hash
  return expandedMimeTypes;
}

const mimeDB = expandMimeTypes(require('mime-db'));

function getMimeType(_key, _opts) {
  var opts = _opts || {},
      raw = opts.raw,
      isBinary = opts.binary || true,
      key = _key;

  if (!key)
    return;

  key = ('' + key).toLowerCase();

  var val = mimeDB[key];
  if (val)
    return (raw) ? val : val.mimeType;

  var thisKey = basename(key),
      index = thisKey.indexOf('.');

  while (index >= 0) {
    thisKey = key.substring(index + 1);

    val = mimeDB[getMimeTypeExtensionKey(thisKey, isBinary)];
    if (val)
      return (raw) ? val : val.mimeType;

    val = mimeDB[getMimeTypeExtensionKey(thisKey, !isBinary)];
    if (val)
      return (raw) ? val : val.mimeType;

    index = key.indexOf('.', index + 1);
  }
}

function getExtensionFromMimeType(_key) {
  var key = _key;
  if (!key)
    return;

  key = ('' + key).toLowerCase();

  var val = mimeDB[key];
  if (!val)
    return;

  return (val.extensions || [])[0];
}

module.exports = Object.assign(module.exports, {
  getMimeType,
  getExtensionFromMimeType
});
