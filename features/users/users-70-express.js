'use strict';

module.exports = function($server, $BodyDataService, UserModel, GroupModel) {

  var web = $BodyDataService.data(null, 'web') || {};

  web.pushNotifications = process.env.USERS_GCM && process.env.USERS_GCM == 'true';

  if (process.env.USERS_RECAPTCHA && process.env.USERS_RECAPTCHA == 'true') {
    web.useRecaptcha = true;
    web.recaptchaKey = process.env.USERS_RECAPTCHA_PUBLIC_KEY;
  }

  $BodyDataService.data(null, 'web', web);

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

        $BodyDataService.data(req, 'user', userData);

        next();
      });
    });
  });

};
