module.exports = function() {
  'use strict';

  DependencyInjection.service('$NotificationsService', [
    '$AbstractService', '$socket',
  function($AbstractService, $socket) {

    return new (function $NotificationsService() {

      $AbstractService.call(this);

      var _this = this,
          _notifications = [],
          _loopNotificationsTimesInterval = null,
          _pushNotificationsRegistration = null;

      function _sortNotifications() {
        _notifications.sort(function(a, b) {
          if (a.locked && !b.locked) {
            return -1;
          }
          else if (b.locked && !a.locked) {
            return 1;
          }

          return new Date(b.date) - new Date(a.date);
        });
      }

      function _loopNotificationsTimes() {
        if (_loopNotificationsTimesInterval) {
          clearInterval(_loopNotificationsTimesInterval);
        }

        _this.fetchNotifications();

        // 1min
        _loopNotificationsTimesInterval = setTimeout(_loopNotificationsTimes, 60000);
      }

      function _formatNotification(notification) {
        notification.time = window.moment(notification.date).fromNow();
        notification.args = {
          eventName: notification.eventName,
          eventArgs: notification.eventArgs
        };
      }

      this.onSafe('init', function() {
        $socket.emit('call(users/notifications)');
      });

      this.fetchNotifications = function() {
        var unviewedCount = 0;

        _notifications.forEach(function(notification) {
          _formatNotification(notification);
          unviewedCount += notification.locked || !notification.viewed ? 1 : 0;
        });

        _sortNotifications();

        _this.fire('notificationsChanged', {
          notifications: _notifications,
          unviewedCount: unviewedCount
        });
      };

      this.actionNotification = function(index, args) {
        _this.clearNotificationsCount(index);

        _this.fire('actionNotification', args);
      };

      this.clearNotificationsCount = function(fromLast) {
        $socket.emit('update(users/notifications)', fromLast ? {
          fromLast: fromLast
        } : {
          allViewed: true
        });
      };

      this.fireNotificationsChanged = function() {
        _loopNotificationsTimes();
      };

      this.isPushNotificationsSupported = function() {
        return navigator && navigator.serviceWorker && navigator.serviceWorker.register &&
          window.ServiceWorkerRegistration && 'showNotification' in window.ServiceWorkerRegistration.prototype &&
          'PushManager' in window;
      };

      this.isPushNotificationsBlocked = function() {
        if (!_this.isPushNotificationsSupported()) {
          return true;
        }

        return Notification.permission === 'denied';
      };

      this.pushNotificationsSubscription = function(callback) {
        if (!_pushNotificationsRegistration) {
          navigator.serviceWorker.register('/public/notifications/worker-service-front.js').then(function(registration) {
            _pushNotificationsRegistration = registration;

            _this.pushNotificationsSubscription(callback);
          });

          return;
        }

        _pushNotificationsRegistration.pushManager.getSubscription().then(function(subscription) {
          callback(_pushNotificationsRegistration, subscription);
        });
      };

      this.checkPushNotificationsSubscription = function() {
        _this.pushNotificationsSubscription(function(registration, subscription) {
          _this.fire('hasPushNotificationsSubscription', {
            hasSubscription: !!(registration && subscription)
          });
        });
      };

      this.subscribePushNotifications = function() {
        if (!_this.isPushNotificationsSupported()) {
          return;
        }

        _this.pushNotificationsSubscription(function(registration, subscription) {
          if (!subscription) {
            registration.pushManager.subscribe({
              userVisibleOnly: true
            })
              .then(function(subscription) {
                var rawKey = subscription.getKey ? subscription.getKey('p256dh') : '',
                    rawAuthSecret = subscription.getKey ? subscription.getKey('auth') : '';

                _this.fire('hasPushNotificationsSubscription', {
                  hasSubscription: true
                });

                $socket.emit('update(users/activeuser.pushnotifications)', {
                  subscribe: true,
                  endpoint: subscription.endpoint,
                  userPublicKey: rawKey ? btoa(String.fromCharCode.apply(null, new Uint8Array(rawKey))) : '',
                  userAuth: rawAuthSecret ? btoa(String.fromCharCode.apply(null, new Uint8Array(rawAuthSecret))) : ''
                });
              })
              .catch(function(err) {
                _this.fire('hasPushNotificationsSubscription', {
                  hasSubscription: false
                });

                if (err && err.message.match(/permission denied/i)) {
                  window.alert([
                    'You have blocked the Platform to provides you push notifications support.\n',
                    'Please go to your browser parameters and allow the Platform notifications.'
                  ].join(''));
                }
              });
          }
        });
      };

      this.unsubscribePushNotifications = function() {
        _this.pushNotificationsSubscription(function(registration, subscription) {
          if (!subscription) {
            _this.fire('hasPushNotificationsSubscription', {
              hasSubscription: false
            });

            return;
          }

          $socket.emit('update(users/activeuser.pushnotifications)', {
            subscribe: false,
            endpoint: subscription.endpoint
          });

          subscription.unsubscribe().then(function() {
            _this.fire('hasPushNotificationsSubscription', {
              hasSubscription: false
            });
          });
        });
      };

      this.buttonAction = function(action) {
        if (typeof action != 'object' || !action.type) {
          return;
        }

        if (action.type == 'socket.event') {
          $socket.emit(action.event, action.eventArgs);
        }
      };

      $socket.on('read(users/notifications)', function(args) {
        if (!args || !args.notifications) {
          return;
        }

        _notifications = args.notifications;

        _loopNotificationsTimes();
      });

      $socket.on('read(users/notifications.viewed)', function(args) {
        if (!args || typeof args.count != 'undefined') {
          return;
        }

        if (args.all) {
          _notifications.forEach(function(notification) {
            notification.viewed = true;
          });
        }
        else if (args.fromLast) {
          if (_notifications && _notifications.length > args.fromLast) {
            _notifications[args.fromLast].viewed = true;
          }
        }
        else if (args.id) {
          if (_notifications) {
            _notifications.forEach(function(notification) {
              if (notification.id && notification.id == args.id) {
                notification.viewed = true;
              }
            });
          }
        }

        _loopNotificationsTimes();

        _this.fire('notificationsViewed', args);
      });

      $socket.on('read(users/notification)', function(args) {
        if (!args || !args.notification) {
          return;
        }

        _formatNotification(args.notification);

        _notifications.unshift(args.notification);

        _this.fire('pushNotification', {
          notification: args.notification
        });
      });

      $socket.on('reconnectSigned', function() {
        $socket.emit('call(users/notification)', {
          unnotified: true
        });
      });

    })();

  }]);

};
