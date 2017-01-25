'use strict';

module.exports = [{
  event: 'update(web/route)',
  controller: function($socket, GroupModel, $message) {
    if (!this.validMessage($message, {
      path: ['string', 'filled']
    })) {
      return;
    }

    GroupModel.groupsOpened($socket, $message.path);
  }
}, {
  event: 'create(groups/group)',
  isMember: true,
  controller: function($message, $socket, GroupModel) {
    if (!this.validMessage($message, {
      group: 'filled'
    })) {
      return;
    }

    GroupModel.createGroup($socket.user, $message.group, function(err, group) {
      if (err) {
        console.log(err);

        return;
      }

      $socket.emit('read(groups/group.new)', {
        url: group.url
      });
    });
  }
}, {
  event: 'update(groups/group)',
  isMember: true,
  controller: function($message, $socket, GroupModel) {
    if (!this.validMessage($message, {
      group: 'filled'
    })) {
      return;
    }

    GroupModel.updateGroup($socket.user, $message.group);
  }
}, {
  event: 'delete(groups/group)',
  isMember: true,
  controller: function($message, $socket, GroupModel) {
    if (!this.validMessage($message, {
      group: 'filled'
    })) {
      return;
    }

    GroupModel.deleteGroup($socket.user, $message.group.id, function(err, group) {
      if (err) {
        console.log(err);

        return;
      }

      $socket.emit('read(groups/group.delete)', {
        group: {
          id: group.id
        }
      });
    });
  }
}, {
  event: 'create(groups/group.invitation)',
  isMember: true,
  controller: function($allonsy, $socket, GroupModel, UserModel, $message) {
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

        if (!$message.isLeader && (group.special == 'unknowns' || group.special == 'members')) {
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
  controller: function($allonsy, $socket, GroupModel, UserModel, $message) {
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

            UserModel
              .update({
                id: user.id
              }, {
                groupsInvitations: user.groupsInvitations,
                notifications: user.notifications
              })
              .exec(function() {
                GroupModel
                  .update({
                    id: group.id
                  }, {
                    invitations: group.invitations
                  })
                  .exec(function() {
                    group[isLeader ? 'addLeader' : 'addMember'](user, true, function(err) {
                      if (err) {
                        return;
                      }

                      callback();
                    });
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

            UserModel
              .update({
                id: user.id
              }, {
                notifications: user.notifications
              })
              .exec(function() {
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
}, {
  event: 'delete(groups/group.invitation)',
  isMember: true,
  controller: function($socket, $message, GroupModel, UserModel, $SocketsService) {
    if (!this.validMessage($message, {
      url: ['string', 'filled'],
      invitationId: 'filled'
    })) {
      return;
    }

    GroupModel
      .findOne({
        url: $message.url
      })
      .exec(function(err, group) {
        if (err || !group) {
          return;
        }

        if (!$socket.user.isMembersLeader && !$socket.user.hasPermission('groups-leader:' + group.id)) {
          return;
        }

        group.invitations = group.invitations || [];

        var memberUrl = null,
            notificationId = null;

        for (var i = group.invitations.length - 1; i >= 0; i--) {
          if (group.invitations[i].id == $message.invitationId) {
            memberUrl = group.invitations[i].url;
            notificationId = group.invitations[i].notificationId;
            group.invitations.splice(i, 1);

            break;
          }
        }

        if (!memberUrl) {
          return;
        }

        GroupModel
          .update({
            id: group.id
          }, {
            invitations: group.invitations
          })
          .exec(function() {

            UserModel
              .findOne({
                url: memberUrl
              })
              .exec(function(err, member) {
                if (err || !member) {
                  return;
                }

                GroupModel.removeInvitationFromUser(member, group.id, notificationId);

                UserModel
                  .update({
                    id: member.id
                  }, {
                    groupsInvitations: member.groupsInvitations,
                    notifications: member.notifications
                  })
                  .exec(function() {
                    UserModel.refreshUsersGroupInvitations(group.id);

                    $SocketsService.each(function(socket) {
                      if (socket && socket.user && socket.user.id && socket.user.id == member.id) {
                        socket.emit('read(users/notifications)', {
                          notifications: member.notifications
                        });
                      }
                    });
                  });
              });

          });

      });
  }
}, {
  event: 'delete(groups/group.member)',
  isMember: true,
  controller: function($socket, $message, GroupModel, UserModel) {
    if (!this.validMessage($message, {
      url: ['string', 'filled'],
      memberId: ['string', 'filled']
    })) {
      return;
    }

    GroupModel
      .findOne({
        url: $message.url
      })
      .exec(function(err, group) {
        if (err || !group) {
          return;
        }

        if (group.special == 'members' || group.special == 'unknown' || group.special == 'deactivated') {
          return;
        }

        if (!$socket.user.isMembersLeader && !$socket.user.hasPermission('groups-leader:' + group.id)) {
          return;
        }

        var leaders = group.members.filter(function(member) {
          return member.isLeader;
        });

        if (leaders.length < 2) {
          for (var i = 0; i < group.members.length; i++) {
            if (group.members[i].id == $message.memberId) {
              if (group.members[i].isLeader) {
                $socket.emit('read(groups/group.member)', {
                  error: 'last-leader'
                });

                return;
              }

              break;
            }
          }
        }

        UserModel
          .findOne({
            id: $message.memberId
          })
          .exec(function(err, member) {
            if (err || !member) {
              return;
            }

            group.removeMember(member, true, function() {
              UserModel.refreshUsersGroupLeaders(group.id);
              UserModel.refreshUsersGroupMembers(group.id);
            });
          });

      });
  }
}, {
  event: 'update(groups/group.downmember)',
  isMember: true,
  controller: function($socket, $message, GroupModel, UserModel) {
    if (!this.validMessage($message, {
      url: ['string', 'filled'],
      memberId: ['string', 'filled']
    })) {
      return;
    }

    GroupModel
      .findOne({
        url: $message.url
      })
      .exec(function(err, group) {
        if (err || !group) {
          return;
        }

        if (group.special == 'unknown' || group.special == 'deactivated') {
          return;
        }

        if (!$socket.user.isMembersLeader && !$socket.user.hasPermission('groups-leader:' + group.id)) {
          return;
        }

        var leaders = group.members.filter(function(member) {
          return member.isLeader;
        });

        if (leaders.length < 2) {
          $socket.emit('read(groups/group.downmember)', {
            error: 'last-leader'
          });

          return;
        }

        UserModel
          .findOne({
            id: $message.memberId
          })
          .exec(function(err, member) {
            if (err || !member) {
              return;
            }

            group.leaderToMember(member, true, function() {
              UserModel.refreshUsersGroupLeaders(group.id);
              UserModel.refreshUsersGroupMembers(group.id);
            });
          });

      });
  }
}, {
  event: 'update(groups/group.deactivated)',
  isMember: true,
  controller: function($socket, $message, GroupModel, UserModel) {
    if (!this.validMessage($message, {
      memberId: ['string', 'filled']
    })) {
      return;
    }

    GroupModel
      .findOne({
        special: 'deactivated'
      })
      .exec(function(err, group) {
        if (err || !group) {
          return;
        }

        if (!$socket.user.isMembersLeader && !$socket.user.hasPermission('groups-leader:' + group.id)) {
          return;
        }

        UserModel
          .findOne({
            id: $message.memberId
          })
          .exec(function(err, member) {
            if (err || !member) {
              return;
            }

            member.groups = [];

            UserModel
              .update({
                id: member.id
              }, {
                goups: member.groups
              })
              .exec(function() {
                GroupModel.removeDeactivatedMember(member, true, function(err, deactivatedGroup, membersGroup) {
                  if (err || !deactivatedGroup || !membersGroup) {
                    return;
                  }

                  UserModel.refreshUsersGroupMembers(deactivatedGroup.id);
                  UserModel.refreshUsersGroupMembers(membersGroup.id);
                });
              });
          });

      });
  }
}, {
  event: 'call(groups/groups.publicPermissions)',
  isMember: true,
  controller: function($socket, GroupModel) {
    $socket.emit('read(groups/groups.publicPermissions)', {
      publicPermissions: GroupModel.availablePublicPermissions($socket)
    });
  }
}];
