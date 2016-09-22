module.exports = function() {
  'use strict';

  DependencyInjection.model('GroupModel', function($allonsy, $processIndex, $AbstractModel, $RealTimeService) {

    var REALTIME_EVENTS = {
          'groups-group': {
            call: 'callGroup'
          },
          'groups-all': {
            call: 'callGroupsAll'
          },
          'groups-member': {
            call: 'callGroupsMember'
          }
        },
        SPECIALS_GROUPS = [{
          name: 'Members',
          special: 'members',
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
          description: 'Unsigned visitors',
          permissionsMembers: [
            'members-register', 'members-signin'
          ],
          permissionsLinked: [
            'groups-see:{{members}}', 'groups-see-leaders:{{members}}'
          ]
        }, {
          name: 'Deactivated',
          special: 'deactivated',
          description: 'Deactivated members',
          permissionsLinked: [
            'groups-see:{{members}}', 'groups-see-leaders:{{members}}'
          ]
        }],

        extend = require('extend'),
        async = require('async'),
        uuid = require('node-uuid'),
        path = require('path'),
        _permissions = {
          'groups-create': {
            title: 'Create groups',
            description: 'Can create new groups',
            isPublic: true
          },
          'groups-see': {
            title: 'See the group',
            description: 'Who can see this group',
            requiredOnMember: true,
            requiredOnLeader: true,
            linked: true,
            isPublic: false
          },
          'groups-join-member': {
            title: 'Join the group as member',
            description: 'Who can ask to be invited as a member to this group',
            linked: true,
            isPublic: false
          },
          'groups-join-leader': {
            title: 'Join the group as leader',
            description: 'Who can ask to be invited as a leader to this group',
            linked: true,
            isPublic: false
          },
          'groups-member': {
            title: 'Group member',
            description: 'Member of the group',
            requiredOnMember: true,
            requiredOnLeader: true,
            linked: true,
            isPublic: false
          },
          'groups-leader': {
            title: 'Group leader',
            description: 'Leader of the group',
            requiredOnLeader: true,
            linked: true,
            isPublic: false
          },
          'groups-see-members': {
            title: 'See the members',
            description: 'Who can see the members list',
            requiredOnLeader: true,
            linked: true,
            isPublic: false
          },
          'groups-see-leaders': {
            title: 'See the leaders',
            description: 'Who can see the leaders list',
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

            _this.save(function(err) {
              if (err) {
                return callback(err);
              }

              async.eachSeries(membersAddGroup, function(member, nextMember) {
                member.groups = member.groups || [];

                member.groups.push(_formatMemberGroup(_this));

                member.save(function() {
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
            var _this = this;

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

              member.save(nextMember);

            }, function() {

              _this.save(function() {
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

              group.save(function(err) {
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

                  leader.save(function() {
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

          addDeactivatedMembers: function(leader, members, flush, callback) {
            var _this = this,
                GroupModel = DependencyInjection.injector.model.get('GroupModel'),
                $SocketsService = DependencyInjection.injector.model.get('$SocketsService');

            async.eachSeries(members, function(member, nextUser) {

              async.eachSeries(member.groups, function(groupData, nextGroup) {

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

                      group.save(nextGroupId);
                    });

                }, function() {
                  member.save(function() {
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

            _this.save(function(err) {
              if (err) {
                return callback(err);
              }

              var UserModel = DependencyInjection.injector.model.get('UserModel');

              async.eachSeries(usersToInvit, function(user, nextUser) {

                user.groupsInvitations = user.groupsInvitations || [];

                var invitation = _formatMemberGroup(_this);
                invitation.notificationId = notificationId;

                user.groupsInvitations.push(invitation);

                user.save(nextUser);

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



          initPermissions: function(callback) {
            var _this = this;

            this.permissionsMembers = [];
            this.permissionsLeaders = [];

            Object.keys(_permissions).forEach(function(key) {
              var permission = key + (_permissions[key].linked ? ':' + _this.id : '');

              if (_permissions[key].requiredOnMember) {
                _this.permissionsMembers.push(permission);
              }
              if (_permissions[key].requiredOnLeader) {
                _this.permissionsLeaders.push(permission);
              }
            });

            this.save(callback);
          },

          addPermissions: function(type, permissions, flush, callback) {
            var _this = this,
                someUpdated = false;

            if (!permissions || !permissions.length) {
              return callback(null, this);
            }

            this['permissions' + type] = this['permissions' + type] || [];

            permissions.forEach(function(permission) {
              if (_this['permissions' + type].indexOf(permission) < 0) {
                _this['permissions' + type].push(permission);

                // if (permission.indexOf('{{members}}')) {
                //   throw new Error('WHAT THE FUCK');
                // }

                someUpdated = true;
              }
            });

            if (!someUpdated) {
              if (callback) {
                callback(null, _this);
              }

              return;
            }

            this.save(function(err) {
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

            this.save(function(err) {
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

                  member.save(function() {
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

          if ($processIndex > 0) {
            return;
          }

          this.fillSpecialGroups();

          UserModel.onChangeAvatar(function(user, callback) {
            _this.updateMember(user, function() {
              callback();
            });
          });
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

                _this.createGroup(groupConfig, function(err, group) {
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

        createGroup: function(data, callback) {
          data.search1 = data.name || null;
          data.search3 = data.description || null;

          data.createdAt = new Date();
          data.updatedAt = data.createdAt;

          this
            .create(data)
            .exec(function(err, group) {
              if (err || !group) {
                return callback(err || 'no group');
              }

              group.createUrl(false, function(err) {
                if (err) {
                  return callback(err);
                }

                group.initPermissions(function(err) {
                  if (err) {
                    return callback(err);
                  }

                  $allonsy.log('allons-y-community', 'groups:group-create:' + group.id, {
                    label: 'Create new group <span class="accent">[' + group.name + ']</span>'
                  });

                  callback(null, group);
                });
              });
            });
        },

        deleteGroup: function(idOrUrl, callback) {
          var _this = this,
              UserModel = DependencyInjection.injector.model.get('UserModel');

          this
            .findOne({
              or: [{
                id: idOrUrl
              }, {
                url: idOrUrl
              }]
            })
            .exec(function(err, group) {
              if (err || !group) {
                return callback(err || 'group not found');
              }

              var members = group.members;

              group.members = [];

              group.save(function(err) {
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

                      (users || []).forEach(function(user) {
                        user.groups = user.groups || [];

                        for (var i = user.groups.length - 1; i >= 0; i--) {
                          if (user.groups[i].id == group.id) {
                            user.groups.splice(i, 1);

                            break;
                          }
                        }
                      });

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

                              user.save(nextInvitation);
                            });
                        }, function() {
                          _this
                            .destroy({
                              id: group.id
                            })
                            .exec(function(err) {

                              $allonsy.log('allons-y-community', 'groups:group-delete:' + group.id, {
                                label: 'Delete group <span class="accent">[' + group.name + ']</span>'
                              });

                              callback(err);
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
                  permissionsPublic.push(fullObject ? _permissions[key] : permission);
                }

                break;
              }
            }
          });

          return permissionsPublic;
        },

        updateMember: function(member, callback) {
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

                group.save(nextGroup);
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

              sockets.forEach(function(socket) {
                var userGroups = groups
                  .map(function(group) {
                    group = group.publicData(socket.user, null, ['leaders', 'members', 'invitations']);

                    if (!group) {
                      return null;
                    }

                    return group;
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

          var _this = this;

          if (!$socket) {
            if (callback) {
              callback();
            }

            return;
          }

          var UserModel = DependencyInjection.injector.model.get('UserModel');

          UserModel.fromSocket($socket, function(err, user) {
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
                groups = groups.map(function(group) {
                  group = group.publicData($socket.user, null, ['leaders', 'members', 'invitations']);

                  return group;
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

          group.name = group.name.replace(regex, '<strong>$1</strong>');

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

          if (group && group.special == 'unknowns') {
            group.members = group.members.filter(function(member) {
              return member.isLeader;
            });
          }

          var seeMembers = user.hasPermission('groups-see-members:' + group.id),
              seeLeaders = user.isMembersLeader || user.hasPermission('groups-see-leaders:' + group.id),
              isMember = user.hasPermission('groups-member:' + group.id),
              isLeader = user.hasPermission('groups-leader:' + group.id);

          group.activeUserisLeader = isMember;
          group.activeUserisMember = isLeader;
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
        }
      };

    });

  });

  return 'GroupModel';
};
