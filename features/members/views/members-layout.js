(function() {
  'use strict';

  window.Ractive.controllerInjection('members-layout', [
    'MembersService', '$RealTimeService',
    '$Page', '$component', '$data', '$done',
  function membersLayoutController(
    MembersService, $RealTimeService,
    $Page, $component, $data, $done
  ) {
    var _web = $Page.get('web'),
        MembersLayout = $component({
          data: $.extend(true, {
            hasData: false,
            displayAvatar: $Page.get('avatar')
          }, $data)
        }),
        _scrolls = null,
        _$el = {
          layout: $(MembersLayout.el),
          scrolls: $(MembersLayout.el).find('.pl-scrolls')
        };

    function _changeMember(newMember, callback) {
      if (!MembersLayout.get('member')) {
        MembersLayout.set('member', newMember);

        return callback();
      }

      _$el.scrolls.scrollTop(0);

      MembersLayout.set('oldmember', $.extend(true, {}, MembersLayout.get('member')));
      MembersLayout.set('sb', 'sb-member-1');

      setTimeout(function() {
        MembersLayout.set('member', newMember);

        setTimeout(function() {
          MembersLayout.set('sb', 'sb-member-2');

          setTimeout(function() {
            MembersLayout.set('oldmember', null);
            MembersLayout.set('sb', null);

            callback();
          }, 1000);
        });
      });
    }

    MembersService.onSafe('membersLayoutController.openMember', function(args) {
      if (!args || !args.url) {
        return;
      }

      $RealTimeService.realtimeComponent('membersLayoutController', {
        name: 'users-user:' + args.url,
        update: function(event, args) {
          if (!args) {
            return;
          }

          if (args.error && args.error == 'not found') {
            return window.page.redirect('/404');
          }

          if (args.user) {
            document.title = args.user.username + ' - ' + _web.brand;
          }

          _changeMember(args.user, function() {
            if (!MembersLayout.get('hasData')) {
              setTimeout(function() {
                MembersLayout.set('hasData', true);
              });
            }
          });
        }
      }, 'users-user:' + args.url);
    });

    MembersLayout.on('coworkersLoaded contributionsLoaded groupsLoaded', function() {
      _scrolls.update();
    });

    MembersService.onAsyncSafe('membersLayoutController.beforeTeardown', function(args, callback) {
      MembersLayout.set('exit', true);

      setTimeout(callback, 1000);
    }, 'low');

    MembersService.onSafe('membersLayoutController.teardown', function() {
      MembersLayout.teardown();
      MembersLayout = null;
      _$el = null;
      $RealTimeService.unregisterComponent('membersLayoutController');

      setTimeout(function() {
        MembersService.offNamespace('membersLayoutController');
      });
    });

    MembersLayout.require().then(function() {
      _scrolls = MembersLayout.findChild('name', 'pl-scrolls');

      $done();
    });
  }]);

})();
