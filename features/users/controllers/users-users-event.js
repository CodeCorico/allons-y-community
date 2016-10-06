'use strict';

module.exports = [{
  event: 'update(web/route)',
  controller: function($socket, $message) {
    if (!this.validMessage($message, {
      path: ['string']
    })) {
      return;
    }

    $socket.route = {
      init: !!$message.init,
      hash: typeof $message.hash == 'string' && $message.hash || null,
      params: typeof $message.params == 'string' && $message.params || null,
      url: $message.path
    };
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
