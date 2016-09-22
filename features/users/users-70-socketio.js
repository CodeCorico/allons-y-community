'use strict';

module.exports = function($allonsy, UserModel, $io, $SocketsService) {

  $io.eventFilter(function(socket, config) {
    if (config.isMember && (!socket.user || !socket.user.id)) {
      return false;
    }

    if (config.permissions && config.permissions.length) {
      if (!socket.user || !socket.user.id || !socket.user.hasPermissions(config.permissions)) {
        return false;
      }
    }

    return true;
  });

  $io.on('connection', function(socket) {
    socket.user = null;
    socket.userConnectionDate = new Date();
    socket.userActivity = true;

    UserModel.fromSession(socket.request.signedCookies.session || null, function(user, session) {
      var userHasOtherSockets = false,
          log = 'users:socket-signin-unknown:' + (session && session.session || ''),
          interval = null;

      socket.user = user;
      socket.userSession = session;

      // WinChartModel.updateChart('updateFeatureCount', {
      //   feature: 'connectionsBeta'
      // });

      if (user.id) {
        log = 'users:socket-signin:' + user.email + ':' + session.session;

        $SocketsService.each(function(socketInLoop) {
          if (socketInLoop == socket || !socketInLoop.user || socketInLoop.user.id != user.id) {
            return;
          }

          userHasOtherSockets = true;

          if (socket.userConnectionDate - socketInLoop.userConnectionDate) {
            socket.userConnectionDate = socketInLoop.userConnectionDate;
          }
        });

        UserModel.callUsersSigned();

        // WinChartModel.updateChart('usersConnectedBeta', {
        //   userId: socket.user.id
        // });
      }

      if (!userHasOtherSockets) {
        var hours = socket.userConnectionDate.getHours();

        interval = '0-3';
        interval = hours >= 3 ? '3-6' : interval;
        interval = hours >= 6 ? '6-9' : interval;
        interval = hours >= 9 ? '9-12' : interval;
        interval = hours >= 12 ? '12-15' : interval;
        interval = hours >= 15 ? '15-18' : interval;
        interval = hours >= 18 ? '18-21' : interval;
        interval = hours >= 21 ? '21-0' : interval;

        // WinChartModel.updateChart('updateFeatureCount', {
        //   feature: 'connections' + interval + 'Beta'
        // });
      }

      $allonsy.log('allons-y-community', log, {
        label: 'Open socket',
        socket: socket,
        interval: interval
      });

      socket.emit('read(users/activeuser.signed)', {
        user: {
          id: user.id
        }
      });

      if (user.id) {
        UserModel.checkAvatar(socket);
      }
    });

    socket.on('disconnect', function() {
      var userHasOtherSockets = false,
          session = socket.request.signedCookies.session || null,
          log = 'users:socket-signout-unknown:' +  (session || ''),
          duration = null;

      if (socket.user && socket.user.id) {
        log = 'users:socket-signout:' + socket.user.email + ':' + session;

        $SocketsService.each(function(socketInLoop) {
          if (socketInLoop == socket || !socketInLoop.user || socketInLoop.user.id != socket.user.id) {
            return;
          }

          userHasOtherSockets = true;
        });
      }

      if (!userHasOtherSockets && socket.userConnectionDate) {
        var minutes = (new Date().getTime() - socket.userConnectionDate.getTime()) / 1000 / 60;

        duration = '<30m';
        duration = minutes >= 30 ? '>30m' : duration;
        duration = minutes >= 60 ? '>1h' : duration;
        duration = minutes >= 60 * 2 ? '>2h' : duration;
        duration = minutes >= 60 * 4 ? '>4h' : duration;
        duration = minutes >= 60 * 8 ? '>8h' : duration;
        duration = minutes >= 60 * 12 ? '>12h' : duration;
        duration = minutes >= 60 * 24 ? '>24h' : duration;

        // WinChartModel.updateChart('updateFeatureCount', {
        //   feature: duration
        // });
      }

      $allonsy.log('allons-y-community', log, {
        label: 'Close socket <span class="accent">[' + duration + ']</span>',
        socket: socket,
        duration: duration
      });

      // PostModel.callPostsOpened();

      if (socket.user && socket.user.id) {
        UserModel.callUsersSigned();
      }
    });

  });

};
