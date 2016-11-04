module.exports = function() {
  'use strict';

  DependencyInjection.model('UserModel', function($allonsy, $AbstractModel, $RealTimeService, $i18nService) {

    var MAX_NOTIFICATION_TIME = 3600 * 24 * 30, // 30 days in sec
        FORGOT_CODE_DURATION = 30 * 60 * 1000, // 30 min in ms
        PERMISSIONS = {
          'members-signup': {
            title: 'Signup',
            description: 'Signup to the platform.',
            isPublic: true
          },
          'members-signin': {
            title: 'Signin',
            description: 'Signin to the platform.',
            isPublic: true
          }
        },
        REALTIME_EVENTS = {
          'users-user': {
            call: 'callUser'
          },
          'users-groupleaders': {
            call: 'callUsersGroupLeaders'
          },
          'users-groupmembers': {
            call: 'callUsersGroupMembers'
          },
          'users-groupinvitations': {
            call: 'callUsersGroupInvitations'
          }
        },
        MAX_HOME_TILES = 30,

        async = require('async'),
        extend = require('extend'),
        bcrypt = require('bcrypt'),
        uuid = require('node-uuid'),
        cookieParser = require('cookie-parser'),
        webPush = process.env.USERS_GCM && process.env.USERS_GCM == 'true' ? require('web-push') : false,
        path = require('path'),
        _changeAvatarMethods = [],
        _connectedMembers = {
          total: 0
        },
        _homeDefaultTiles = [],
        _signupCodes = {};

    require(path.resolve(__dirname, 'users-thumbs-factory-back.js'))();
    $allonsy.requireInFeatures('models/web-url-factory');

    var usersThumbsFactory = DependencyInjection.injector.model.get('usersThumbsFactory'),
        webUrlFactory = DependencyInjection.injector.model.get('webUrlFactory');

    if (webPush) {
      webPush.setGCMAPIKey(process.env.USERS_GCM_API_KEY);
    }

    return $AbstractModel('UserModel', function() {

      return {
        identity: 'users',
        entities: true,
        entityType: 'user',
        isSearchable: true,
        isSearchableAdvanced: true,
        attributes: {
          isMembersLeader: {
            type: 'boolean',
            index: true
          },
          sessions: {
            type: 'array',
            index: true
          },
          username: {
            type: 'string',
            index: true
          },
          password: 'string',
          forgotCode: 'string',
          forgotCodeCreatedAt: 'date',
          url: {
            type: 'string',
            index: true
          },
          groups: {
            type: 'array',
            index: true
          },
          groupsInvitations: {
            type: 'array',
            index: true
          },
          permissions: {
            type: 'array',
            index: true
          },
          permissionsPublic: {
            type: 'array',
            index: true
          },
          avatar: 'string',
          avatarThumb: 'string',
          avatarThumbVertical: 'string',
          avatarThumbSquare: 'string',
          avatarMini: 'string',
          avatarFavicon: 'string',
          notifications: 'array',
          avatarReminder: 'date',
          notificationsPush: 'array',

          hasPermissions: function(permissions) {
            var UserModel = DependencyInjection.injector.model.get('UserModel');

            return UserModel.hasPermissions(this, permissions);
          },

          hasPermission: function(permission) {
            return this.hasPermissions([permission]);
          },

          publicData: function(moreData, remove) {
            return DependencyInjection.injector.model.get('UserModel').publicData(this, moreData, remove);
          },

          ownPublicData: function(moreData, remove) {
            return DependencyInjection.injector.model.get('UserModel').ownPublicData(this, moreData, remove);
          },

          createUrl: function(force, callback) {
            var _this = this;

            if (_this.url && !force) {
              return callback(null, _this);
            }

            var UserModel = DependencyInjection.injector.model.get('UserModel'),
                url = webUrlFactory(_this.firstname + '-' + _this.lastname).replace('-', '.');

            UserModel
              .find([{
                url: url
              }, {
                url: new RegExp('^' + url + '\.[0-9]+$', 'i')
              }])
              .exec(function(err, usersWithSameUrl) {
                if (err) {
                  return callback(err);
                }

                var addCount = null;

                if (usersWithSameUrl && usersWithSameUrl.length) {
                  addCount = 0;

                  usersWithSameUrl.forEach(function(user) {
                    var match = user.url.match(/\.([0-9]+)$/);

                    if (match && match.length > 1) {
                      addCount = addCount < match[1] ? match[1] : addCount;
                    }
                  });
                }

                if (addCount !== null) {
                  addCount += 2;
                  url += '.' + addCount;
                }

                _this.url = url;

                callback(null, _this);
              });
          }
        },

        init: function() {
          var _this = this,
              GroupModel = DependencyInjection.injector.model.get('GroupModel'),
              EntityModel = DependencyInjection.injector.model.get('EntityModel');

          GroupModel.registerPermissions(PERMISSIONS);

          Object.keys(REALTIME_EVENTS).forEach(function(eventName) {
            if (REALTIME_EVENTS[eventName].call) {
              var call = REALTIME_EVENTS[eventName].call;

              REALTIME_EVENTS[eventName].call = function() {
                _this[call].apply(_this, arguments);
              };
            }
          });

          $RealTimeService.registerEvents(REALTIME_EVENTS);

          EntityModel.registerSearchPublicData('user', this, this.searchPublicData);

          var WebLogModel = DependencyInjection.injector.model.get('WebLogModel', true);

          if (WebLogModel) {
            WebLogModel.logConverter(function() {
              _this.logConverter.apply(_this, arguments);
            });

            WebLogModel.searchConditions(function() {
              _this.searchConditions.apply(_this, arguments);
            });
          }

          var $WebHomeService = DependencyInjection.injector.controller.get('$WebHomeService', true);

          if ($WebHomeService) {
            $WebHomeService.tilesLoader(function() {
              _this.homeTilesLoader.apply(_this, arguments);
            });

            $WebHomeService.metric({
              name: 'connectedMembers',
              title: 'members signed in',
              value: 0
            });
          }
        },

        logConverter: function(log) {
          if (log.req && log.req.user && log.req.user.id && !log.user) {
            log.user = log.req.user;
          }
          if (log.socket && log.socket.user && log.socket.user.id && !log.user) {
            log.user = log.socket.user;
          }

          if (log.user && log.user.id) {
            log.session = log.user.userSession;
            log.userName = log.user.username;
            log.userEmail = log.user.email;
            log.userAvatarMini = log.user.avatarMini;
            log.user = this.mongo.objectId(log.user.id);
          }
        },

        homeTilesLoader: function($socket, args, callback) {
          if (!$socket || !$socket.user) {
            return;
          }

          var _this = this,
              GroupModel = DependencyInjection.injector.model.get('GroupModel');

          if (!$socket.user.id) {
            GroupModel.unknownPermissions(function(permissions) {
              _this.homeDefaultTiles($socket, permissions.permissions, function(tiles) {
                callback(tiles);
              });
            });

            return;
          }
          else {
            this.fromSocket($socket, function(err, user) {
              if (err || !user) {
                return callback([]);
              }

              if (!user.homeTiles || !user.homeTiles.length) {
                _this.homeDefaultTiles($socket, user.permissions, function(tiles) {
                  user.homeTiles = tiles;

                  if (user.homeTiles.length) {
                    _this
                      .update({
                        id: user.id
                      }, {
                        homeTiles: user.homeTiles
                      })
                      .exec(function() {
                        callback(user.homeTiles);
                      });

                    return;
                  }

                  callback(user.homeTiles);
                });

                return;
              }

              callback(user.homeTiles);
            });
          }
        },

        homeDefaultTile: function(tileOFunc, permissions) {
          if (typeof tileOFunc == 'function') {
            _homeDefaultTiles.push(tileOFunc);
          }
          else {
            _homeDefaultTiles.push({
              tile: tileOFunc,
              permissions: permissions || null
            });
          }
        },

        homeDefaultTiles: function($socket, permissions, callback) {
          permissions = permissions || [];

          var tiles = [];

          async.eachSeries(_homeDefaultTiles, function(defaultTile, nextDefaultTile) {

            if (typeof defaultTile == 'function') {
              defaultTile($socket, function(returnedTiles) {
                if (returnedTiles && returnedTiles.length) {
                  tiles = tiles.concat(returnedTiles);
                }

                nextDefaultTile();
              });
            }
            else {
              if (defaultTile.permissions && defaultTile.permissions.length) {
                for (var i = 0; i < defaultTile.permissions.length; i++) {
                  if (permissions.indexOf(defaultTile.permissions[i]) < 0) {
                    return nextDefaultTile();
                  }
                }
              }

              tiles.push(defaultTile.tile);

              nextDefaultTile();
            }

          }, function() {
            callback(tiles);
          });
        },

        addHomeTile: function(tile, userId, callback) {
          callback = callback || function() { };

          var _this = this;

          this
            .findOne({
              id: userId
            })
            .exec(function(err, user) {
              if (err || !user) {
                return callback(err || 'no user');
              }

              var index = null,
                  homeTiles = user.homeTiles || [];

              for (var i = 0; i < homeTiles.length; i++) {
                if (homeTiles[i].url == tile.url) {
                  index = i;

                  break;
                }
              }

              if (index === null) {
                homeTiles.push({});
                index = homeTiles.length - 1;
              }

              homeTiles[index] = tile;

              homeTiles.sort(function(a, b) {
                return new Date(b.date) - new Date(a.date);
              });

              if (homeTiles.length > MAX_HOME_TILES) {
                homeTiles.splice(MAX_HOME_TILES, homeTiles.length - MAX_HOME_TILES);
              }

              _this
                .update({
                  id: user.id
                }, {
                  homeTiles: homeTiles
                })
                .exec(function() {
                  var $WebHomeService = DependencyInjection.injector.controller.get('$WebHomeService', true);

                  if ($WebHomeService) {
                    $WebHomeService.refreshTiles(userId);
                  }
                });
            });
        },

        searchConditions: function(conditions, query) {
          if (conditions.userName) {
            query.userName = {
              $regex: conditions.userName
                .split(';')
                .filter(function(value) {
                  return !!value.trim();
                })
                .join('|'),
              $options: 'i'
            };
          }

          if (conditions.user) {
            query.user = this.mongo.objectId(conditions.user);
          }

          if (conditions.session) {
            query.session = conditions.session;
          }
        },

        hasPermissions: function(user, permissions) {
          var hasPermissions = true;

          for (var i = 0; i < permissions.length; i++) {
            if (user.permissions.indexOf(permissions[i]) < 0) {
              hasPermissions = false;

              break;
            }
          }

          return hasPermissions;
        },

        hasPermission: function(user, permission) {
          return this.hasPermissions(user, [permission]);
        },

        names: function(callback) {
          this
            .find({}, {
              select: ['id', 'username']
            })
            .exec(callback);
        },

        changeAvatar: function(userId, avatar, callback) {
          var _this = this,
              user = {
                avatar: avatar
              };

          usersThumbsFactory(user, function() {
            var userAvatars = {
              avatar: avatar,
              avatarThumb: user.avatarThumb || null,
              avatarThumbVertical: user.avatarThumbVertical || null,
              avatarThumbSquare: user.avatarThumbSquare || null,
              avatarMini: user.avatarMini || null,
              avatarFavicon: user.avatarFavicon || null
            };

            _this
              .update({
                id: userId
              }, extend(true, {
                updatedAt: new Date()
              }, userAvatars))
              .exec(function(err, users) {
                if (err || !users.length) {
                  return callback(err || 'not found');
                }

                _this.refreshUser(users[0]);

                async.eachSeries(_changeAvatarMethods, function(method, nextMethod) {

                  method(users[0], nextMethod);

                }, function() {
                  callback(null, userAvatars);
                });
              });
          });
        },

        onChangeAvatar: function(method) {
          _changeAvatarMethods.push(method);
        },

        notifications: function(userId, callback) {
          var _this = this;

          this
            .findOne({
              id: userId
            })
            .exec(function(err, user) {
              if (err) {
                return callback(err);
              }

              if (!user) {
                return callback('User didn\'t exists');
              }

              var time = new Date().getTime(),
                  saveNeeded = false;

              user.notifications = user.notifications || [];

              if (user.notifications.length) {
                for (var i = user.notifications.length - 1; i >= 0; i--) {
                  if (
                    !user.notifications[i].locked &&
                    time - new Date(user.notifications[i].date).getTime() > MAX_NOTIFICATION_TIME * 1000
                  ) {
                    user.notifications.splice(i, 1);
                    saveNeeded = true;
                  }
                }
              }

              if (saveNeeded) {
                _this
                  .update({
                    id: user.id
                  }, {
                    notifications: user.notifications
                  })
                  .exec(function() {
                    callback(null, user.notifications);
                  });
              }

              callback(null, user.notifications);
            });
        },

        allNotificationsViewed: function($socket, userId, fromLast, callback) {
          var _this = this;

          this
            .findOne({
              id: userId
            })
            .exec(function(err, user) {
              if (err) {
                return callback ? callback(err) : null;
              }

              if (!user) {
                return callback ? callback('User didn\'t exists') : null;
              }

              user.notifications = user.notifications || [];

              var lastNotification = user.notifications[user.notifications.length - 1];

              user.notifications = user.notifications.map(function(notification, i) {
                if ((fromLast && user.notifications.length - 1 - fromLast === i) || !fromLast) {
                  notification.viewed = true;
                  notification.notified = true;
                }

                return notification;
              });

              _this
                .update({
                  id: user.id
                }, {
                  notifications: user.notifications
                })
                .exec(function() {
                  if (callback) {
                    callback(null, user.notifications);
                  }

                  $allonsy.log('allons-y-community', 'users:user-model:notifications-viewed', {
                    label: 'Read all its notifications',
                    fromLast: !!fromLast,
                    notification: lastNotification,
                    socket: $socket || null
                  });
                });
            });
        },

        lastNotificationUnnotified: function(userId, callback) {
          var _this = this;

          this
            .findOne({
              id: userId
            })
            .exec(function(err, user) {
              if (err) {
                return callback(err);
              }

              if (!user) {
                return callback('User didn\'t exists');
              }

              user.notifications = user.notifications || [];

              if (user.notifications.length) {
                var lastNotification = user.notifications[user.notifications.length - 1];

                if (!lastNotification.notified && !lastNotification.viewed) {
                  lastNotification.notified = true;

                  _this
                    .update({
                      id: user.id
                    }, {
                      notifications: user.notifications
                    })
                    .exec(function() {
                      callback(null, lastNotification);
                    });

                  return;
                }
              }

              callback(null, null);
            });
        },

        pushNotification: function($socket, usersId, notificationArgs, callback) {
          notificationArgs = extend(true, {
            message: '',
            content: '',
            picture: null,
            pushTitle: null,
            pushContent: null,
            pushPicture: null,
            eventName: null,
            eventArgs: null,
            locked: false,
            buttons: null
          }, notificationArgs || {});

          var _this = this,
              $SocketsService = DependencyInjection.injector.model.get('$SocketsService'),
              notificationId = notificationArgs && notificationArgs.id || uuid.v1(),
              notificationOrigin = {
                id: notificationId,
                date: new Date(),
                session: new Date().getTime(),
                message: notificationArgs.message,
                content: notificationArgs.content,
                picture: notificationArgs.picture,
                eventName: notificationArgs.eventName,
                eventArgs: notificationArgs.eventArgs,
                locked: notificationArgs.locked,
                buttons: notificationArgs.buttons
              };

          _this
            .find(usersId ? {
              id: usersId
            } : {})
            .exec(function(err, users) {

              var usersPushNotifications = [],
                  pushNotificationsCount = 0;

              async.mapSeries(users, function(user, nextUser) {

                var found = false,
                    notification = extend(true, {
                      viewed: false,
                      notified: true
                    }, notificationOrigin);

                for (var key in user) {
                  if (user.hasOwnProperty(key)) {
                    notification.message = notification.message.replace(new RegExp('\\{' + key + '\\}', 'gi'), user[key]);
                    notification.content = notification.content.replace(new RegExp('\\{' + key + '\\}', 'gi'), user[key]);
                    if (notification.pushTitle) {
                      notification.pushTitle = notification.pushTitle
                        .replace(new RegExp('\\{' + key + '\\}', 'gi'), user[key]);
                    }
                    if (notification.pushContent) {
                      notification.pushContent = notification.pushContent
                        .replace(new RegExp('\\{' + key + '\\}', 'gi'), user[key]);
                    }
                  }
                }

                if (notification.buttons && notification.buttons.length) {
                  notification.buttons.forEach(function(button) {
                    if (button.action && button.action.type && button.action.type == 'socket.event') {
                      button.action.eventArgs = button.action.eventArgs || {};
                      button.action.eventArgs.notificationId = notification.id;
                    }
                  });
                }

                var publicNotification = extend(true, {}, notification);

                delete publicNotification.session;

                $SocketsService.emit(null, {
                  'user.id': user.id
                }, function() {
                  found = true;
                }, 'read(users/notification)', {
                  notification: publicNotification
                });

                if (!found) {
                  notification.notified = false;
                }

                user.notifications = user.notifications || [];
                user.notifications.push(notification);

                _this
                  .update({
                    id: user.id
                  }, {
                    notifications: user.notifications
                  })
                  .exec(function() {
                    if (notificationArgs.pushTitle && user.notificationsPush && user.notificationsPush.length) {
                      var userActivity = false;

                      $SocketsService.each(function(socket) {
                        if (socket && socket.user && socket.user.id == user.id && socket.userActivity) {
                          userActivity = true;

                          return false;
                        }
                      });

                      if (!userActivity) {
                        var payload = {
                          id: notification.id,
                          user: user.id,
                          title: notification.pushTitle,
                          body: notification.pushContent,
                          icon: notification.pushPicture
                        };

                        if (
                          notificationArgs.eventName == 'url' ||
                          notificationArgs.eventName == 'url.internal' ||
                          notificationArgs.eventName == 'url.external'
                        ) {
                          payload.action = notificationArgs.eventArgs.url;
                        }

                        payload = JSON.stringify(payload);

                        if (webPush) {
                          usersPushNotifications.push(user.id);

                          user.notificationsPush.forEach(function(notificationPush) {
                            webPush.sendNotification(notificationPush.endpoint, {
                              TTL: 0,
                              userPublicKey: notificationPush.userPublicKey,
                              userAuth: notificationPush.userAuth,
                              payload: payload
                            });

                            pushNotificationsCount++;
                          });
                        }
                      }
                    }

                    nextUser();
                  });

              }, function() {
                if (usersPushNotifications.length) {
                  $allonsy.log('allons-y-community', 'users:user-send-push-notification', {
                    label: 'Send ' + pushNotificationsCount + ' Push notifications to ' + usersPushNotifications.length + ' members',
                    metric: {
                      key: 'communityUsersPushNotificationsPush',
                      name: 'Push notif',
                      description: 'Push remote notification directly to the device.',
                      value: pushNotificationsCount
                    },
                    pushNotificationsCount: pushNotificationsCount,
                    users: usersPushNotifications,
                    socket: $socket
                  });
                }

                if (callback) {
                  callback(null, notificationId);
                }

                var logArgs = extend(true, {
                  label: 'Push notification to ' + usersId.length + ' members',
                  users: usersId,
                  socket: $socket || null
                }, notificationOrigin);

                delete logArgs.date;

                $allonsy.log('allons-y-community', 'users:user-model:push-notification', logArgs);
              });
            });
        },

        notificationViewed: function(userId, notificationId, callback) {
          var _this = this;

          this
            .findOne({
              id: userId
            })
            .exec(function(err, user) {
              if (err) {
                return callback(err);
              }

              for (var i = user.notifications.length - 1; i >= 0; i--) {
                if (user.notifications[i].id && user.notifications[i].id == notificationId) {
                  user.notifications[i].viewed = true;
                  user.notifications[i].notified = true;

                  break;
                }
              }

              _this
                .update({
                  id: user.id
                }, {
                  notifications: user.notifications
                })
                .exec(function() {
                  callback(null);
                });
            });
        },

        searchByName: function(search, moreConditions, limit, callback) {
          if (!search || typeof search != 'string') {
            return callback(null, []);
          }

          limit = limit || 10;

          var conditions = {
            $match: {
              entityType: this.entityType,
              username: new RegExp('.*?' + search.replace(/ /g, '.*?') + '.*?', 'i')
            }
          };

          if (moreConditions) {
            extend(true, conditions.$match, moreConditions);
          }

          this.native(function(err, collection) {
            collection.aggregate([conditions, {
              $limit: limit
            }], callback);
          });
        },

        callUser: function($socket, eventName, args, callback) {
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
            .exec(function(err, user) {
              if (err || !user) {
                if ($socket) {
                  $RealTimeService.fire(eventName, {
                    error: 'not found'
                  }, $socket);
                }

                if (callback) {
                  callback();
                }

                return;
              }

              $RealTimeService.fire(eventName, {
                user: user.publicData({
                  avatarFavicon: user.avatarFavicon
                })
              }, $socket || null);

              if (callback) {
                callback();
              }
            });
        },

        callUsersGroupType: function(eventOrigin, permissionToCheck, filterMembers, $socket, eventName, args, callback) {
          if (!args || args.length < 1) {
            if (callback) {
              callback();
            }

            return;
          }

          var GroupModel = DependencyInjection.injector.model.get('GroupModel'),
              eventNamesCount = $RealTimeService.eventNamesFromCount(eventOrigin, 1, $socket, [args[0]]);

          if (eventNamesCount === false) {
            return;
          }

          GroupModel
            .findOne({
              id: args[0]
            })
            .exec(function(err, group) {
              if (err || !group) {
                if ($socket) {
                  $RealTimeService.fire(eventName, {
                    error: 'not found'
                  }, $socket);
                }

                if (callback) {
                  callback();
                }

                return;
              }

              var members = (filterMembers(group) || [])
                .sort(function(a, b) {
                  return new Date(b.addedAt) - new Date(a.addedAt);
                });

              if ($socket) {
                if (
                  (!$socket.user.isMembersLeader || permissionToCheck != 'groups-see-leaders') &&
                  !$socket.user.hasPermission(permissionToCheck + ':' + group.id)
                ) {
                  $RealTimeService.fire(eventName, {
                    error: 'not found'
                  }, $socket);

                  if (callback) {
                    callback();
                  }

                  return;
                }

                $RealTimeService.fire(eventName, {
                  total: members.length,
                  users: args[1] != 'all' && args[1] < members.length ? members.slice(0, args[1]) : members
                }, $socket);
              }
              else {
                Object.keys(eventNamesCount.eventNames).forEach(function(eventName) {
                  var event = eventNamesCount.eventNames[eventName];

                  event.sockets.forEach(function(socket) {
                    if (!socket.user || !socket.user.id ||
                      (
                        (!socket.user.isMembersLeader || permissionToCheck != 'groups-see-leaders') &&
                        !socket.user.hasPermission(permissionToCheck + ':' + group.id)
                      )
                    ) {
                      return;
                    }

                    $RealTimeService.fire(eventName, {
                      total: members.length,
                      users: !eventNamesCount.eventNames[eventName].count ?
                        members :
                        members.slice(0, eventNamesCount.eventNames[eventName].count)
                    }, socket);
                  });
                });
              }

              if (callback) {
                callback();
              }
            });
        },

        refreshUsersGroupLeaders: function(groupId, callback) {
          this.callUsersGroupLeaders(null, null, [groupId], callback);
        },

        callUsersGroupLeaders: function($socket, eventName, args, callback) {
          this.callUsersGroupType('users-groupleaders', 'groups-see-leaders', function(group) {
            return group.members.filter(function(member) {
              return !!member.isLeader;
            });
          }, $socket, eventName, args, callback);
        },

        refreshUsersGroupMembers: function(groupId, callback) {
          this.callUsersGroupMembers(null, null, [groupId], callback);
        },

        callUsersGroupMembers: function($socket, eventName, args, callback) {
          this.callUsersGroupType('users-groupmembers', 'groups-see-members', function(group) {
            return group.members.filter(function(member) {
              return !member.isLeader;
            });
          }, $socket, eventName, args, callback);
        },

        refreshUsersGroupInvitations: function(groupId, callback) {
          this.callUsersGroupInvitations(null, null, [groupId], callback);
        },

        callUsersGroupInvitations: function($socket, eventName, args, callback) {
          this.callUsersGroupType('users-groupinvitations', 'groups-leader', function(group) {
            return group.invitations;
          }, $socket, eventName, args, callback);
        },

        refreshUser: function(user, args, socket) {
          var data = extend(true, {
            user: user.ownPublicData()
          }, args || {});

          [user.id, user.url].forEach(function(id) {
            $RealTimeService.fire('users-user:' + id, data, socket || null);
          });
        },

        fromSocket: function($socket, callback) {
          if (!$socket || !$socket.user || !$socket.user.id) {
            return callback(null, null);
          }

          this
            .findOne({
              id: $socket.user.id
            })
            .exec(callback);
        },

        searchPublicData: function(user, $socket, regex) {
          var user = this.publicData(user);

          user.username = user.username.replace(regex, '<strong>$1</strong>');

          return user;
        },

        publicData: function(user, moreData, remove) {
          user = {
            id: user.id || user._id,
            url: user.url,
            email: user.email,
            firstname: user.firstname,
            lastname: user.lastname,
            username: user.username,
            avatar: user.avatar,
            avatarThumb: user.avatarThumb,
            avatarThumbVertical: user.avatarThumbVertical,
            avatarThumbSquare: user.avatarThumbSquare,
            avatarMini: user.avatarMini
          };

          if (moreData) {
            extend(true, user, moreData);
          }

          if (remove) {
            remove.forEach(function(removeKey) {
              delete user[removeKey];
            });
          }

          return user;
        },

        ownPublicData: function(user, moreData, remove) {
          moreData = moreData || {};

          moreData.permissionsPublic = user.permissionsPublic;

          return user.id ? user.publicData(moreData, remove) : user;
        },

        unknownUser: function(callback) {
          var _this = this,
              GroupModel = DependencyInjection.injector.model.get('GroupModel');

          GroupModel.unknownPermissions(function(permissions) {
            var user = {
              id: null,
              permissions: permissions.permissions,
              permissionsPublic: permissions.permissionsPublic,
              hasPermissions: function(permissions) {
                return _this.hasPermissions(user, permissions);
              },
              hasPermission: function(permission) {
                return _this.hasPermission(user, permission);
              }
            };

            callback(user);
          });
        },

        firstConnection: function(socket) {
          var _this = this;

          setTimeout(function() {
            _this.pushNotification(socket, socket.user.id, {
              message: $i18nService._('Hey <strong>{firstname}</strong>, look at this!'),
              content: $i18nService._('This is your notifications center. Toggling the <strong>push notifications</strong> switch above will make sure you receive notifications on your device even when not using the platform.'),
              picture: '/public/users/users-notification.png',
              pushTitle: $i18nService._('Hey {firstname}, look at this!') + ' - ' + process.env.BRAND,
              pushContent: $i18nService._('Go to your notifications center!'),
              pushPicture: '/public/users/users-notification.png',
              eventName: 'url',
              eventArgs: {
                url: '/members'
              }
            });
          }, 45000);
        },

        checkAvatar: function(socket) {
          var _this = this,
              avatarReminder = socket.user.avatarReminder || null,

              // 3days
              createdRecently = new Date().getTime() - socket.user.createdAt.getTime() < 3 * 24 * 3600 * 1000;

          if (avatarReminder) {
            // 8 days
            avatarReminder = new Date().getTime() - avatarReminder.getTime() < 8 * 24 * 3600 * 1000;
          }

          if (socket.user.avatar || createdRecently || avatarReminder) {
            return;
          }

          this
            .update({
              id: socket.user.id
            }, {
              avatarReminder: new Date()
            })
            .exec(function() {
              $allonsy.log('allons-y-community', 'users:user-avatar-reminder', {
                label: 'Gets the avatar reminder notification',
                metric: {
                  key: 'communityUsersAvatarReminder',
                  name: 'Avatar reminder',
                  description: 'Send a member notification for asking to set an avatar.'
                },
                socket: socket
              });

              setTimeout(function() {
                _this.pushNotification(socket, socket.user.id, {
                  message: $i18nService._('Hey <strong>{firstname}</strong>, let\'s show your flair!'),
                  content: $i18nService._('Dear <strong>{firstname}</strong>, we all want to see more of you. What about creating your avatar? Just click on the camera icon on the right of your name and upload a nice picture. Else, we\'ll kill the kitty. Sincerly.'),
                  picture: '/public/users/kitty.gif',
                  pushTitle: $i18nService._('Hey {firstname}, let\'s show your flair!') + ' - ' + process.env.BRAND,
                  pushContent: $i18nService._('What about creating your avatar?'),
                  pushPicture: '/public/users/kitty.gif',
                  eventName: 'url',
                  eventArgs: {
                    url: '/members'
                  }
                });
              }, 60000);
            });
        },

        validatePassword: function(password, user) {
          if (password.length < 8 || !password.match(/(\d)/) || !password.match(/(\w)/)) {
            return false;
          }

          return !password.match(new RegExp('(' + user.firstname + '|' + user.lastname + ')', 'gi'));
        },

        formatUsername: function(user) {
          ['firstname', 'lastname'].forEach(function(type) {
            user[type] = user[type]
              .trim()
              .toLowerCase()
              .replace(/\b\w/g, function(letter) {
                return letter.toUpperCase();
              });
          });

          user.username = (
            (user.firstname || '') +
            (user.firstname && user.lastname ? ' ' : '') +
            (user.lastname || '')
          ).trim();

          return user;
        },

        sessionDuration: function() {
          return (process.env.SESSION_DURATION_DAYS || 2) * 24 * 3600 * 1000;
        },

        sessionDurationDate: function() {
          return new Date(new Date().getTime() + this.sessionDuration());
        },

        newSession: function() {
          return {
            session: uuid.v4(),
            sessionEndAt: this.sessionDurationDate()
          };
        },

        forgotCodeDuration: function() {
          return new Date(new Date() - FORGOT_CODE_DURATION);
        },

        cryptPassword: function(password, callback) {
          bcrypt.genSalt(10, function(err, salt) {
            if (err) {
              return callback(err);
            }

            bcrypt.hash(password, salt, function(err, hash) {
              callback(err, hash);
            });
          });
        },

        cleanSessions: function(user, callback) {
          var _this = this,
              cleanSessions = false;

          user.sessions = user.sessions || [];

          for (var i = user.sessions.length - 1; i >= 0; i--) {
            if (new Date() - new Date(user.sessions[i].sessionEndAt) > 0) {
              user.sessions.splice(i, 1);

              cleanSessions = true;
            }
          }

          if (cleanSessions) {
            _this
              .update({
                id: user.id
              }, {
                sessions: user.sessions
              })
              .exec(function() {
                callback(user);
              });

            return;
          }

          callback(user);
        },

        fromSession: function(session, callback) {
          if (!session) {
            this.unknownUser(function(user) {
              callback(user, null);
            });

            return;
          }

          var _this = this,
              GroupModel = DependencyInjection.injector.model.get('GroupModel');

          this
            .findOne({
              'sessions.session': session
            })
            .exec(function(err, user) {
              if (err || !user) {
                return _this.unknownUser(function(user) {
                  callback(user, null);
                });
              }

              _this.cleanSessions(user, function(user) {

                GroupModel.isDeactivated(user, function(isDeactivated) {
                  if (isDeactivated) {
                    return _this.unknownUser(function(user) {
                      callback(user, null);
                    });
                  }

                  var activeSession = null;

                  for (var i = 0; i < user.sessions.length; i++) {
                    if (user.sessions[i].session == session) {
                      activeSession = user.sessions[i];
                      activeSession.sessionEndAt = _this.sessionDurationDate();

                      break;
                    }
                  }

                  if (!activeSession) {
                    return _this.unknownUser(function(user) {
                      callback(user, null);
                    });
                  }

                  _this
                    .update({
                      id: user.id
                    }, {
                      sessions: user.sessions
                    })
                    .exec(function() {
                      activeSession.duration = _this.sessionDuration();

                      callback(user, activeSession);
                    });
                });
              });
            });
        },

        createSocketSession: function(token, callback) {
          var tokenUnsigned = cookieParser.signedCookie(token, process.env.EXPRESS_COOKIE_SECRET);

          callback(tokenUnsigned ? {
            session: tokenUnsigned,
            duration: this.sessionDuration()
          } : null);
        },

        signin: function(email, password, callback, force) {
          var _this = this,
              GroupModel = DependencyInjection.injector.model.get('GroupModel');

          email = email.toLowerCase();

          GroupModel.unknownPermissions(function(permissions) {
            if (permissions.permissions.indexOf('members-signin') < 0) {
              return callback('signinpermission');
            }

            _this
              .findOne({
                email: email
              })
              .exec(function(err, user) {
                if (err || !user || (!force && (!user.password || !bcrypt.compareSync(password, user.password)))) {
                  return callback(err || 'credentials');
                }

                _this.cleanSessions(user, function(user) {

                  GroupModel.isDeactivated(user, function(isDeactivated) {
                    if (isDeactivated) {
                      return callback('deactivated');
                    }

                    var session = _this.newSession();

                    user.sessions = user.sessions || [];
                    user.sessions.push(session);

                    _this
                      .update({
                        id: user.id
                      }, {
                        sessions: user.sessions
                      })
                      .exec(function() {
                        session.duration = _this.sessionDuration();

                        $allonsy.log('allons-y-community', 'users:signin:' + user.email + ':' + session.session, {
                          label: 'Signin',
                          user: user
                        });

                        callback(null, user, session);
                      });
                  });
                });
              });
          });
        },

        signout: function(session, callback) {
          if (!session) {
            return callback(null);
          }

          var _this = this;

          this
            .findOne({
              'sessions.session': session
            })
            .exec(function(err, user) {
              if (err || !user) {
                return callback(err || null);
              }

              var sessionRemoved = false;

              user.sessions = user.sessions || [];

              for (var i = user.sessions.length - 1; i >= 0; i--) {
                if (user.sessions[i].session == session) {
                  user.sessions.splice(i, 1);

                  sessionRemoved = true;
                }
              }

              if (sessionRemoved) {
                _this
                  .update({
                    id: user.id
                  }, {
                    sessions: user.sessions
                  })
                  .exec(function() {
                    $allonsy.log('allons-y-community', 'users:signout:' + user.email + ':' + session, {
                      label: 'Signout',
                      user: user
                    });

                    callback(null);
                  });

                return;
              }

              callback(null);
            });
        },

        cleanSignupCodes: function() {
          var date = new Date().getTime();

          Object.keys(_signupCodes).forEach(function(email) {
            if (date - _signupCodes[email].createdAt.getTime() > FORGOT_CODE_DURATION) {
              delete _signupCodes[email];
            }
          });
        },

        createUser: function(args, callback, force) {
          var _this = this,
              GroupModel = DependencyInjection.injector.model.get('GroupModel'),
              session = this.newSession();

          _this.cleanSignupCodes();

          GroupModel.unknownPermissions(function(permissions) {
            if (permissions.permissions.indexOf('members-signup') < 0) {
              return callback('signuppermission');
            }

            args.email = args.email.toLowerCase();

            _this
              .findOne({
                email: args.email
              })
              .exec(function(err, user) {
                if (user) {
                  return callback('exists');
                }

                if (!force && args.code) {
                  if (!_signupCodes[args.email] || _signupCodes[args.email].code != args.code) {
                    return callback('bad code');
                  }
                }
                else if (!force) {
                  var code = Math.floor(Math.random() * 1000000).toString();

                  while (code.length < 6) {
                    code = '0' + code;
                  }

                  _signupCodes[args.email] = {
                    code: code,
                    createdAt: new Date()
                  };

                  var $MailModel = DependencyInjection.injector.model.get('$MailModel');

                  new $MailModel()
                    .to(args.email)
                    .template('default')
                    .subject('Your validation code')
                    .data({
                      context: process.env.WEB_BRAND + ' > SIGNUP',
                      title: 'WELCOME',
                      subtitle: 'Hello new member!',
                      content: [
                        '<p>Hello we have received your request to create a member account for ', process.env.EXPRESS_URL, '.</p>',
                        '<p>Please use the following code to validate this request: <strong>' + code + '</strong></p>'
                      ].join('')
                    })
                    .send();

                  return callback('code sent');
                }

                delete _signupCodes[args.email];

                _this.cryptPassword(args.password, function(err, passwordHash) {
                  if (!force && err) {
                    return callback(err);
                  }

                  _this.formatUsername(args);

                  _this
                    .create({
                      firstname: args.firstname,
                      lastname: args.lastname,
                      username: args.username,
                      email: args.email,
                      password: force ? null : passwordHash,
                      sessions: [session],
                      createdAt: new Date(),
                      updatedAt: new Date()
                    })
                    .exec(function(err, user) {
                      if (err) {
                        return callback(err);
                      }

                      user.search1 = user.username;

                      user.createUrl(false, function(err) {
                        if (err) {
                          return callback(err);
                        }

                        _this
                          .update({
                            id: user.id
                          }, {
                            search1: user.search1,
                            url: user.url
                          })
                          .exec(function(err) {
                            if (err) {
                              return callback(err);
                            }

                            $allonsy.log('allons-y-community', 'users:create', {
                              label: 'Register new member',
                              metric: {
                                key: 'communityUsersCreate',
                                name: 'New member',
                                description: 'New member account created in the database.'
                              },
                              user: user
                            });

                            var GroupModel = DependencyInjection.injector.service.get('GroupModel'),
                                addFunc = 'addMember';

                            GroupModel
                              .findOne({
                                special: 'members'
                              })
                              .exec(function(err, group) {
                                if (err || !group) {
                                  return callback(err || 'no members group found');
                                }

                                async.waterfall([function(next) {
                                  if (!args.membersLeader) {
                                    return next();
                                  }

                                  GroupModel.membersHasLeaderfunction(function(value) {
                                    if (!value) {
                                      addFunc = 'addLeader';
                                    }

                                    next();
                                  });
                                }, function(next) {

                                  group[addFunc](user, true, function() {
                                    GroupModel.refreshGroup(group);

                                    _this.refreshUsersGroupMembers(group.id);

                                    session.duration = _this.sessionDuration();

                                    if (addFunc == 'addMember') {
                                      return next();
                                    }

                                    async.mapSeries(GroupModel.SPECIALS, function(specialData, nextGroup) {
                                      if (specialData.special == 'members') {
                                        return nextGroup();
                                      }

                                      GroupModel
                                        .findOne({
                                          special: specialData.special
                                        })
                                        .exec(function(err, group) {
                                          if (err || !group) {
                                            return nextGroup();
                                          }

                                          group.addLeader(user, true, function() {
                                            GroupModel.refreshGroup(group);

                                            _this.refreshUsersGroupMembers(group.id);

                                            nextGroup();
                                          });
                                        });

                                    }, next);
                                  });
                                }], function() {
                                  _this
                                    .findOne({
                                      id: user.id
                                    })
                                    .exec(function(err, user) {
                                      callback(null, user, session);
                                    });
                                });
                              });

                          });
                      });

                    });
                });
              });
          });
        },

        forgot: function(email, callback) {
          var _this = this,
              GroupModel = DependencyInjection.injector.model.get('GroupModel');

          email = email.toLowerCase();

          GroupModel.unknownPermissions(function(permissions) {
            if (permissions.permissions.indexOf('members-signin') < 0) {
              return callback('forgotpermission');
            }

            _this
              .findOne({
                email: email
              })
              .exec(function(err, user) {
                if (err || !user) {
                  return callback(err || 'noexists');
                }

                GroupModel.isDeactivated(user, function(isDeactivated) {
                  if (isDeactivated) {
                    return callback('deactivated');
                  }

                  var code = Math.floor(Math.random() * 1000000).toString();

                  while (code.length < 6) {
                    code = '0' + code;
                  }

                  user.forgotCode = code;
                  user.forgotCodeCreatedAt = new Date();

                  _this
                    .update({
                      id: user.id
                    }, {
                      forgotCode: user.forgotCode,
                      forgotCodeCreatedAt: user.forgotCodeCreatedAt
                    })
                    .exec(function() {
                      callback(null, email);

                      var $MailModel = DependencyInjection.injector.model.get('$MailModel');

                      new $MailModel()
                        .to(user.email)
                        .template('default')
                        .subject('Your validation code')
                        .data({
                          context: process.env.WEB_BRAND + ' > SIGNIN',
                          title: 'SECURITY',
                          subtitle: 'You have lost your password.',
                          content: [
                            '<p>Hello we have received a request to reset your password for ', process.env.EXPRESS_URL, '.</p>',
                            '<p>Please use the following code to validate this request: <strong>' + code + '</strong></p>'
                          ].join('')
                        })
                        .send();
                    });
                });
              });
          });
        },

        forgotCode: function(email, code, callback) {
          var _this = this,
              GroupModel = DependencyInjection.injector.model.get('GroupModel');

          email = email.toLowerCase();

          GroupModel.unknownPermissions(function(permissions) {
            if (permissions.permissions.indexOf('members-signin') < 0) {
              return callback('forgotpermission');
            }

            _this
              .findOne({
                email: email,
                forgotCode: code,
                forgotCodeCreatedAt: {
                  '>=': _this.forgotCodeDuration()
                }
              })
              .exec(function(err, user) {
                if (err || !user) {
                  return callback(err || 'noexists');
                }

                callback(null, email, code);
              });
          });
        },

        forgotPassword: function(email, code, password, callback) {
          var _this = this,
              GroupModel = DependencyInjection.injector.model.get('GroupModel');

          email = email.toLowerCase();

          GroupModel.unknownPermissions(function(permissions) {
            if (permissions.permissions.indexOf('members-signin') < 0) {
              return callback('forgotpermission');
            }

            _this
              .findOne({
                email: email,
                forgotCode: code,
                forgotCodeCreatedAt: {
                  '>=': _this.forgotCodeDuration()
                }
              })
              .exec(function(err, user) {
                if (err || !user) {
                  return callback(err || 'noexists');
                }

                if (!_this.validatePassword(password, user)) {
                  return callback('password');
                }

                _this.cryptPassword(password, function(err, hash) {
                  if (err) {
                    return callback(err);
                  }

                  user.forgotCode = null;
                  user.forgotCodeCreatedAt = null;
                  user.password = hash;

                  _this
                    .update({
                      id: user.id
                    }, {
                      forgotCode: user.forgotCode,
                      forgotCodeCreatedAt: user.forgotCodeCreatedAt,
                      password: user.password
                    })
                    .exec(function() {
                      callback(null);
                    });
                });
              });
          });
        },

        searchAvatar: function(email, callback) {
          var $WebService = DependencyInjection.injector.model.get('$WebService');

          email = email.toLowerCase();

          if (!$WebService.validateEmail(email)) {
            return callback(null, null);
          }

          this
            .findOne({
              email: email
            })
            .exec(function(err, user) {
              if (err || !user) {
                return callback(err || null, null);
              }

              var GroupModel = DependencyInjection.injector.model.get('GroupModel');

              GroupModel.isDeactivated(user, function(isDeactivated) {

                if (isDeactivated) {
                  return callback(null, null);
                }

                callback(null, {
                  avatar: user.avatar,
                  avatarThumb: user.avatarThumb,
                  avatarThumbVertical: user.avatarThumbVertical,
                  avatarThumbSquare: user.avatarThumbSquare,
                  avatarMini: user.avatarMini
                });
              });
            });
        },

        connectedMembers: function(userId, remove) {
          if (!_connectedMembers[userId] && remove) {
            return;
          }

          var toUpdate = !_connectedMembers[userId];

          _connectedMembers[userId] = _connectedMembers[userId] || 0;
          _connectedMembers[userId] += remove ? -1 : 1;

          if (!_connectedMembers[userId]) {
            _connectedMembers.total--;
            toUpdate = true;

            delete _connectedMembers[userId];
          }
          else if (toUpdate) {
            _connectedMembers.total++;
          }

          if (!toUpdate) {
            return;
          }

          var $WebHomeService = DependencyInjection.injector.controller.get('$WebHomeService', true);

          if (!$WebHomeService) {
            return;
          }

          $WebHomeService.metric('connectedMembers', _connectedMembers.total);
        },

        createAndSignin: function(req, res, user, callback) {
          if (!user || !user.email) {
            return callback('no email');
          }

          var _this = this;

          this
            .findOne({
              email: user.email
            })
            .exec(function(err, userFound) {
              if (userFound) {
                return _this.signin(user.email, null, callback, true);
              }

              _this.createUser({
                email: user.email,
                firstname: user.firstname,
                lastname: user.lastname
              }, function() {
                _this.signin(user.email, null, callback, true);
              }, true);
            });
        }
      };

    });

  });

  return 'UserModel';
};
