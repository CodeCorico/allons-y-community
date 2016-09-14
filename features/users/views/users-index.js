(function() {
  'use strict';

  window.bootstrap([
    '$Page', '$BodyDataService', '$i18nService', '$socket',
    '$RealTimeService', '$NotificationsService', '$ShortcutsService', '$done',
  function(
    $Page, $BodyDataService, $i18nService, $socket,
    $RealTimeService, $NotificationsService, $ShortcutsService, $done
  ) {

    var user = $BodyDataService.data('user'),
        defaultAvatar = '/public/users/avatar.png',
        userProfileButton = null,
        notificationsUnviewedCount = 0,
        userActivity = null,
        documentHidden = 'hidden',
        _$el = {
          window: $(window)
        };

    $Page.set('defaultAvatar', defaultAvatar);
    $Page.set('avatar', function(avatar) {
      return avatar || defaultAvatar;
    });

    $socket.on('disconnect', function(message) {
      if (message == 'io server disconnect') {
        window.location.reload();
      }
    });

    $socket.on('reconnect', function() {
      $socket.once('read(users/activeuser.signed)', function() {
        $socket.emit('update(route)', {
          init: false,
          path: location.pathname,
          hash: location.hash,
          params: null,
          screenWidth: _$el.window.width(),
          screenHeight: _$el.window.height()
        });

        var events = $socket.listeners('reconnectSigned');

        if (events && events.length) {
          events.forEach(function(event) {
            event();
          });
        }
      });
    });

    function visibilityChange(evt) {
      // jshint validthis:true

      evt = evt || window.event;

      var evtMap = {
        focus: true,
        focusin: true,
        pageshow: true,
        blur: false,
        focusout: false,
        pagehide: false
      };

      var oldUserActivity = userActivity;

      if (evt.type in evtMap) {
        userActivity = evtMap[evt.type];
      }
      else {
        userActivity = !this[documentHidden];
      }

      if (oldUserActivity != userActivity) {
        $socket.emit('update(users/user.activity)', {
          activity: userActivity
        });
      }
    }

    function userActivityWatcher() {
      if (documentHidden in document) {
        document.addEventListener('visibilitychange', visibilityChange);
      }
      else if ((documentHidden = 'mozHidden') in document) {
        document.addEventListener('mozvisibilitychange', visibilityChange);
      }
      else if ((documentHidden = 'webkitHidden') in document) {
        document.addEventListener('webkitvisibilitychange', visibilityChange);
      }
      else if ((documentHidden = 'msHidden') in document) {
        document.addEventListener('msvisibilitychange', visibilityChange);
      }
      else if ('onfocusin' in document) {
        document.onfocusin = document.onfocusout = visibilityChange;
      }
      else {
        window.onpageshow = window.onpagehide = window.onfocus = window.onblur = visibilityChange;
      }

      if (typeof document[documentHidden] != 'undefined') {
        visibilityChange({
          type: document[documentHidden] ? 'blur' : 'focus'
        });
      }
    }

    if (user.id) {
      $Page.rightButtonAdd('usersProfile', {
        type: 'indicator',
        image: $Page.get('avatar')(user.avatarMini || null),
        group: 'group-users-profile',
        cls: 'talentforcepedia-users-profile-button',
        ready: function(button) {
          userProfileButton = button;

          if (notificationsUnviewedCount) {
            userProfileButton.set('notificationsCount', notificationsUnviewedCount);
          }
        },
        action: function() {
          // var $Layout = DependencyInjection.injector.view.get('$Layout');

          // if ($($Layout.rightContext().el).find('.pl-group.opened').attr('data-group') != 'group-users-profile') {
          //   _updateWinChart('openProfile');
          // }
        },
        beforeGroup: function(context, $group, userBehavior, callback) {
          context.require('users-profile-context').then(callback);
        }
      });

      $RealTimeService.realtimeComponent('usersPage', {
        name: 'users-user:' + user.id,
        update: function(event, args) {
          if (!args || !args.user) {
            return;
          }

          user = args.user;

          if (userProfileButton) {
            userProfileButton.set('image', $Page.get('avatar')(args.user.avatarMini));
          }
        },
        network: function(on) {
          if (!userProfileButton) {
            return;
          }

          $(userProfileButton.el).find('button')[!on ? 'addClass' : 'removeClass']('offline');
        }
      });
    }
    else if (user.permissionsPublic.indexOf('members-signin') > -1) {
      $Page.rightButtonAdd('usersProfile', {
        type: 'indicator',
        image: $Page.get('avatar')(null),
        group: 'group-users-sign',
        cls: 'talentforcepedia-users-profile-button',
        ready: function(button) {
          userProfileButton = button;

          button.action(false);
        },
        beforeGroup: function(context, $group, userBehavior, callback) {
          context.require('users-sign-context').then(callback);
        }
      });
    }

    $Page.on('openProfile', function() {
      userProfileButton.action();
    });

    $NotificationsService.onSafe('page.pushNotification', function(args) {
      if (!args || !args.notification) {
        return;
      }

      var notif = args.notification;

      userProfileButton.pushNotification(notif.message, notif.picture, notif.args);
    });

    $NotificationsService.onSafe('page.notificationsChanged', function(args) {
      if (!userProfileButton) {
        notificationsUnviewedCount = args.unviewedCount;

        return;
      }
      userProfileButton.set('notificationsCount', args.unviewedCount);
    });

    $NotificationsService.onSafe('page.actionNotification', function(args) {
      // _updateWinChart('clickOnNotification');

      if (args.eventName == 'url') {
        // if (args.eventArgs.url.match(/\/wiki/)) {
        //   _updateWinChart('openArticleFromNotification');
        // }

        window.page(args.eventArgs.url);

        var $Layout = DependencyInjection.injector.view.get('$Layout');
        if ($Layout.get('screen') != 'screen-desktop') {
          $Layout.rightContext().closeIfGroupOpened('group-users-profile');
        }
      }
      else if (args.eventName == 'url.external') {
        window.open(args.eventArgs.url, '_blank');
      }
    });

    $ShortcutsService.register(
      null,
      'talentforcepedia-f2',
      'F2',
      $i18nService._('Open Profile'),
      function(e) {
        // F2
        var isShortcut = e.keyCode == 113 && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey;

        if (isShortcut) {
          e.preventDefault();
          e.stopPropagation();
        }

        return isShortcut;
      },
      function() {
        userProfileButton.action();
      }
    );

    $NotificationsService.init();

    userActivityWatcher();

    $done();
  }]);

})();
