'use strict';

module.exports = [{
  event: 'create(groups/group.invitation)',
  isMember: true,
  controller: function($allonsy, $socket, GroupModel, UserModel, $SocketsService, $message) {
    if (!this.validMessage($message, {
      groupId: 'filled'
    })) {
      return;
    }

    GroupModel
      .findOne({
        id: $message.groupId
      })
      .exec(function(err, group) {
        if (err || !group.userIsLeader($socket.user)) {
          return;
        }

        if ($message.add) {
          UserModel
            .findOne({
              email: $message.add
            })
            .exec(function(err, user) {
              if (err || !user) {
                return;
              }

              group.addInvitation($socket.user, user, $message.isLeader || false, function(err, group, directMember) {
                if (err) {
                  return;
                }

                if (directMember) {
                  UserModel.refreshUsersGroupMembers(group.id);
                }
                else {
                  UserModel.refreshUsersGroupInvitations(group.id);
                }

                $allonsy.log('allons-y-community', 'groups:group-invit:' + group.id, {
                  label: [
                    'Invit <span class="accent">', user.username, '</span> ',
                    'to be <span class="accent">', ($message.isLeader ? 'leader' : 'member'), '</span> ',
                    'of the group <span class="accent">', group.name, '</span>'
                  ].join(''),
                  metric: {
                    key: $message.isLeader ? 'communityGroupsInvitLeader' : 'communityGroupsInvitMember',
                    name: $message.isLeader ? 'Invite Leader' : 'Invite Member',
                    description: $message.isLeader ?
                      'Invite a user to be leader of a group.' :
                      'Invite a user to be member of a group'
                  },
                  socket: $socket
                });
              });
            });
        }
      });
  }
}, {
  event: 'update(groups/group.invitation)',
  isMember: true,
  controller: function($allonsy, $socket, $SocketsService, GroupModel, UserModel, $message) {
    if (!this.validMessage($message, {
      notificationId: 'filled',
      groupId: 'filled',
      accept: 'boolean'
    })) {
      return;
    }

    var async = require('async'),
        accept = $message.accept,
        isLeader = false;

    GroupModel
      .findOne({
        id: $message.groupId
      })
      .exec(function(err, group) {
        if (err || !group) {
          return;
        }

        group.invitations = group.invitations || [];

        var invitationBy = null;

        for (var i = group.invitations.length - 1; i >= 0; i--) {
          if (group.invitations[i].id == $socket.user.id) {
            isLeader = group.invitations[i].isLeader;
            invitationBy = group.invitations[i].invitationBy;
            group.invitations.splice(i, 1);

            break;
          }
        }

        if (!invitationBy) {
          return;
        }

        async.waterfall([function(callback) {

          UserModel.fromSocket($socket, function(err, user) {
            if (err || !user) {
              return;
            }

            GroupModel.removeInvitationFromUser(user, group.id);

            user.save(function() {
              if (!accept) {
                group.save(function(err) {
                  if (err) {
                    return;
                  }

                  callback();
                });

                return;
              }

              group[isLeader ? 'addLeader' : 'addMember'](user, true, function(err) {
                if (err) {
                  return;
                }

                callback();
              });
            });
          });

        }, function(callback) {
          UserModel.fromSocket($socket, function(err, user) {
            if (err || !user) {
              return;
            }

            user.notifications = user.notifications || [];

            for (var i = 0; i < user.notifications.length; i++) {
              if (user.notifications[i].id && user.notifications[i].id == $message.notificationId) {
                user.notifications[i].date = new Date();
                user.notifications[i].viewed = true;
                user.notifications[i].notified = true;
                user.notifications[i].locked = false;
                user.notifications[i].buttons = null;
                user.notifications[i].content = accept ?
                  'You are now <strong>' + (isLeader ? 'leader' : 'member') + '</strong> of <strong>' + group.name + '</strong>!' :
                  'You have denied the invitation to be <strong>' + (isLeader ? 'leader' : 'member') + '</strong> of <strong>' + group.name + '</strong>!';

                break;
              }
            }

            user.save(function() {
              $socket.emit('read(users/notifications)', {
                notifications: user.notifications
              });

              callback();
            });
          });

        }], function() {
          GroupModel.refreshGroup(group);

          UserModel.refreshUsersGroupLeaders(group.id);
          UserModel.refreshUsersGroupMembers(group.id);
          UserModel.refreshUsersGroupInvitations(group.id);

          var leadersIds = group.members
            .filter(function(member) {
              return member.isLeader && member.id != $socket.user.id;
            })
            .map(function(member) {
              return member.id;
            });

          if (!leadersIds.length) {
            return;
          }

          UserModel.pushNotification(null, leadersIds, {
            message: accept ?
              'A new ' + (isLeader ? 'leader' : 'member') + ' joins <strong>' + group.name + '</strong>!' :
              'Someone denied to be ' + (isLeader ? 'leader' : 'member') + ' of <strong>' + group.name + '</strong>!',
            content: accept ?
              [
                $socket.user.username + ' is now ',
                '<strong>', (isLeader ? 'leader' : 'member'), '</strong> of <strong>', group.name, '</strong>! ',
                '<em>(invited by ', invitationBy.username, ')</em>'
              ].join('') :
              [
                $socket.user.username + ' declined becoming ',
                '<strong>', (isLeader ? 'leader' : 'member'), '</strong> of <strong>', group.name, '</strong>. ',
                '<em>(invited by ', invitationBy.username, ')</em>'
              ].join(''),
            picture: group.coverMini || '/public/groups/group-mini.png',
            pushTitle: accept ?
              'A new ' + (isLeader ? 'leader' : 'member') + ' joins ' + group.name + '! - ' + process.env.BRAND :
              'Someone denied to be ' + (isLeader ? 'leader' : 'member') + ' of ' + group.name + '!',
            pushContent: accept ?
              [
                $socket.user.username + ' is now ',
                (isLeader ? 'leader' : 'member'), ' of ', group.name, '! ',
                '(invited by ', invitationBy.username, ')'
              ].join('') :
              [
                $socket.user.username + ' declined becoming ',
                (isLeader ? 'leader' : 'member'), ' of ', group.name, '. ',
                '(invited by ', invitationBy.username, ')'
              ].join(''),
            pushPicture: '/public/groups/group-notification.jpg',
            eventName: 'url',
            eventArgs: {
              url: '/groups/' + group.url
            }
          }, function() {

            $allonsy.log('allons-y-community', 'groups:group-invit-' + (accept ? 'accept' : 'decline') + ':' + group.id, {
              label: [
                (accept ? 'Accept' : 'Decline'), ' ',
                'invitation to be <span class="accent">', (isLeader ? 'leader' : 'member'), '</span>',
                'of the group <span class="accent">', group.name, '</span>, ',
                'invited by <span class="accent">', invitationBy.username, '</span>'
              ].join(''),
              metric: accept ? {
                key: isLeader ? 'communityGroupsAcceptLeader' : 'communityGroupsAcceptMember',
                name: isLeader ? 'Accept Leader' : 'Accept Member',
                description: isLeader ?
                  'Accept an invitation to become leader of a group.' :
                  'Accept an invitation to become member of a group.'
              } : {
                key: isLeader ? 'communityGroupsDeclineLeader' : 'communityGroupsDeclineMember',
                name: isLeader ? 'Decline Leader' : 'Decline Member',
                description: isLeader ?
                  'Decline an invitation to become leader of a group.' :
                  'Decline an invitation to become member of a group.'
              },
              socket: $socket
            });
          });
        });
      });
  }
}];
