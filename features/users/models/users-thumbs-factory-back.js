module.exports = function() {
  'use strict';

  DependencyInjection.factory('usersThumbsFactory', function($allonsy) {

    $allonsy.requireInFeatures('models/thumbnails-factory-back');

    var SIZES = [{
          name: 'avatarThumb',
          width: 400,
          height: 200
        }, {
          name: 'avatarThumbVertical',
          width: 150,
          height: 240
        }, {
          name: 'avatarThumbSquare',
          width: 150,
          height: 150
        }, {
          name: 'avatarMini',
          width: 50,
          height: 50
        }, {
          name: 'avatarFavicon',
          width: 16,
          height: 16,
          rounded: true
        }],

        path = require('path'),
        rootPath = path.resolve('./'),
        thumbnailsFactory = DependencyInjection.injector.factory.get('thumbnailsFactory');

    return function usersThumbsFactory(user, callback) {
      if (!user || !user.avatar) {
        if (user) {
          for (var i = 0; i < SIZES.length; i++) {
            user[SIZES[i].name] = null;
          }
        }

        return callback();
      }

      thumbnailsFactory([{
        path: rootPath,
        file: user.avatar,
        sizes: SIZES
      }], {
        overwrite: false,
        resizeGif: true
      }, function(err, files) {
        if (err || !files || !files.length || files[0].sizes < SIZES.length) {
          $allonsy.logWarning('allons-y-community', 'users:users-thumbs-factory', {
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

          user[SIZES[i].name] = sizes[i].err || !sizes[i].result ? null : sizes[i].result;
        }

        callback();
      });
    };
  });
};
