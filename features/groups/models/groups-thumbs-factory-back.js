module.exports = function() {
  'use strict';

  DependencyInjection.factory('groupsThumbsFactory', function($allonsy) {

    $allonsy.requireInFeatures('models/thumbnails-factory-back');

    var SIZES = [{
          name: 'coverLarge',
          width: 1440,
          height: 400
        }, {
          name: 'coverThumb',
          width: 240,
          height: 170
        }, {
          name: 'coverMini',
          width: 50,
          height: 50
        }],

        path = require('path'),
        rootPath = path.resolve('./'),
        thumbnailsFactory = DependencyInjection.injector.factory.get('thumbnailsFactory');

    return function groupsThumbsFactory(group, callback) {
      if (!group || !group.cover) {
        if (group) {
          for (var i = 0; i < SIZES.length; i++) {
            group[SIZES[i].name] = null;
          }
        }

        return callback();
      }

      thumbnailsFactory([{
        path: rootPath,
        file: group.cover,
        sizes: SIZES
      }], {
        overwrite: false,
        resizeGif: true
      }, function(err, files) {

        if (err || !files || !files.length || files[0].sizes < SIZES.length) {
          $allonsy.logWarning('allons-y-community', 'grroups:groups-thumbs-factory', {
            error: err || 'no files'
          });

          return callback();
        }

        var sizes = files[0].sizes;

        for (var i = 0; i < SIZES.length; i++) {
          if (sizes[i].err || !sizes[i].result) {
            $allonsy.logWarning('allons-y-community', 'users:users-thumbs-factory', {
              error: sizes[i].err || 'no result',
              scope: SIZES[i].name
            });
          }

          group[SIZES[i].name] = sizes[i].err || !sizes[i].result ? null : sizes[i].result;
        }

        callback();
      });
    };
  });
};
