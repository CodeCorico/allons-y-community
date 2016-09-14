'use strict';

module.exports = [{
  event: 'update(users/user.avatar)',
  isMember: true,
  controller: function($allonsy, $socket, UserModel, $message) {
    if (!this.validMessage($message, {
      avatar: ['string', 'filled']
    })) {
      return;
    }

    UserModel.changeAvatar($socket.user.id, $message.avatar, function(err, userAvatars) {
      if (err) {
        $allonsy.logWarning('allons-y-community', 'users:update(users/user.avatar)', {
          error: err,
          socket: $socket
        });
      }

      $socket.user.avatar = userAvatars.avatar || null;
      $socket.user.avatarThumb = userAvatars.avatarThumb || null;
      $socket.user.avatarThumbVertical = userAvatars.avatarThumbVertical || null;
      $socket.user.avatarMini = userAvatars.avatarMini || null;
      $socket.user.avatarThumbSquare = userAvatars.avatarThumbSquare || null;

      UserModel.callUsersSigned();

      // WinChartModel.updateChart('updateFeatureCount', {
      //   feature: 'changeAvatar'
      // });

      $allonsy.log('allons-y-community', 'users:update(users/user.avatar)', {
        avatar: $message.avatar,
        socket: $socket
      });
    });
  }
}, {
  event: 'update(users/activeuser.pushnotifications)',
  isMember: true,
  controller: function($allonsy, $socket, UserModel, $message) {
    if (!this.validMessage($message)) {
      return;
    }

    $message.subscribe = !!$message.subscribe;

    if (!$message.endpoint || ($message.subscribe && (!$message.userPublicKey || !$message.userAuth))) {
      return;
    }

    UserModel.fromSocket($socket, function(err, user) {
      if (err || !user) {
        return;
      }

      user.notificationsPush = user.notificationsPush || [];

      var index = -1,
          hasChanges = false;

      for (var i = 0; i < user.notificationsPush.length; i++) {
        if (user.notificationsPush[i].endpoint == $message.endpoint) {
          index = i;
          break;
        }
      }

      if ($message.subscribe && index < 0) {
        hasChanges = true;
        user.notificationsPush.push({
          endpoint: $message.endpoint,
          userPublicKey: $message.userPublicKey,
          userAuth: $message.userAuth
        });
      }
      else if (!$message.subscribe && index > -1) {
        hasChanges = true;
        user.notificationsPush.splice(index, 1);
      }

      if (!hasChanges) {
        return;
      }

      user.save(function() {
        // WinChartModel.updateChart('updateFeatureCount', {
        //   feature: $message.subscribe ? 'pushNotificationsSubscribe' : 'pushNotificationsUnsubscribe'
        // });

        $allonsy.log('allons-y-community', 'users:update(users/activeuser.pushnotifications)', {
          subscribe: $message.subscribe,
          endpoint: $message.endpoint,
          socket: $socket
        });
      });
    });
  }
}, {
  event: 'update(users/user.activity)',
  controller: function($socket, $message) {
    if (!this.validMessage($message, {
      activity: ['boolean']
    })) {
      return;
    }

    $socket.userActivity = $message.activity;
  }
}];
