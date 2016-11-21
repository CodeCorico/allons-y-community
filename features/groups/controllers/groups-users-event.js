'use strict';

module.exports = [{
  event: 'call(groups/users.search)',
  isMember: true,
  controller: function($socket, GroupModel, UserModel, $message) {
    if (!this.validMessage($message, {
      groupId: 'filled',
      search: ['string', 'filled'],
      limit: ['number', 'filled']
    })) {
      return;
    }

    $message.limit = Math.max(0, Math.min(100, parseInt($message.limit, 10)));

    GroupModel
      .findOne({
        id: $message.groupId
      })
      .exec(function(err, group) {
        if (err) {
          return;
        }

        var notIds = group.members || [];

        if ($message.isLeader) {
          notIds = group.members.filter(function(member) {
            return member.isLeader;
          });
        }

        notIds = notIds
          .concat((group.invitations || []))
          .map(function(member) {
            return UserModel.mongo.objectId(member.id);
          });

        UserModel.searchByName($message.search, group.members && group.members.length ? {
          _id: {
            $nin: notIds
          }
        } : null, $message.limit, function(err, users) {
          if (err) {
            return;
          }

          $socket.emit('read(groups/users.search)', {
            users: users.map(function(user) {
              return {
                email: user.email,
                firstname: user.firstname,
                lastname: user.lastname,
                username: user.username,
                url: user.url,
                avatar: user.avatar || null,
                avatarThumb: user.avatarThumb || null,
                avatarThumbVertical: user.avatarThumbVertical || null,
                avatarThumbSquare: user.avatarThumbSquare || null,
                avatarMini: user.avatarMini || null
              };
            })
          });
        });
      });
  }
}];
