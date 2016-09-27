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
      }

      if (!userHasOtherSockets) {
        var hours = socket.userConnectionDate.getHours();

        interval = '0h-3h';
        interval = hours >= 3 ? '3h-6h' : interval;
        interval = hours >= 6 ? '6h-9h' : interval;
        interval = hours >= 9 ? '9h-12h' : interval;
        interval = hours >= 12 ? '12h-15h' : interval;
        interval = hours >= 15 ? '15h-18h' : interval;
        interval = hours >= 18 ? '18h-21h' : interval;
        interval = hours >= 21 ? '21h-0h' : interval;
      }

      var metrics = [{
        key: 'communityUsersSocketIn',
        name: 'Connections',
        description: 'New socket connection opened.'
      }];

      if (interval) {
        metrics.push({
          key: 'communityUsersSocketIn' + interval,
          name: 'Connections ' + interval,
          description: 'Connections between ' + interval.split('-').join(' and ') + ' count.'
        });
      }

      var date = new Date(),
          minDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

      if (!user.lastSocketDate || user.lastSocketDate < minDate) {
        user.lastSocketDate = date.getTime();

        metrics.push({
          key: 'communityUsersUnique',
          name: 'Connections uniques',
          description: 'Unique connections count.'
        });

        user.save();
      }

      $allonsy.log('allons-y-community', log, {
        label: 'Open socket',
        metrics: metrics,
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
      }

      $allonsy.log('allons-y-community', log, {
        label: 'Close socket <span class="accent">[' + duration + ']</span>',
        metric: duration ? {
          key: 'communityUsersSocketOut' + duration,
          name: 'Connections ' + duration,
          description: 'Connections ' + duration.replace('<', 'under ').replace('>', 'above ') + ' count.'
        } : null,
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
