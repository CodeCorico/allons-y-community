'use strict';

module.exports = [{
  event: 'update(route)',
  controller: function($socket, $message) {
    if (!this.validMessage($message)) {
      return;
    }

    $socket.route = {
      init: $message.init || false,
      hash: $message.hash || null,
      params: $message.params || null,
      url: $message.path || null
    };

    // PostModel.callPostsOpened();
  }
}, {
  event: 'call(users/notifications)',
  isMember: true,
  controller: function($socket, UserModel) {
    UserModel.notifications($socket.user.id, function(err, notifications) {
      if (err) {
        return;
      }

      $socket.emit('read(users/notifications)', {
        notifications: notifications
      });
    });
  }
}, {
  event: 'call(users/notification)',
  isMember: true,
  controller: function($socket, UserModel, $message) {
    if (!this.validMessage($message, {
      unnotified: 'boolean'
    })) {
      return;
    }

    UserModel.lastNotificationUnnotified($socket.user.id, function(err, notification) {
      if (err || !notification) {
        return;
      }

      $socket.emit('read(users/notification)', {
        notification: notification
      });
    });
  }

// }, {
//   event: 'create(users/notification)',
//   permissions: ['notifire-access'],
//   controller: function($socket, UserModel, $message) {
//     if (!this.validMessage($message, {
//       message: ['string', 'filled'],
//       content: ['string', 'filled'],
//       picture: ['string', 'filled'],
//       pushTitle: ['string', 'filled'],
//       pushContent: ['string', 'filled'],
//       pushPicture: ['string', 'filled'],
//       eventName: ['string', 'filled'],
//       eventArgs: ['string', 'filled']
//     })) {
//       return;
//     }

//     UserModel.pushNotification($socket, $message.user && $message.user != 'all' ? [$message.user] : null, {
//       message: $message.message,
//       content: $message.content,
//       picture: $message.picture,
//       pushTitle: $message.pushTitle,
//       pushContent: $message.pushContent,
//       pushPicture: $message.pushPicture,
//       eventName: $message.eventName,
//       eventArgs: $message.eventArgs
//     });
//   }
}, {
  event: 'update(users/notifications)',
  isMember: true,
  controller: function($socket, $SocketsService, UserModel, $message) {
    if (!this.validMessage($message)) {
      return;
    }

    if ($message.fromLast) {
      UserModel.allNotificationsViewed($socket, $socket.user.id, $message.fromLast, function() {
        $SocketsService.emit(null, {
          'user.id': $socket.user.id
        }, null, 'read(users/notifications.viewed)', {
          fromLast: $message.fromLast
        });
      });
    }
    else if ($message.allViewed) {
      UserModel.allNotificationsViewed($socket, $socket.user.id, false, function() {
        $SocketsService.emit(null, {
          'user.id': $socket.user.id
        }, null, 'read(users/notifications.viewed)', {
          all: true
        });
      });
    }
  }
}, {
  event: 'call(users/names)',
  isMember: true,
  controller: function($socket, UserModel) {
    UserModel.names(function(err, users) {
      if (err) {
        return;
      }

      $socket.emit('read(users/names)', {
        users: users
      });
    });
  }
}, {
  event: 'call(users/avatar)',
  controller: function($socket, UserModel, $message) {
    if (!this.validMessage($message, {
      email: ['string', 'filled']
    })) {
      return;
    }

    UserModel.searchAvatar($message.email, function(err, avatars) {
      $socket.emit('read(users/avatar)', {
        avatars: avatars || null
      });
    });
  }
}];
