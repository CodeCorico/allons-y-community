'use strict';

module.exports = function(GroupModel, $done) {
  var UserModel = DependencyInjection.injector.model.get('UserModel');

  UserModel.homeDefaultTile(function($socket, callback) {
    if (!$socket || !$socket.user || !$socket.user.id) {
      return callback(null);
    }

    UserModel.fromSocket($socket, function(err, user) {
      var url = user && user.url || false;

      if (!url) {
        return callback(null);
      }

      callback([{
        url: '/members/' + url,
        date: new Date(),
        cover: user.avatarThumb || '/public/users/avatar.png',
        details: {
          title: user.username
        }
      }]);
    });
  });

  $done();
};
