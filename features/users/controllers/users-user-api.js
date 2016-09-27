'use strict';

module.exports = [{
  method: 'POST',
  url: 'users/user-notification-action',
  controller: function($allonsy, $req, $res, UserModel, $SocketsService) {
    $res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    $req.body = $req.body || {};

    if (typeof $req.body != 'object' || !$req.body.user || !$req.body.id) {
      return $res
        .status(400)
        .json({
          error: 'Bad request'
        });
    }

    UserModel.notificationViewed($req.body.user, $req.body.id, function(err) {
      if (err) {
        return $res
          .status(400)
          .json({
            error: 'Bad request'
          });
      }

      $SocketsService.emit(null, {
        'user.id': $req.body.user
      }, null, 'read(users/notifications.viewed)', {
        id: $req.body.id
      });

      $allonsy.log('allons-y-community', 'users:users:user-notification-action', {
        label: 'Action on notification',
        metric: {
          key: 'communityUsersNotificationAction',
          name: 'Click notif',
          description: 'Click on a notification.'
        },
        req: $req,
        notification: $req.body.id
      });

      $res.send({
        success: true
      });
    });
  }
}];

