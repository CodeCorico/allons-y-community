'use strict';

var $MediaService = DependencyInjection.injector.controller.get('$MediaService');

$MediaService.onAsyncSafe('postApi.finish', function(fields, callback) {
  fields = fields || {};

  var result  = null;

  if (!fields.isGroupCover) {
    return callback(result);
  }

  var groupsThumbsFactory = DependencyInjection.injector.controller.get('groupsThumbsFactory'),
      group = {
        cover: fields.fileUrl
      };

  groupsThumbsFactory(group, function() {
    callback(group);
  });
});

module.exports = null;
