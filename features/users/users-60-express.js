'use strict';

module.exports = function($server, $BodyDataService, UserModel, GroupModel) {

  $server.apiFilter(function(req, res, config) {
    if (config.isMember && (!req.user || !req.user.id)) {
      res.sendStatus(403);

      return false;
    }

    if (config.permissions && config.permissions.length) {
      if (!req.user || !req.user.id || !req.user.hasPermissions(config.permissions)) {
        res.sendStatus(403);

        return false;
      }
    }

    return true;
  });

  $server.use(function(req, res, next) {

    UserModel.fromSession(req.signedCookies.session || null, function(user, session) {
      req.user = user;
      req.userSession = session;

      if (user.id && session) {
        res.cookie('session', session.session, {
          maxAge: session.duration,
          signed: true
        });
      }
      else if (req.signedCookies.session) {
        res.clearCookie('session');
      }

      GroupModel.membersHasLeaderfunction(function(value) {
        var userData = UserModel.ownPublicData(user);

        if (!value) {
          userData.membersNeedsLeader = true;
        }

        var web = $BodyDataService.data('web') || {};

        web.pushNotifications = process.env.USERS_GCM && process.env.USERS_GCM == 'true';

        $BodyDataService.data('web', web);
        $BodyDataService.data('user', userData);

        next();
      });
    });
  });

};
