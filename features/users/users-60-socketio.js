'use strict';

module.exports = function(UserModel, $io, $SocketsService) {

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
      var userHasOtherSockets = false;

      socket.user = user;
      socket.userSession = session;

      // WinChartModel.updateChart('updateFeatureCount', {
      //   feature: 'connectionsBeta'
      // });

      if (user.id) {
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

      socket.emit('read(users/activeuser.signed)', {
        user: {
          id: user.id
        }
      });

      if (!userHasOtherSockets) {
        var hours = socket.userConnectionDate.getHours(),
            interval = '0to3';

        interval = hours >= 3 ? '3to6' : interval;
        interval = hours >= 6 ? '6to9' : interval;
        interval = hours >= 9 ? '9to12' : interval;
        interval = hours >= 12 ? '12to15' : interval;
        interval = hours >= 15 ? '15to18' : interval;
        interval = hours >= 18 ? '18to21' : interval;
        interval = hours >= 21 ? '21to0' : interval;

        // WinChartModel.updateChart('updateFeatureCount', {
        //   feature: 'connections' + interval + 'Beta'
        // });
      }

      if (user.id) {
        UserModel.checkAvatar(socket);
      }
    });

    socket.on('disconnect', function() {
      var userHasOtherSockets = false;

      if (socket.user) {
        $SocketsService.each(function(socketInLoop) {
          if (socketInLoop == socket || !socketInLoop.user || socketInLoop.user.id != socket.user.id) {
            return;
          }

          userHasOtherSockets = true;
        });
      }

      if (!userHasOtherSockets && socket.userConnectionDate) {
        var minutes = (new Date().getTime() - socket.userConnectionDate.getTime()) / 1000 / 60,
            feature = null;

        feature = minutes < 30 ? 'connectionsLess30mBeta' : feature;
        feature = minutes >= 30 ? 'connectionsMore30mBeta' : feature;
        feature = minutes >= 60 ? 'connectionsMore1hBeta' : feature;
        feature = minutes >= 60 * 2 ? 'connectionsMore2hBeta' : feature;
        feature = minutes >= 60 * 4 ? 'connectionsMore4hBeta' : feature;
        feature = minutes >= 60 * 8 ? 'connectionsMore8hBeta' : feature;
        feature = minutes >= 60 * 12 ? 'connectionsMore12hBeta' : feature;
        feature = minutes >= 60 * 24 ? 'connectionsMore24hBeta' : feature;

        // if (feature) {
        //   WinChartModel.updateChart('updateFeatureCount', {
        //     feature: feature
        //   });
        // }
      }

      // PostModel.callPostsOpened();

      if (socket.user) {
        UserModel.callUsersSigned();
      }
    });

  });

};
