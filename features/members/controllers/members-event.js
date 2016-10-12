'use strict';

module.exports = [{
  event: 'update(web/route)',
  controller: function($socket, UserModel, $message) {
    if (!this.validMessage($message, {
      path: ['string', 'filled']
    })) {
      return;
    }

    if (!$socket || !$socket.user || !$socket.user.id) {
      return;
    }

    var match = $message.path.match(/^\/members\/(.+?)\/?$/);

    if (!match) {
      return;
    }

    UserModel
      .findOne({
        url: match[1].split('/')[0]
      })
      .exec(function(err, user) {
        if (err || !user) {
          return;
        }

        UserModel.addHomeTile({
          url: '/members/' + user.url,
          date: new Date(),
          cover: user.avatarThumb || '/public/users/avatar.png',
          details: {
            title: user.username
          }
        }, $socket.user.id);
      });
  }
}];
