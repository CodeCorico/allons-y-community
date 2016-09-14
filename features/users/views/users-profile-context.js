(function() {
  'use strict';

  window.Ractive.controllerInjection('users-profile-context', [
    '$Page', '$BodyDataService', '$i18nService', '$NotificationsService', '$RealTimeService',
    '$socket', '$component', '$data', '$done',
  function usersProfileContext(
    $Page, $BodyDataService, $i18nService, $NotificationsService, $RealTimeService,
    $socket, $component, $data, $done
  ) {
    require('/public/vendor/dropzone.css')
      .then(function() {
        return require('/public/vendor/dropzone.js');
      }).then(function() {

        window.Dropzone.autoDiscover = false;

        var _user = $BodyDataService.data('user') || null,
            _web = $BodyDataService.data('web') || null,
            _notificationsPanel = null,
            UsersProfileContext = $component({
              data: $.extend(true, {
                displayAvatar: $Page.get('avatar'),
                user: _user,
                avatarThumb: $Page.get('avatar')(_user.avatarThumb || null),
                changeAvatarOpened: false,
                pushnotificationson: false,
                pushNotificationsEnabled: _web.pushNotifications && $NotificationsService.isPushNotificationsSupported(),
                allNotificationsRead: true,

                openItem: function(event) {
                  var args = event.context.args,
                      index = event.keypath.split('.').pop();

                  $NotificationsService.actionNotification(index, args);
                },

                buttonAction: function(action) {
                  $NotificationsService.buttonAction(action);
                },

                pushnotificationstoggle: function(event, isOn) {
                  event.original.stopPropagation();

                  if (isOn) {
                    $NotificationsService.subscribePushNotifications();
                  }
                  else {
                    $NotificationsService.unsubscribePushNotifications();
                  }
                }
              }, $data)
            }),
            _dropzone = new window.Dropzone(
              $(UsersProfileContext.el).find('.users-profile-context-avatar-upload .dropzone')[0],
              {
                url: '/api/media',
                previewTemplate: [
                  '<div class="dz-preview dz-file-preview">',
                    '<div class="dz-image"><img data-dz-thumbnail /></div>',
                    '<div class="dz-progress"><span class="dz-upload" data-dz-uploadprogress></span></div>',
                    '<div class="dz-error-message"><span data-dz-errormessage></span></div>',
                    '<div class="dz-success-mark">✔</div>',
                    '<div class="dz-error-mark">✘</div>',
                  '</div>'
                ].join(''),
                parallelUploads: 2,
                thumbnailHeight: 120,
                thumbnailWidth: 120,
                maxFilesize: 3,
                filesizeBase: 1000,
                maxFiles: 1
              }
            );

        $RealTimeService.realtimeComponent('usersProfileContext', {
          name: 'users-user:' + _user.id,
          update: function(event, args) {
            if (!args || !args.user) {
              return;
            }

            _user = args.user;

            if (UsersProfileContext) {
              UsersProfileContext.set('user', args.user);
            }
          }
        });

        function _beforeGroup(context, $group, userBehavior, callback) {
          if ($group && $group.attr('data-group') != 'group-users-profile') {
            if (callback) {
              callback();
            }

            return;
          }

          $NotificationsService.fetchNotifications();

          if (callback) {
            callback();
          }
        }

        UsersProfileContext.on('signout', function() {
          $.post('/api/users/signout', {}, function() {
            if (!UsersProfileContext) {
              return;
            }

            UsersProfileContext.set('hide', true);

            setTimeout(function() {
              if (!UsersProfileContext) {
                return;
              }

              UsersProfileContext.require('pl-messages-message').then(function() {
                var Message = UsersProfileContext.findChild('name', 'pl-messages-message');

                Message.fire('reset');

                setTimeout(function() {
                  if (!Message) {
                    return;
                  }

                  Message.fire('play', {
                    message: $i18nService._('Bye bye <strong>' + _user.firstname + '</strong>'),
                    callback: function() {
                      location.reload();
                    },
                    displayWordTime: 250,
                    displayTextTime: 1500,
                    freezeLastLine: true
                  });
                }, 500);
              });
            }, 350);
          });
        });

        UsersProfileContext.on('toggleChangeAvatar', function() {
          var changeAvatarOpened = UsersProfileContext.get('changeAvatarOpened');

          changeAvatarOpened = !changeAvatarOpened;

          if (!changeAvatarOpened) {
            _dropzone.removeAllFiles();
          }

          UsersProfileContext.set('changeAvatarOpened', changeAvatarOpened);
        });

        _dropzone.on('success', function(file, res) {
          if (file && res && res.url) {
            setTimeout(function() {
              $socket.emit('update(users/user.avatar)', {
                avatar: res.url
              });

              UsersProfileContext.set('changeAvatarOpened', false);
              _dropzone.removeAllFiles();
            }, 2000);
          }
        });

        UsersProfileContext.on('teardown', function() {
          UsersProfileContext = null;
          $NotificationsService.offNamespace('usersProfileContext');
        });

        UsersProfileContext.on('close', function() {
          UsersProfileContext.parentRequire.close();
        });

        UsersProfileContext.on('markNotificationsRead', function() {
          $NotificationsService.clearNotificationsCount();
        });

        $NotificationsService.onSafe('usersProfileContext.pushNotification', function(args) {
          if (!args || !args.notification) {
            return;
          }

          var notif = args.notification;

          UsersProfileContext.set('allNotificationsRead', false);

          _notificationsPanel.pushNotification(notif.content, notif.time, notif.picture, notif.buttons || null, notif.args);
        });

        $NotificationsService.onSafe('usersProfileContext.notificationsChanged', function(args) {
          if (!args || !args.notifications) {
            return;
          }

          var notifications = $.extend(true, [], args.notifications),
              allNotificationsRead = true;

          for (var i = 0; i < notifications.length; i++) {
            if (!notifications[i].viewed) {
              allNotificationsRead = false;
            }
            else if (notifications[i].viewed && notifications[i].locked) {
              notifications[i].viewed = false;
            }
          }

          UsersProfileContext.set('allNotificationsRead', allNotificationsRead);

          _notificationsPanel.set('notifications', notifications);
        });

        $NotificationsService.onSafe('usersProfileContext.hasPushNotificationsSubscription', function(args) {
          UsersProfileContext.set('pushnotificationson', args.hasSubscription);
        });

        UsersProfileContext.parentRequire.on('beforeGroup', _beforeGroup);

        UsersProfileContext.require().then(function() {
          _notificationsPanel = UsersProfileContext.findChild('name', 'pl-notifications-panel');

          _beforeGroup();

          $NotificationsService.checkPushNotificationsSubscription();

          $done();
        });

      });

  }]);

})();
