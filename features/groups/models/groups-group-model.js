module.exports = function() {
  'use strict';

  DependencyInjection.model('GroupModel', function(
    $allonsy, $processIndex, $AbstractModel, $RealTimeService, $WebCreateService
  ) {

    var REALTIME_EVENTS = {
          'groups-group': {
            call: 'callGroup'
          },
          'groups-all': {
            call: 'callGroupsAll'
          },
          'groups-member': {
            call: 'callGroupsMember'
          },
          'groups-permissions': {
            call: 'callGroupsPermissions'
          }
        },
        SPECIALS_GROUPS = [{
          name: 'Members',
          special: 'members',
          specialDescription: 'Every registered user depends from this group. It can\'t be deleted.',
          description: 'Each signed user is automatically registered to this group.',
          permissionsMembers: [
            'groups-create',
            'groups-see-leaders:{{members}}',
            'groups-see:{{unknowns}}', 'groups-see-leaders:{{unknowns}}',
            'groups-see:{{deactivated}}', 'groups-see-leaders:{{deactivated}}'
          ]
        }, {
          name: 'Unknowns',
          special: 'unknowns',
          specialDescription: 'This group permissions are used to the unsigned visitors users. It can\'t be deleted.',
          description: 'Unsigned visitors. This group has no members.',
          permissionsMembers: [
            'members-signup', 'members-signin'
          ],
          permissionsLinked: [
            'groups-see:{{members}}', 'groups-see-leaders:{{members}}'
          ]
        }, {
          name: 'Deactivated',
          special: 'deactivated',
          specialDescription: [
            'Every deactivated user depends from this group. They can\'t sign in the plateform.',
            ' This group can\'t be deleted.'
          ].join(''),
          description: 'Deactivated members. Every member added here is deactivated and can\'t signin again.',
          permissionsLinked: [
            'groups-see:{{members}}', 'groups-see-leaders:{{members}}'
          ]
        }],
        CREATE_LINKS = {
          title: 'Groups',
          links: [{
            url: '/groups/create',
            image: '/public/groups/groups-web-create-thumb.png',
            title: 'Empty group',
            description: 'Create a new empty group as a leader.'
          }]
        },
        GROUPS_HOME_TILE = {
          url: '/groups',
          cover: '/public/groups/groups-home.png',
          large: true,
          centered: {
            title: 'GROUPS'
          }
        },
        GROUPS_URL_PATTERN = /^\/groups\/?$/,
        GROUPS_ITEM_URL_PATTERN = /^\/groups\/(?!create\/?$)(.+?)\/?$/,

        extend = require('extend'),
        async = require('async'),
        uuid = require('node-uuid'),
        path = require('path'),
        _permissions = {
          'groups-create': {
            title: 'Create groups',
            description: 'Can create new groups.',
            isPublic: true
          },
          'groups-see': {
            title: 'See the group',
            description: 'Who can see this group.',
            requiredOnMember: true,
            requiredOnLeader: true,
            linked: true,
            isPublic: false
          },
          'groups-join-member': {
            title: 'Join the group as a member',
            description: 'Who can ask to be invited as a member to this group.',
            linked: true,
            isPublic: false
          },
          'groups-join-leader': {
            title: 'Join the group as a leader',
            description: 'Who can ask to be invited as a leader to this group.',
            linked: true,
            isPublic: false
          },
          'groups-member': {
            title: 'Group member',
            description: 'Member of the group.',
            requiredOnMember: true,
            requiredOnLeader: true,
            linked: true,
            isPublic: false
          },
          'groups-leader': {
            title: 'Group leader',
            description: 'Leader of the group.',
            requiredOnLeader: true,
            linked: true,
            isPublic: false
          },
          'groups-see-members': {
            title: 'See the members',
            description: 'Who can see the members list.',
            requiredOnLeader: true,
            linked: true,
            isPublic: false
          },
          'groups-see-leaders': {
            title: 'See the leaders',
            description: 'Who can see the leaders list.',
            requiredOnLeader: true,
            linked: true,
            isPublic: false
          }
        };

    require(path.resolve(__dirname, 'groups-thumbs-factory-back.js'))();
    $allonsy.requireInFeatures('models/web-url-factory');

    var groupsThumbsFactory = DependencyInjection.injector.model.get('groupsThumbsFactory'),
        webUrlFactory = DependencyInjection.injector.model.get('webUrlFactory');

    function _formatGroupMember(user, leader, groupMember) {
      var member = {
        id: user.id,
        addedAt: groupMember && groupMember.addedAt || new Date(),
        isLeader: groupMember && groupMember.isLeader || false,
        url: user.url,
        username: user.username,
        firstname: user.firstname,
        lastname: user.lastname,
        avatarMini: user.avatarMini || null,
        avatarThumbSquare: user.avatarThumbSquare || null
      };

      if (leader) {
        member.invitationBy = _formatGroupMember(leader);
      }
      else if (groupMember && groupMember.invitationBy) {
        member.invitationBy = groupMember.invitationBy;
      }

      return member;
    }

    function _formatMemberGroup(group) {
      return {
        id: group.id,
        name: group.name,
        description: group.description,
        special: group.special || null,
        url: group.url,
        cover: group.cover,
        coverLarge: group.coverLarge,
        coverThumb: group.coverThumb,
        coverMini: group.coverMini
      };
    }

    return $AbstractModel('GroupModel', function() {

      return {
        identity: 'groups',
        entities: true,
        entityType: 'group',
        isSearchable: true,
        isSearchableAdvanced: true,
        attributes: {
          name: {
            type: 'string',
            index: true
          },
          special: {
            type: 'string',
            index: true
          },
          description: {
            type: 'string',
            index: true
          },
          url: {
            type: 'string',
            index: true
          },
          members: {
            type: 'array',
            index: true
          },
          invitations: {
            type: 'array',
            index: true
          },
          permissionsLinked: {
            type: 'array',
            index: true
          },
          permissionsMembers: {
            type: 'array',
            index: true
          },
          permissionsLeaders: {
            type: 'array',
            index: true
          },
          cover: 'string',
          coverLarge: 'string',
          coverThumb: 'string',
          coverMini: 'string',

          createUrl: function(force, callback) {
            var _this = this;

            if (_this.url && !force) {
              return callback(null, _this);
            }

            var GroupModel = DependencyInjection.injector.model.get('GroupModel'),
                url = webUrlFactory(_this.name);

            GroupModel
              .find([{
                url: url
              }, {
                url: new RegExp('^' + url + '-[0-9]+$', 'i')
              }])
              .exec(function(err, groupsWithSameUrl) {
                if (err) {
                  return callback(err);
                }

                var addCount = null;

                if (groupsWithSameUrl && groupsWithSameUrl.length) {
                  addCount = 0;

                  groupsWithSameUrl.forEach(function(group) {
                    var match = group.url.match(/-([0-9]+)$/);

                    if (match && match.length > 1) {
                      addCount = addCount < match[1] ? match[1] : addCount;
                    }
                  });
                }

                if (addCount !== null) {
                  addCount += 2;
                  url += '-' + addCount;
                }

                _this.url = url;

                callback(null, _this);
              });
          },

          fetchCover: function(callback) {
            groupsThumbsFactory(this, function() {
              callback();
            });
          },

          membersWithIds: function(ids, callback) {
            var _this = this;

            this.native(function(err, collection) {

              collection
                .find({
                  entityType: _this.entityType,
                  members: {
                    $elemMatch: {
                      id: {
                        $in: ids
                      }
                    }
                  }
                })
                .toArray(function(err, membersFound) {
                  if (err) {
                    return callback(err);
                  }

                  callback(null, membersFound);
                });
            });
          },

          addMembers: function(members, flush, callback) {
            var _this = this,
                GroupModel = DependencyInjection.injector.model.get('GroupModel'),
                UserModel = DependencyInjection.injector.model.get('UserModel'),
                membersAddGroup = [];

            _this.members = _this.members || [];

            members.forEach(function(member) {
              var found = false;

              for (var i = 0; i < _this.members.length; i++) {
                if (_this.members[i].id == member.id) {
                  found = true;
                  break;
                }
              }

              if (found) {
                return;
              }

              var groupMember = _formatGroupMember(member);

              membersAddGroup.push(member);

              _this.members.push(groupMember);
            });

            if (!membersAddGroup.length) {
              return callback(null, _this);
            }

            GroupModel
              .update({
                id: _this.id
              }, {
                members: _this.members
              })
              .exec(function(err) {
                if (err) {
                  return callback(err);
                }

                async.eachSeries(membersAddGroup, function(member, nextMember) {
                  member.groups = member.groups || [];

                  member.groups.push(_formatMemberGroup(_this));

                  UserModel
                    .update({
                      id: member.id
                    }, {
                      groups: member.groups
                    })
                    .exec(function() {
                      nextMember();
                    });

                }, function() {
                  if (!flush) {
                    return callback(null, _this);
                  }

                  _this.flushPermissions(membersAddGroup, callback);
                });
              });
          },

          addMember: function(member, flush, callback) {
            return this.addMembers([member], flush, callback);
          },

          removeMembers: function(members, flush, callback) {
            var _this = this,
                GroupModel = DependencyInjection.injector.model.get('GroupModel'),
                UserModel = DependencyInjection.injector.model.get('UserModel');

            _this.members = _this.members || [];

            async.eachSeries(members, function(member, nextMember) {
              for (var i = 0; i < _this.members.length; i++) {
                if (_this.members[i].id == member.id) {
                  _this.members.splice(i, 1);
                }
              }

              member.groups = member.groups || [];

              for (var i = 0; i < member.groups.length; i++) {
                if (member.groups[i].id == _this.id) {
                  member.groups.splice(i, 1);
                }
              }

              UserModel
                .update({
                  id: member.id
                }, {
                  groups: member.groups
                })
                .exec(function() {
                  nextMember();
                });

            }, function() {

              GroupModel
                .update({
                  id: _this.id
                }, {
                  members: _this.members
                })
                .exec(function() {
                  if (!flush) {
                    return callback(null, _this);
                  }

                  _this.flushPermissions(members, callback);
                });
            });
          },

          removeMember: function(member, flush, callback) {
            return this.removeMembers([member], flush, callback);
          },

          addLeaders: function(leaders, flush, callback) {
            var _this = this,
                GroupModel = DependencyInjection.injector.model.get('GroupModel'),
                UserModel = DependencyInjection.injector.model.get('UserModel'),
                membersAddGroupLeader = [];

            this.addMembers(leaders, false, function(err, group) {
              if (err || !group) {
                return callback(err || 'no group');
              }

              leaders.forEach(function(leader) {
                for (var i = 0; i < group.members.length; i++) {
                  if (group.members[i].id == leader.id) {

                    if (!group.members[i].isLeader) {
                      group.members[i].isLeader = true;

                      membersAddGroupLeader.push(leader);
                    }

                    break;
                  }
                }
              });

              if (!membersAddGroupLeader.length) {
                return callback(null, group);
              }

              GroupModel
                .update({
                  id: group.id
                }, {
                  members: group.members
                })
                .exec(function(err) {
                  if (err) {
                    return callback(err);
                  }

                  async.eachSeries(membersAddGroupLeader, function(leader, nextLeader) {
                    leader.groups = leader.groups || [];

                    for (var i = 0; i < leader.groups.length; i++) {
                      if (leader.groups[i].id == group.id) {
                        leader.groups[i].isLeader = true;

                        break;
                      }
                    }

                    UserModel
                      .update({
                        id: leader.id
                      }, {
                        groups: leader.groups
                      })
                      .exec(function() {
                        nextLeader();
                      });

                  }, function() {
                    if (!flush) {
                      return callback(null, _this);
                    }

                    _this.flushPermissions(membersAddGroupLeader, callback);
                  });
                });
            });
          },

          addLeader: function(leader, flush, callback) {
            return this.addLeaders([leader], flush, callback);
          },

          leaderToMember: function(leader, flush, callback) {
            var _this = this,
                GroupModel = DependencyInjection.injector.model.get('GroupModel'),
                UserModel = DependencyInjection.injector.model.get('UserModel'),
                down = false;

            for (var i = 0; i < this.members.length; i++) {
              if (this.members[i].id == leader.id) {

                if (this.members[i].isLeader) {
                  this.members[i].isLeader = false;

                  down = true;
                }

                break;
              }
            }

            if (!down) {
              return callback(null, this);
            }

            GroupModel
              .update({
                id: this.id
              }, {
                members: this.members
              })
              .exec(function(err) {
                if (err) {
                  return callback(err);
                }

                leader.groups = leader.groups || [];

                for (var i = 0; i < leader.groups.length; i++) {
                  if (leader.groups[i].id == _this.id) {
                    leader.groups[i].isLeader = false;

                    break;
                  }
                }

                UserModel
                  .update({
                    id: leader.id
                  }, {
                    groups: leader.groups
                  })
                  .exec(function() {
                    if (!flush) {
                      return callback(null, _this);
                    }

                    _this.flushPermissions([leader], callback);
                  });
              });
          },

          addDeactivatedMembers: function(leader, members, flush, callback) {
            var _this = this,
                GroupModel = DependencyInjection.injector.model.get('GroupModel'),
                UserModel = DependencyInjection.injector.model.get('UserModel'),
                $SocketsService = DependencyInjection.injector.model.get('$SocketsService');

            async.eachSeries(members, function(member, nextUser) {

              async.eachSeries(extend(true, [], member.groups), function(groupData, nextGroup) {

                GroupModel
                  .findOne({
                    id: groupData.id
                  })
                  .exec(function(err, group) {
                    if (err || !group) {
                      return nextGroup();
                    }

                    group.removeMember(member, false, nextGroup);
                  });

              }, function() {
                member.sessions = [];
                member.notificationsPush = [];
                member.homeTiles = [];

                var groupsIds = GroupModel.removeAllInvitationsFromUser(member);

                async.eachSeries(groupsIds, function(groupId, nextGroupId) {

                  GroupModel
                    .findOne({
                      id: groupId
                    })
                    .exec(function(err, group) {
                      if (err || !group) {
                        return nextGroupId();
                      }

                      group.invitations = group.invitations || [];

                      for (var i = 0; i < group.invitations.length; i++) {
                        if (group.invitations[i].id == member.id) {
                          group.invitations.splice(i, 1);

                          break;
                        }
                      }

                      GroupModel
                        .update({
                          id: group.id
                        }, {
                          invitations: group.invitations
                        })
                        .exec(function() {
                          nextGroupId();
                        });
                    });

                }, function() {
                  UserModel
                    .update({
                      id: member.id
                    }, {
                      sessions: member.sessions,
                      notificationsPush: member.notificationsPush,
                      groupsInvitations: member.groupsInvitations
                    })
                    .exec(function() {
                      _this.addMember(member, flush || false, function() {

                        $SocketsService.each(function(socket) {
                          if (socket && socket.user && socket.user.id && socket.user.id == member.id) {
                            socket.disconnect(true);
                          }
                        });

                        nextUser();
                      });
                    });
                });

              });

            }, function() {
              callback(null, _this, true);
            });
          },

          addDeactivatedMember: function(leader, member, flush, callback) {
            return this.addDeactivatedMembers(leader, [member], flush, callback);
          },

          addInvitations: function(leader, users, isLeader, callback) {
            var _this = this,
                GroupModel = DependencyInjection.injector.model.get('GroupModel'),
                usersToInvit = [],
                notificationId = uuid.v1();

            if (this.special == 'deactivated' && !isLeader) {
              return this.addDeactivatedMembers(leader, users, true, callback);
            }

            _this.invitations = _this.invitations || [];

            users.forEach(function(user) {
              var found = false;

              for (var i = 0; i < _this.members.length; i++) {
                if (_this.members[i].id == user.id) {
                  if (!isLeader || (isLeader && _this.members[i]).isLeader) {
                    found = true;
                  }

                  break;
                }
              }

              if (found) {
                return;
              }

              for (var i = 0; i < _this.invitations.length; i++) {
                if (_this.invitations[i].id == user.id) {
                  found = true;
                  break;
                }
              }

              if (found) {
                return;
              }

              var invitedUser = _formatGroupMember(user, leader, {
                isLeader: isLeader
              });

              usersToInvit.push(user);

              invitedUser.notificationId = notificationId;

              _this.invitations.push(invitedUser);
            });

            if (!usersToInvit.length) {
              return callback(null, _this);
            }

            usersToInvit = usersToInvit;

            GroupModel
              .update({
                id: _this.id
              }, {
                invitations: _this.invitations
              })
              .exec(function(err) {
                if (err) {
                  return callback(err);
                }

                var UserModel = DependencyInjection.injector.model.get('UserModel');

                async.eachSeries(usersToInvit, function(user, nextUser) {

                  user.groupsInvitations = user.groupsInvitations || [];

                  var invitation = _formatMemberGroup(_this);
                  invitation.notificationId = notificationId;

                  user.groupsInvitations.push(invitation);

                  UserModel
                    .update({
                      id: user.id
                    }, {
                      groupsInvitations: user.groupsInvitations
                    })
                    .exec(function() {
                      nextUser();
                    });

                }, function() {
                  UserModel.pushNotification(null, usersToInvit.map(function(user) {
                    return user.id;
                  }), {
                    id: notificationId,
                    message: 'You are invited to <strong>' + _this.name + '</strong>!',
                    content: [
                      '<strong>' + leader.username + '</strong> ',
                      'invites you to join ',
                      '<strong>' + _this.name + '</strong> as ',
                      isLeader ? 'leader' : 'member'
                    ].join(''),
                    picture: _this.coverMini || '/public/groups/group-mini.png',
                    pushTitle: 'You are invited! - ' + process.env.BRAND,
                    pushContent: leader.username + ' invites you to join ' + _this.name + ' as ' + (isLeader ? 'leader' : 'member'),
                    pushPicture: '/public/groups/group-notification.jpg',
                    eventName: 'url',
                    eventArgs: {
                      url: '/groups/' + _this.url
                    },
                    locked: true,
                    buttons: [{
                      title: 'accept',
                      action: {
                        type: 'socket.event',
                        event: 'update(groups/group.invitation)',
                        eventArgs: {
                          groupId: _this.id,
                          accept: true
                        }
                      },
                      cls: 'success-bg'
                    }, {
                      title: 'decline',
                      action: {
                        type: 'socket.event',
                        event: 'update(groups/group.invitation)',
                        eventArgs: {
                          groupId: _this.id,
                          accept: false
                        }
                      },
                      cls: 'warning-bg'
                    }]
                  },  function() {
                    callback(null, _this);
                  });
                });
              });
          },

          addInvitation: function(leader, user, isLeader, callback) {
            return this.addInvitations(leader, [user], isLeader, callback);
          },

          addPermissions: function(type, permissions, flush, callback) {
            var _this = this,
                GroupModel = DependencyInjection.injector.model.get('GroupModel'),
                someUpdated = false;

            if (!permissions || !permissions.length) {
              return callback(null, this);
            }

            this['permissions' + type] = this['permissions' + type] || [];

            permissions.forEach(function(permission) {
              if (_this['permissions' + type].indexOf(permission) < 0) {
                _this['permissions' + type].push(permission);

                someUpdated = true;
              }
            });

            if (!someUpdated) {
              if (callback) {
                callback(null, _this);
              }

              return;
            }

            var updateData = {};
            updateData['permissions' + type] = this['permissions' + type];

            GroupModel
              .update({
                id: this.id
              }, updateData)
              .exec(function(err) {
                if (err) {
                  if (callback) {
                    callback(err, _this);
                  }

                  return;
                }

                if (flush) {
                  return _this.flushPermissions(null, callback);
                }

                if (callback) {
                  callback(null, _this);
                }
              });
          },

          addPermissionsLinked: function(permissions, flush, callback) {
            this.addPermissions('Linked', permissions, flush, callback);
          },

          addPermissionsMembers: function(permissions, flush, callback) {
            this.addPermissions('Members', permissions, flush, callback);
          },

          addPermissionsLeaders: function(permissions, flush, callback) {
            this.addPermissions('Leaders', permissions, flush, callback);
          },

          removePermissions: function(type, permissions, flush, callback) {
            var _this = this,
                GroupModel = DependencyInjection.injector.model.get('GroupModel'),
                someUpdated = false;

            this['permissions' + type] = this['permissions' + type] || [];

            permissions.forEach(function(permission) {
              var index = _this['permissions' + type].indexOf(permission);
              if (index > -1) {
                _this['permissions' + type].splice(index, 1);

                someUpdated = true;
              }
            });

            if (!someUpdated) {
              if (callback) {
                callback(null, this);
              }

              return;
            }

            var updateData = {};
            updateData['permissions' + type] = this['permissions' + type];

            GroupModel
              .update({
                id: this.id
              }, updateData)
              .exec(function(err) {
                if (err) {
                  if (callback) {
                    callback(err);
                  }

                  return;
                }

                if (flush) {
                  return _this.flushPermissions(null, callback);
                }

                if (callback) {
                  callback(null, _this);
                }
              });
          },

          removePermissionsLinked: function(permissions, flush, callback) {
            this.removePermissions('Linked', permissions, flush, callback);
          },

          removePermissionsMembers: function(permissions, flush, callback) {
            this.removePermissions('Members', permissions, flush, callback);
          },

          removePermissionsLeaders: function(permissions, flush, callback) {
            this.removePermissions('Leaders', permissions, flush, callback);
          },

          flushPermissions: function(members, callback) {
            var GroupModel = DependencyInjection.injector.model.get('GroupModel'),
                UserModel = DependencyInjection.injector.model.get('UserModel'),
                $SocketsService = DependencyInjection.injector.model.get('$SocketsService'),
                _this = this,
                cacheGroups = [],
                cacheGroupsId = [];

            async.waterfall([function(waterfallCallback) {
              if (members) {
                return waterfallCallback();
              }

              _this.members = _this.members || [];
              if (!_this.members.length) {
                members = _this.members;

                return waterfallCallback();
              }

              var UserModel = DependencyInjection.injector.model.get('UserModel');

              UserModel
                .find({
                  id: _this.members.map(function(member) {
                    return member.id;
                  })
                })
                .exec(function(err, membersFound) {
                  members = membersFound || [];

                  waterfallCallback();
                });
            }], function() {
              async.eachSeries(members, function(member, nextMember) {
                var isMembersLeader = false;

                member.groups = member.groups || [];

                var ids = member.groups
                  .map(function(group) {
                    if (group.special == 'members' && group.isLeader) {
                      isMembersLeader = true;
                    }

                    return group.id;
                  })
                  .filter(function(id) {
                    return cacheGroupsId.indexOf(id) < 0;
                  });

                async.waterfall([function(next) {
                  if (!ids.length) {
                    return next();
                  }

                  GroupModel
                    .find({
                      id: ids
                    })
                    .exec(function(err, findGroups) {
                      findGroups = findGroups || [];

                      cacheGroupsId = cacheGroupsId.concat(ids);

                      ids.forEach(function(id) {
                        for (var i = 0; i < findGroups.length; i++) {
                          if (findGroups[i].id == id) {
                            cacheGroups.push(findGroups[i]);

                            break;
                          }
                        }
                      });

                      next();
                    });
                }], function() {
                  member.permissions = [],
                  member.permissionsPublic = [];
                  member.isMembersLeader = isMembersLeader;

                  if (isMembersLeader) {
                    Object.keys(_permissions).forEach(function(key) {
                      if (!_permissions[key].linked) {
                        member.permissions.push(key);
                      }
                    });
                  }

                  member.permissions = member.permissions || [];

                  member.groups.forEach(function(group) {
                    var cacheGroup = cacheGroups[cacheGroupsId.indexOf(group.id)];

                    member.permissions = member.permissions.concat(cacheGroup.permissionsMembers);

                    if (group.isLeader) {
                      member.permissions = member.permissions.concat(cacheGroup.permissionsLeaders);
                    }
                  });

                  member.permissions = member.permissions.filter(function(permission, index) {
                    return member.permissions.indexOf(permission) === index;
                  });

                  member.permissionsPublic = GroupModel.extractPublicPermissions(member.permissions);

                  UserModel
                    .update({
                      id: member.id
                    }, {
                      permissions: member.permissions,
                      permissionsPublic: member.permissionsPublic,
                      isMembersLeader: member.isMembersLeader
                    })
                    .exec(function() {
                      $SocketsService.each(function(socket) {
                        if (socket && socket.user && socket.user.id == member.id) {
                          socket.user = member;
                        }
                      });

                      nextMember();
                    });
                });
              }, function() {
                callback(null, _this);
              });
            });
          },

          hasPermissionToSee: function(user) {
            return DependencyInjection.injector.model.get('GroupModel').hasPermissionToSee(user, this.id);
          },

          userIsMember: function(user) {
            this.members = this.members || [];

            for (var i = 0; i < this.members.length; i++) {
              if (this.members[i].id == user.id) {
                return true;
              }
            }

            return false;
          },

          userIsLeader: function(user) {
            this.members = this.members || [];

            for (var i = 0; i < this.members.length; i++) {
              if (this.members[i].id == user.id) {
                return this.members[i].isLeader || false;
              }
            }

            return false;
          },

          hasPermissionToJoinAsMember: function(user) {
            return user.hasPermission('groups-join-member:' + this.id);
          },

          hasPermissionToJoinAsLeader: function(user) {
            return user.hasPermission('groups-join-leader:' + this.id);
          },

          publicData: function(user, moreData, remove) {
            return DependencyInjection.injector.model.get('GroupModel').publicData(this, user, moreData, remove);
          }
        },

        SPECIALS: SPECIALS_GROUPS,

        init: function() {
          var _this = this,
              EntityModel = DependencyInjection.injector.model.get('EntityModel'),
              UserModel = DependencyInjection.injector.model.get('UserModel');

          Object.keys(REALTIME_EVENTS).forEach(function(eventName) {
            if (REALTIME_EVENTS[eventName].call) {
              var call = REALTIME_EVENTS[eventName].call;

              REALTIME_EVENTS[eventName].call = function() {
                _this[call].apply(_this, arguments);
              };
            }
          });

          $RealTimeService.registerEvents(REALTIME_EVENTS);

          EntityModel.registerSearchPublicData('group', this, this.searchPublicData);

          if ($processIndex === 0) {
            this.fillSpecialGroups();
          }

          UserModel.onChangeAvatar(function(user, callback) {
            _this.updateMember(user, function() {
              callback();
            });
          });

          UserModel.homeDefaultTile(extend(true, {
            date: new Date()
          }, GROUPS_HOME_TILE));

          $WebCreateService.links(function() {
            _this.webCreateLinks.apply(this, arguments);
          });
        },

        webCreateLinks: function(sockets, sections, callback) {
          sockets.forEach(function(socket) {
            if (!socket || !socket.user || !socket.user.id) {
              return;
            }

            if (socket.user.hasPermission('groups-create')) {
              sections.push(CREATE_LINKS);
            }
          });

          callback();
        },

        fillSpecialGroups: function() {
          var _this = this,
              permissionsNames = ['permissionsMembers', 'permissionsLeaders', 'permissionsLinked'];

          this
            .find({
              special: SPECIALS_GROUPS.map(function(groupConfig) {
                return groupConfig.special;
              })
            })
            .exec(function(err, groups) {
              if (err) {
                $allonsy.logError('allons-y-community', 'groups:group-model:init:find-specials', {
                  error: err
                });

                return;
              }

              if (groups.length >= SPECIALS_GROUPS.length) {
                return;
              }

              var ids = {},
                  newGroups = [];

              groups.forEach(function(group) {
                ids[group.special] = group.id;
              });

              async.eachSeries(SPECIALS_GROUPS, function(groupConfig, nextGroupConfig) {
                var found = false;

                for (var i = 0; i < groups.length; i++) {
                  if (groups[i].special == groupConfig.special) {
                    found = true;

                    break;
                  }
                }

                if (found) {
                  return nextGroupConfig();
                }

                groupConfig = extend(true, {}, groupConfig);
                permissionsNames.forEach(function(permissionsName) {
                  delete groupConfig[permissionsName];
                });

                _this.createGroup(null, groupConfig, function(err, group) {
                  if (err) {
                    $allonsy.logError('allons-y-community', 'groups:group-model:init:create-special', {
                      error: err
                    });

                    return;
                  }

                  ids[group.special] = group.id;

                  newGroups.push(group);

                  $allonsy.outputInfo('► Create special group "' + groupConfig.special + '"');

                  nextGroupConfig();
                });
              }, function() {
                if (!newGroups.length) {
                  return;
                }

                var idsKeys = Object.keys(ids);

                SPECIALS_GROUPS.forEach(function(specialGroup) {
                  permissionsNames.forEach(function(permissionsName) {
                    specialGroup[permissionsName] = specialGroup[permissionsName] || [];

                    for (var i = 0; i < specialGroup[permissionsName].length; i++) {
                      for (var j = 0; j < idsKeys.length; j++) {
                        specialGroup[permissionsName][i] = specialGroup[permissionsName][i]
                          .replace(new RegExp('{{' + idsKeys[j] + '}}', 'g'), ids[idsKeys[j]]);
                      }
                    }
                  });

                });

                async.eachSeries(newGroups, function(group, nextGroup) {
                  var specialGroup = null;

                  for (var i = 0; i < SPECIALS_GROUPS.length; i++) {
                    if (SPECIALS_GROUPS[i].special == group.special) {
                      specialGroup = SPECIALS_GROUPS[i];

                      break;
                    }
                  }

                  if (!specialGroup) {
                    return nextGroup();
                  }

                  group.addPermissionsMembers(specialGroup.permissionsMembers, true, function(err, group) {
                    if (err) {
                      $allonsy.logError('allons-y-community', 'groups:group-model:init:create-special:add-permissions-members', {
                        error: err
                      });

                      return nextGroup();
                    }

                    group.addPermissionsLeaders(specialGroup.permissionsLeaders, true, function(err, group) {
                      if (err) {
                        $allonsy.logError('allons-y-community', 'groups:group-model:init:create-special:add-permissions-leaders', {
                          error: err
                        });

                        return nextGroup();
                      }

                      group.addPermissionsLinked(specialGroup.permissionsLinked, true, function(err) {
                        if (err) {
                          $allonsy.logError('allons-y-community', 'groups:group-model:init:create-special:add-permissions-linked', {
                            error: err
                          });
                        }

                        nextGroup();
                      });
                    });
                  });
                });
              });
            });
        },

        createGroup: function(user, groupData, callback) {
          callback = callback || function() {};

          if (user && !user.isMembersLeader && (!user.hasPermission || !user.hasPermission('groups-create'))) {
            return callback('no permission');
          }

          if (!groupData || typeof groupData != 'object' || !groupData.name) {
            return callback('no valid data');
          }

          var _this = this,
              GroupModel = DependencyInjection.injector.model.get('GroupModel');

          groupData.description = groupData.description || '';
          groupData.cover = groupData.cover || null;
          groupData.coverMini = groupData.coverMini || null;
          groupData.coverThumb = groupData.coverThumb || null;
          groupData.coverLarge = groupData.coverLarge || null;
          groupData.search1 = groupData.name;
          groupData.search3 = groupData.description;
          groupData.createdAt = new Date();
          groupData.updatedAt = groupData.createdAt;

          this
            .create(groupData)
            .exec(function(err, group) {
              if (err || !group) {
                return callback(err || 'no group');
              }

              group.createUrl(false, function(err) {
                if (err) {
                  return callback(err);
                }

                _this.updatePermissions(user, group, groupData.permissions, function() {

                  GroupModel
                    .update({
                      id: group.id
                    }, {
                      url: group.url,
                      permissionsMembers: group.permissionsMembers,
                      permissionsLeaders: group.permissionsLeaders
                    })
                    .exec(function() {
                      $allonsy.log('allons-y-community', 'groups:group-create:' + group.id, {
                        label: 'Create new group <span class="accent">[' + group.name + ']</span>',
                        user: user && user.email || null
                      });

                      if (!user) {
                        return callback(null, group);
                      }

                      group.addLeader(user, true, function() {
                        callback(null, group);
                      });
                    });
                });
              });
            });
        },

        deleteGroup: function(user, id, callback) {
          callback = callback || function() {};

          if (!id) {
            return callback('no id');
          }

          if (user && !user.isMembersLeader && (!user.hasPermission || !user.hasPermission('groups-leader:' + id))) {
            return callback('no permission');
          }

          var _this = this,
              GroupModel = DependencyInjection.injector.model.get('GroupModel'),
              UserModel = DependencyInjection.injector.model.get('UserModel');

          this
            .findOne({
              id: id
            })
            .exec(function(err, group) {
              if (err || !group) {
                return callback(err || 'group not found');
              }

              if (group.special) {
                return callback('group is special');
              }

              var members = group.members;

              group.members = [];

              GroupModel
                .update({
                  id: group.id
                }, {
                  members: group.members
                })
                .exec(function() {
                  if (err) {
                    return callback(err);
                  }

                  group.permissionsLinked = group.permissionsLinked || [];

                  var groupsToClean = [],
                      groupsToCleanPermissions = {};

                  group.permissionsLinked.forEach(function(permission) {
                    permission = permission.split(':');

                    if (groupsToClean.indexOf(permission[1]) < 0) {
                      groupsToClean.push(permission[1]);
                    }

                    groupsToCleanPermissions[permission[1]] = groupsToCleanPermissions[permission[1]] || [];
                    groupsToCleanPermissions[permission[1]].push(permission[0] + ':' + group.id);
                  });

                  async.eachSeries(groupsToClean, function(groupToCleanId, nextGoupToClean) {

                    _this
                      .findOne({
                        id: groupToCleanId
                      })
                      .exec(function(err, groupToClean) {
                        if (err || !group) {
                          return nextGoupToClean();
                        }

                        groupToClean.removePermissionsMembers(groupsToCleanPermissions[groupToCleanId], false, function() {
                          nextGoupToClean();
                        });

                      });

                  }, function() {

                    UserModel
                      .find({
                        id: members.map(function(member) {
                          return member.id;
                        })
                      })
                      .exec(function(err, users) {
                        if (err) {
                          return callback(err);
                        }

                        if (!users.length) {
                          return callback(null);
                        }

                        async.eachSeries(users, function(user, nextUser) {
                          user.groups = user.groups || [];

                          for (var i = user.groups.length - 1; i >= 0; i--) {
                            if (user.groups[i].id == group.id) {
                              user.groups.splice(i, 1);

                              break;
                            }
                          }

                          UserModel
                            .update({
                              id: user.id
                            }, {
                              groups: user.groups
                            })
                            .exec(function() {
                              nextUser();
                            });
                        }, function() {

                          group.flushPermissions(users, function(err) {
                            if (err) {
                              return callback(err);
                            }

                            group.invitations = group.invitations || [];

                            async.eachSeries(group.invitations, function(invitation, nextInvitation) {

                              UserModel
                                .findOne({
                                  id: invitation.id
                                })
                                .exec(function(err, user) {
                                  if (err || !user) {
                                    return nextInvitation();
                                  }

                                  _this.removeInvitationFromUser(user, group.id, invitation.notificationId);

                                  UserModel
                                    .update({
                                      id: user.id
                                    }, {
                                      groupsInvitations: user.groupsInvitations,
                                      notifications: user.notifications,
                                      groups: user.groups
                                    })
                                    .exec(function() {
                                      nextInvitation();
                                    });
                                });
                            }, function() {
                              _this
                                .destroy({
                                  id: group.id
                                })
                                .exec(function(err) {
                                  $allonsy.log('allons-y-community', 'groups:group-delete:' + group.id, {
                                    label: 'Delete group <span class="accent">[' + group.name + ']</span>',
                                    user: user && user.email || null
                                  });

                                  callback(err, group);
                                });
                            });
                          });
                        });
                      });
                  });
                });
            });
        },

        registerPermissions: function(permissions) {
          extend(true, _permissions, permissions);
        },

        extractPublicPermissions: function(permissions, fullObject) {
          var permissionsPublic = [];

          permissions.forEach(function(permission) {
            var permissionName = permission.split(':')[0];

            for (var key in _permissions) {
              if (_permissions.hasOwnProperty(key) && key == permissionName) {
                if (_permissions[key].isPublic) {
                  permissionsPublic.push(fullObject ? extend(true, {
                    name: key
                  }, _permissions[key]) : permission);
                }

                break;
              }
            }
          });

          return permissionsPublic;
        },

        updateMember: function(member, callback) {
          var GroupModel = DependencyInjection.injector.model.get('GroupModel');

          member.groups = member.groups || [];
          member.groupsInvitations = member.groupsInvitations || [];

          var groups = member.groups.concat(member.groupsInvitations);

          if (!groups.length) {
            return callback(null);
          }

          this
            .find({
              id: groups.map(function(group) {
                return group.id;
              })
            })
            .exec(function(err, groups) {
              if (err) {
                return callback(err);
              }

              groups = groups || [];

              async.eachSeries(groups, function(group, nextGroup) {
                group.members = group.members || [];

                for (var i = 0; i < group.members.length; i++) {
                  if (group.members[i].id == member.id) {
                    group.members[i] = _formatGroupMember(member, null, group.members[i]);

                    break;
                  }
                }

                group.invitations = group.invitations || [];

                for (var i = 0; i < group.invitations.length; i++) {
                  if (group.invitations[i].id == member.id) {
                    group.invitations[i] = _formatGroupMember(member, null, group.invitations[i]);

                    break;
                  }
                }

                GroupModel
                  .update({
                    id: group.id
                  }, {
                    members: group.members,
                    invitations: group.invitations
                  })
                  .exec(function() {
                    nextGroup();
                  });
              }, function() {
                callback(null);
              });
            });
        },

        callGroup: function($socket, eventName, args, callback) {
          if (!args || !args.length) {
            if (callback) {
              callback();
            }

            return;
          }

          this
            .findOne({
              or: [{
                id: args[0]
              }, {
                url: args[0]
              }]
            })
            .exec(function(err, group) {
              if (err || !group) {
                $RealTimeService.fire(eventName, {
                  error: 'not found'
                }, $socket);

                if (callback) {
                  callback();
                }

                return;
              }

              var publicGroup = group.publicData($socket.user, null, ['leaders', 'members', 'invitations']);

              $RealTimeService.fire(eventName, publicGroup ? {
                group: publicGroup
              } : {
                error: 'not found'
              }, $socket);

              if (callback) {
                callback();
              }
            });
        },

        callGroupsAll: function($socket, eventName, args, callback) {
          eventName = eventName || 'groups-all';

          var eventNamesCount = $RealTimeService.eventNamesFromCount('groups-all', 0, $socket);

          if (eventNamesCount === false) {
            return;
          }

          this
            .find()
            .limit(eventNamesCount ? eventNamesCount.maxCount : args && args[0] || 10)
            .sort('createdAt DESC')
            .exec(function(err, groups) {
              if (err || !groups) {
                return callback();
              }

              var sockets = $socket ? [$socket] : $RealTimeService.socketsFromOrigin('groups-all');

              if (!sockets.length) {
                if (callback) {
                  callback();
                }

                return;
              }

              sockets.forEach(function(socket) {
                var userGroups = groups
                  .map(function(group) {
                    return group.publicData(socket.user, null, ['leaders', 'members', 'invitations']);
                  })
                  .filter(function(group) {
                    return !!group;
                  });

                for (var i = 0; i < socket.realTimeEvents.length; i++) {
                  if (socket.realTimeEvents[i].origin == 'groups-all') {
                    if (
                      socket.realTimeEvents[i].args && socket.realTimeEvents[i].args[0] &&
                      socket.realTimeEvents[i].args[0] != 'all' && socket.realTimeEvents[i].args[0] < userGroups.length
                    ) {
                      userGroups = userGroups.slice(0, socket.realTimeEvents[i].args[0]);
                    }

                    break;
                  }
                }

                $RealTimeService.fire(eventName, {
                  groups: userGroups
                }, $socket);
              });

              if (callback) {
                callback();
              }
            });
        },

        callGroupsMember: function($socket, eventName, args, callback) {
          eventName = eventName || 'groups-member';

          if (!args || !args.length) {
            if (callback) {
              callback();
            }

            return;
          }

          var _this = this,
              UserModel = DependencyInjection.injector.model.get('UserModel');

          UserModel
            .findOne({
              id: args[0]
            })
            .exec(function(err, user) {
              if (err || !user) {
                if (callback) {
                  callback();
                }

                return;
              }

              _this
                .find({
                  id: user.groups.map(function(group) {
                    return group.id;
                  })
                })
                .exec(function(err, groups) {
                  groups = groups
                    .map(function(group) {
                      return group.publicData($socket.user, null, ['leaders', 'members', 'invitations']);
                    })
                    .filter(function(group) {
                      return !!group;
                    });

                  $RealTimeService.fire(eventName, {
                    groups: groups
                  }, $socket);

                  if (callback) {
                    callback();
                  }
                });
            });

        },

        refreshGroup: function(group, args, socket) {
          var sockets = [socket];

          if (!socket) {
            sockets = ($RealTimeService.socketsFromOrigin('groups-group', [group.id]) || [])
              .concat($RealTimeService.socketsFromOrigin('groups-group', [group.url]) || []);

            if (!sockets.length) {
              return;
            }

            sockets = sockets.filter(function(socket, index) {
              return sockets.indexOf(socket) === index;
            });
          }

          sockets.forEach(function(socket) {
            var groupPublic = group.publicData(socket.user, null, ['leaders', 'members', 'invitations']),
                result = {
                  group: groupPublic
                };

            if (!groupPublic) {
              return;
            }

            if (args) {
              extend(true, result, args);
            }

            $RealTimeService.fire('groups-group:' + group.id, result, socket);
            $RealTimeService.fire('groups-group:' + group.url, result, socket);
          });
        },

        callGroupsPermissions: function($socket, eventName, args, callback) {
          if (!args || !args.length) {
            if (callback) {
              callback();
            }

            return;
          }

          eventName = eventName || 'groups-permissions:' + args[0];

          var _this = this,
              sockets = [$socket];

          if (!$socket) {
            sockets = $RealTimeService.socketsFromOrigin('groups-permissions', [args[0]]) || [];

            if (!sockets.length) {
              return;
            }
          }

          this
            .findOne({
              id: args[0]
            })
            .exec(function(err, group) {
              if (err || !group) {
                if (callback) {
                  callback();
                }

                return;
              }

              var groupsIds = [],
                  groupLeaders = {
                    id: group.id,
                    name: group.name,
                    ownLeaders: true
                  },
                  groupMembers = {
                    id: group.id,
                    name: group.name,
                    ownMembers: true
                  },
                  result = {
                    canSeeGroups: {},
                    canSeeLeadersGroups: {},
                    canSeeMembersGroups: {},
                    publicPermissions: {}
                  };

              _this.extractPublicPermissions(group.permissionsMembers, true).forEach(function(permission) {
                result.publicPermissions[permission.name] = {
                  name: permission.name,
                  title: permission.title,
                  description: permission.description,
                  selected: true
                };
              });

              ['permissionsMembers', 'permissionsLinked'].forEach(function(permissionsSection) {
                if (!group[permissionsSection] || !group[permissionsSection].length) {
                  return;
                }

                group[permissionsSection].forEach(function(permission) {
                  var id = permission.indexOf(':') > -1 ? permission.split(':')[1] : null;

                  if (
                    permission.indexOf('groups-see:') > -1 &&
                    (permissionsSection == 'permissionsLinked' || id == group.id)
                  ) {
                    id = permission.replace('groups-see:', '');

                    if (id != group.id) {
                      result.canSeeGroups[id] = {};
                    }
                  }
                  else if (
                    permission.indexOf('groups-see-leaders:') > -1 &&
                    (permissionsSection == 'permissionsLinked' || id == group.id)
                  ) {
                    id = permission.replace('groups-see-leaders:', '');
                    result.canSeeLeadersGroups[id] = id == group.id ? groupMembers : {};
                  }
                  else if (
                    permission.indexOf('groups-see-members:') > -1 &&
                    (permissionsSection == 'permissionsLinked' || id == group.id)
                  ) {
                    id = permission.replace('groups-see-members:', '');
                    result.canSeeMembersGroups[id] = id == group.id ? groupMembers : {};
                  }

                  if (id && id != group.id && groupsIds.indexOf(id) < 0) {
                    groupsIds.push(id);
                  }
                });
              });

              async.waterfall([function(nextFunction) {
                if (!groupsIds.length) {
                  return nextFunction();
                }

                _this
                  .find({
                    id: groupsIds
                  })
                  .exec(function(err, groupsLinked) {
                    if (err || !groupsLinked.length) {
                      return nextFunction();
                    }

                    groupsLinked.forEach(function(groupLinked) {
                      ['canSeeGroups', 'canSeeLeadersGroups', 'canSeeMembersGroups'].forEach(function(pemissionSection) {
                        if (result[pemissionSection][groupLinked.id]) {
                          result[pemissionSection][groupLinked.id] = {
                            id: groupLinked.id,
                            name: groupLinked.name
                          };
                        }
                      });
                    });

                    nextFunction();
                  });

              }, function() {
                ['canSeeGroups', 'canSeeLeadersGroups', 'canSeeMembersGroups'].forEach(function(pemissionSection) {
                  result[pemissionSection] = Object.keys(result[pemissionSection]).map(function(key) {
                    return result[pemissionSection][key];
                  });
                });

                sockets.forEach(function(socket) {
                  if (!socket || !socket.user || !socket.user.hasPermission) {
                    return;
                  }

                  var resultForUser = extend(true, {}, result);

                  if (!socket.user.hasPermission('groups-see:' + group.id)) {
                    delete resultForUser.canSeeGroups;
                  }
                  if (!socket.user.hasPermission('groups-see-leaders:' + group.id)) {
                    delete resultForUser.canSeeLeadersGroups;
                  }
                  if (!socket.user.hasPermission('groups-see-members:' + group.id)) {
                    delete resultForUser.canSeeMembersGroups;
                  }

                  groupLeaders.fixed = true;
                  groupMembers.fixed = true;

                  resultForUser.canSeeGroups = resultForUser.canSeeGroups || [];
                  resultForUser.canSeeGroups.unshift(groupLeaders, groupMembers);

                  resultForUser.canSeeLeadersGroups = resultForUser.canSeeLeadersGroups || [];
                  resultForUser.canSeeLeadersGroups.unshift(groupLeaders);

                  resultForUser.canSeeMembersGroups = resultForUser.canSeeMembersGroups || [];
                  resultForUser.canSeeMembersGroups.unshift(groupLeaders);

                  Object.keys(_permissions).forEach(function(permissionName) {
                    if (
                      (_permissions[permissionName].unknownsOnly && (!group.special || group.special != 'unknowns')) ||
                      (socket.user.permissionsPublic.indexOf(permissionName) < 0 || resultForUser.publicPermissions[permissionName])
                    ) {
                      return;
                    }

                    resultForUser.publicPermissions[permissionName] = {
                      name: permissionName,
                      title: _permissions[permissionName].title,
                      description: _permissions[permissionName].description
                    };
                  });

                  resultForUser.publicPermissions = Object.keys(resultForUser.publicPermissions).sort().map(function(permissionName) {
                    return resultForUser.publicPermissions[permissionName];
                  });

                  $RealTimeService.fire(eventName, {
                    permissions: resultForUser
                  }, $socket);
                });

                if (callback) {
                  callback();
                }
              }]);
            });

        },

        removeAllInvitationsFromUser: function(user) {
          var groupsIds = [];

          user.groupsInvitations = user.groupsInvitations || [];

          var notificationsIds = user.groupsInvitations.map(function(invitation) {
            groupsIds.push(invitation.id);

            return invitation.notificationId;
          });

          user.groupsInvitations = [];

          if (notificationsIds.length) {
            for (var i = user.notifications.length - 1; i >= 0; i--) {
              if (!user.notifications[i] || !user.notifications[i].id) {
                continue;
              }

              for (var j = 0; j <= notificationsIds.length; j++) {
                if (user.notifications[i].id == notificationsIds) {
                  user.notifications.splice(i, 1);
                  notificationsIds.splice(j, 1);

                  break;
                }
              }

              if (!notificationsIds.length) {
                break;
              }
            }
          }

          return groupsIds;
        },

        removeInvitationFromUser: function(user, groupId, notificationId) {
          user.groupsInvitations = user.groupsInvitations || [];

          for (var i = user.groupsInvitations.length - 1; i >= 0; i--) {
            if (user.groupsInvitations[i].id == groupId) {
              user.groupsInvitations.splice(i, 1);
            }
          }

          if (notificationId) {
            user.notifications = user.notifications || [];

            for (var i = 0; i < user.notifications.length; i++) {
              if (user.notifications[i] && user.notifications[i].id && user.notifications[i].id == notificationId) {
                user.notifications.splice(i, 1);

                break;
              }
            }
          }
        },

        hasPermissionToSee: function(user, groupId) {
          return user && user.hasPermission && (user.isMembersLeader || user.hasPermission('groups-see:' + groupId));
        },

        searchPublicData: function(group, $socket, regex) {
          if (!$socket || !$socket.user) {
            return null;
          }

          group = this.publicData(group, $socket.user, null, [
            'members', 'permissionsLeaders', 'permissionsMembers', 'invitations'
          ]);

          if (group) {
            group.name = group.name.replace(regex, '<strong>$1</strong>');
          }

          return group;
        },

        publicData: function(group, user, moreData, remove) {
          if (!user) {
            return null;
          }

          group.invitations = group.invitations || [];

          if (!this.hasPermissionToSee(user, group.id || group._id)) {
            var hasPermissionToSee = false;

            for (var i = 0; i < group.invitations.length; i++) {
              if (group.invitations[i].id == user.id) {
                hasPermissionToSee = true;

                break;
              }
            }

            if (!hasPermissionToSee) {
              return null;
            }
          }

          group = {
            id: group.id || group._id,
            createdAt: group.createdAt,
            updatedAt: group.updatedAt,
            name: group.name,
            description: group.description,
            url: group.url,
            special: group.special,
            members: group.members || [],
            cover: group.cover || null,
            coverLarge: group.coverLarge || null,
            coverThumb: group.coverThumb || null,
            coverMini: group.coverMini || null,
            permissionsLeaders: group.permissionsLeaders,
            permissionsMembers: group.permissionsMembers,
            invitations: group.invitations,
            membersLength: 0,
            leadersLength: 0
          };

          if (group.special) {
            for (var i = 0; i < this.SPECIALS.length; i++) {
              if (this.SPECIALS[i].special == group.special) {
                group.specialDescription = this.SPECIALS[i].specialDescription;
              }
            }
          }

          if (group.special == 'unknowns') {
            group.members = group.members.filter(function(member) {
              return member.isLeader;
            });
          }

          var seeMembers = user.hasPermission('groups-see-members:' + group.id),
              seeLeaders = user.isMembersLeader || user.hasPermission('groups-see-leaders:' + group.id),
              isMember = user.hasPermission('groups-member:' + group.id),
              isLeader = user.hasPermission('groups-leader:' + group.id);

          group.activeUserisMember = isMember;
          group.activeUserisLeader = isLeader;
          group.activeUserCanJoinAsLeader = !isLeader && user.hasPermission('groups-join-leader:' + group.id);
          group.activeUserCanJoinAsMember = !isMember && user.hasPermission('groups-join-member:' + group.id);
          group.activeUserCanInvitLeaders = isLeader,
          group.activeUserCanInvitMembers = isLeader && (
            !group.special || (group.special != 'members' && group.special != 'unknowns')
          ) || false;

          if (!seeMembers && !seeLeaders) {
            group.members = [];
          }
          else if (!seeMembers) {
            group.members = group.members.filter(function(member) {
              return member.isLeader;
            });
          }
          else if (!seeLeaders) {
            group.members = group.members.filter(function(member) {
              return !member.isLeader;
            });
          }

          if (!isMember) {
            delete group.permissionsMembers;
          }
          if (!isLeader) {
            delete group.permissionsLeaders;
            delete group.invitations;
          }

          if (group.members) {
            group.members.forEach(function(member) {
              group.membersLength += !member.isLeader ? 1 : 0;
              group.leadersLength += member.isLeader ? 1 : 0;

              if (member.isLeader) {
                group.leadersIds = group.leadersIds || [];
                group.leadersIds.push(member.id);
              }
            });
          }

          if (group.permissionsMembers) {
            group.permissionsMembers = this.extractPublicPermissions(group.permissionsMembers, true);
          }
          if (group.permissionsLeaders) {
            group.permissionsLeaders = this.extractPublicPermissions(group.permissionsLeaders, true);
          }

          if (moreData) {
            extend(true, group, moreData);
          }

          if (remove) {
            remove.forEach(function(removeKey) {
              delete group[removeKey];
            });
          }

          return group;
        },

        unknownPermissions: function(callback) {
          var _this = this;

          this
            .findOne({
              special: 'unknowns'
            })
            .exec(function(err, group) {
              if (err || !group) {
                return callback({
                  permissions: [],
                  permissionsPublic: []
                });
              }

              callback({
                permissions: group.permissionsMembers,
                permissionsPublic: _this.extractPublicPermissions(group.permissionsMembers)
              });
            });
        },

        isDeactivated: function(member, callback) {
          this
            .findOne({
              special: 'deactivated'
            })
            .exec(function(err, group) {
              if (err || !group) {
                return callback(false);
              }

              group.members = group.members || [];

              for (var i = 0; i < group.members.length; i++) {
                if (group.members[i].id == member.id) {
                  return callback(!group.members[i].isLeader);
                }
              }

              callback(false);
            });
        },

        membersHasLeaderfunction: function(callback) {
          this
            .findOne({
              special: 'members'
            })
            .exec(function(err, group) {
              if (err || !group) {
                return callback(true);
              }

              group.members = group.members || [];

              for (var i = 0; i < group.members.length; i++) {
                if (group.members[i].isLeader) {
                  return callback(true);
                }
              }

              callback(false);
            });
        },

        groupsOpened: function($socket, url) {
          var _this = this,
              UserModel = DependencyInjection.injector.model.get('UserModel'),
              match = url && url.match(GROUPS_ITEM_URL_PATTERN) || false,
              matchGroups = !match && url && url.match(GROUPS_URL_PATTERN) || false;

          if (!$socket || !$socket.user || !$socket.user.id || !match && !matchGroups) {
            return;
          }

          var tile = null;

          async.waterfall([function(next) {
            if (matchGroups) {
              tile = extend(true, {
                date: new Date()
              }, GROUPS_HOME_TILE);

              return next();
            }

            var groupUrl = match[1].split('/')[0];

            _this
              .findOne({
                url: groupUrl
              })
              .exec(function(err, group) {
                if (err || !group) {
                  return;
                }

                tile = {
                  date: new Date(),
                  url: '/groups/' + groupUrl,
                  cover: group.coverThumb || '/public/groups/group.png',
                  details: {
                    title: group.name,
                    text: group.description
                  }
                };

                next();
              });

          }, function() {
            if (!tile) {
              return;
            }

            UserModel.addHomeTile(tile, $socket.user.id);
          }]);
        },

        removeDeactivatedMember: function(member, flush, callback) {
          var _this = this;

          this
            .findOne({
              special: 'deactivated'
            })
            .exec(function(err, deactivatedGroup) {
              if (err || !deactivatedGroup) {
                return callback(err || 'no deactivated group');
              }

              var found = false;

              for (var i = 0; i < deactivatedGroup.members.length; i++) {
                if (deactivatedGroup.members[i].id == member.id) {
                  found = true;
                  deactivatedGroup.members.splice(i, 1);

                  break;
                }
              }

              if (!found) {
                return callback('no deactivated');
              }

              _this
                .update({
                  id: deactivatedGroup.id
                }, {
                  members: deactivatedGroup.members
                })
                .exec(function() {

                  _this
                    .findOne({
                      special: 'members'
                    })
                    .exec(function(err, membersGroup) {
                      if (err || !membersGroup) {
                        return callback(err || 'no members group');
                      }

                      membersGroup.addMember(member, flush, function() {
                        callback(null, deactivatedGroup, membersGroup);
                      });
                    });

                });
            });
        },

        updateGroup: function(user, groupData, callback) {
          var _this = this;

          callback = callback || function() {};

          if (
            !user || typeof user != 'object' || !user.hasPermission || !groupData || typeof groupData != 'object' ||
            !groupData.id || !groupData.name
          ) {
            return callback('no valid data');
          }

          this
            .findOne({
              id: groupData.id
            })
            .exec(function(err, group) {
              if (err) {
                return callback(err);
              }

              if (!user.isMembersLeader && !user.hasPermission('groups-leader:' + group.id)) {
                return callback('no leader');
              }

              group.name = groupData.name;
              group.description = groupData.description || '';
              group.cover = groupData.cover || null;
              group.coverMini = groupData.coverMini || null;
              group.coverThumb = groupData.coverThumb || null;
              group.coverLarge = groupData.coverLarge || null;
              group.search1 = group.name;
              group.search3 = group.description;

              _this.updatePermissions(user, group, groupData.permissions, function() {
                _this
                  .update({
                    id: group.id
                  }, {
                    name: group.name,
                    description: group.description,
                    cover: group.cover,
                    coverMini: group.coverMini,
                    coverThumb: group.coverThumb,
                    coverLarge: group.coverLarge,
                    search1: group.search1,
                    search3: group.search3
                  })
                  .exec(function(err) {
                    if (err) {
                      return callback(err);
                    }

                    $allonsy.log('allons-y-community', 'groups:group-update:' + group.id, {
                      label: 'Update <span class="accent">[' + group.name + ']</span> group',
                      user: user.email
                    });

                    _this.refreshGroup(group);
                    _this.callGroupsPermissions(null, null, [group.id]);
                  });
              });
            });
        },

        updatePermissions: function(user, group, permissions, callback) {
          var _this = this,
              permissionsLinked = group.permissionsLinked || [],
              permissionsMembers = extend(true, [], group.permissionsMembers || []),
              permissionsRef = {
                canSeeGroups: 'groups-see',
                canSeeLeadersGroups: 'groups-see-leaders',
                canSeeMembersGroups: 'groups-see-members'
              },
              linkedGroups = {};

          callback = callback || function() {};

          group.permissionsLeaders = group.permissionsLeaders || [];
          group.permissionsMembers = group.permissionsMembers || [];

          ['permissionsLeaders', 'permissionsMembers'].forEach(function(tableName) {
            for (var i = 0; i < group[tableName].length; i++) {
              if (group[tableName][i].indexOf(':') > -1) {
                var id = group[tableName][i].split(':')[1];
                if (!linkedGroups[id]) {
                  linkedGroups[id] = [];
                }
              }
            }
          });

          group.permissionsLinked = [];

          permissions = permissions || {};
          permissions.canSeeGroups = permissions.canSeeGroups || [];
          permissions.canSeeLeadersGroups = permissions.canSeeLeadersGroups || [];
          permissions.canSeeMembersGroups = permissions.canSeeMembersGroups || [];
          permissions.publicPermissions = permissions.publicPermissions || [];

          Object.keys(_permissions).forEach(function(key) {
            var permission = key + (_permissions[key].linked ? ':' + group.id : '');
            if (_permissions[key].requiredOnMember && group.permissionsMembers.indexOf(permission) < 0) {
              group.permissionsMembers.push(permission);
            }
            if (_permissions[key].requiredOnLeader && group.permissionsLeaders.indexOf(permission) < 0) {
              group.permissionsLeaders.push(permission);
            }
          });

          ['canSeeGroups', 'canSeeLeadersGroups', 'canSeeMembersGroups'].forEach(function(permissionCanName) {
            var permissionCan = permissions[permissionCanName];

            permissionCan.forEach(function(p) {
              var permissionToAdd = permissionsRef[permissionCanName] + ':' + p.id;

              if (p.isFixed) {
                return;
              }

              if (p.ownLeaders) {
                permissionToAdd = permissionsRef[permissionCanName] + ':' + group.id;

                if (group.permissionsLeaders.indexOf(permissionToAdd) > -1) {
                  return;
                }

                group.permissionsLeaders.push(permissionToAdd);

                return;
              }
              else if (p.ownMembers) {
                permissionToAdd = permissionsRef[permissionCanName] + ':' + group.id;

                if (group.permissionsMembers.indexOf(permissionToAdd) > -1) {
                  return;
                }

                group.permissionsMembers.push(permissionToAdd);

                return;
              }

              linkedGroups[p.id] = linkedGroups[p.id] || [];
              linkedGroups[p.id].push(permissionsRef[permissionCanName] + ':' + group.id);

              if (group.permissionsLinked.indexOf(permissionToAdd) > -1) {
                return;
              }

              group.permissionsLinked.push(permissionToAdd);
            });
          });

          permissions.publicPermissions.forEach(function(p) {
            if (!_permissions[p.name] || !_permissions[p.name].isPublic) {
              return;
            }

            var index = group.permissionsMembers.indexOf(p.name);

            if (p.selected && index < 0) {
              group.permissionsMembers.push(p.name);
            }
            else if (!p.selected && index > -1) {
              group.permissionsMembers.splice(index, 1);
            }
          });

          if (
            group.permissionsMembers.sort().join('') == permissionsMembers.sort().join('') &&
            group.permissionsLinked.sort().join('') == permissionsLinked.sort().join('')
          ) {
            return callback();
          }

          delete linkedGroups[group.id];

          async.eachSeries(Object.keys(linkedGroups), function(groupId, nextGroup) {

            if (!linkedGroups[groupId].length) {
              return nextGroup();
            }

            _this
              .findOne({
                id: groupId
              })
              .exec(function(err, groupToUpdate) {
                if (err || !groupToUpdate) {
                  return nextGroup();
                }

                var permissionsMembers = groupToUpdate.permissionsMembers.filter(function(permission) {
                  if (permission.indexOf(':') < 0) {
                    return true;
                  }

                  return permission.split(':')[1] != group.id;
                });

                groupToUpdate.permissionsMembers = permissionsMembers.concat(linkedGroups[groupId]);

                _this
                  .update({
                    id: groupId
                  }, {
                    permissionsMembers: groupToUpdate.permissionsMembers
                  })
                  .exec(function() {
                    groupToUpdate.flushPermissions(null, function() {
                      nextGroup();
                    });
                  });
              });

          }, function() {

            _this
              .update({
                id: group.id
              }, {
                permissionsLeaders: group.permissionsLeaders,
                permissionsMembers: group.permissionsMembers,
                permissionsLinked: group.permissionsLinked
              })
              .exec(function() {
                group.flushPermissions(null, function() {
                  callback(null, true);
                });
              });
          });
        },

        autocomplete: function(user, name, excludes, callback) {
          var _this = this,
              findName = '(' + name.toLowerCase() + ')',
              findQuery = {
                entityType: this.entityType,
                name: new RegExp(findName, 'i')
              },
              hasOwnLeaders = false,
              hasOwnMembers = false;

          if (excludes && excludes.length) {
            findQuery = {
              $and: [findQuery, {
                _id: {
                  $nin: excludes.map(function(exclude) {
                    if (exclude == -1) {
                      hasOwnLeaders = true;
                    }
                    else if (exclude == -2) {
                      hasOwnMembers = true;
                    }
                    else {
                      return _this.mongo.objectId(exclude);
                    }

                    return null;
                  })
                }
              }]
            };
          }

          this.native(function(err, collection) {
            collection
              .find(findQuery, {}, {
                limit: 10,
                sort: [['name', 'asc']]
              })
              .toArray(function(err, groups) {
                if (err || !groups || !groups.length) {
                  return callback(err, groups);
                }

                groups = groups
                  .map(function(group) {
                    return {
                      id: group._id,
                      value: group.name,
                      display: group.name.replace(new RegExp(findName, 'i'), '<strong>$1</strong>')
                    };
                  })
                  .filter(function(group) {
                    return user.isMembersLeader || user.hasPermission('groups-see:' + group.id);
                  });

                if (!hasOwnLeaders) {
                  groups.unshift({
                    id: null,
                    value: null,
                    display: 'Own leaders',
                    ownLeaders: true
                  });
                }

                if (!hasOwnMembers) {
                  groups.unshift({
                    id: null,
                    value: null,
                    display: 'Own members',
                    ownMembers: true
                  });
                }

                callback(err, groups);
              });
          });
        }
      };

    });

  });

  return 'GroupModel';
};
