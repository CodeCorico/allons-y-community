(function() {
  'use strict';

  window.Ractive.controllerInjection('members-list', [
    '$RealTimeService', '$component', '$data', '$done',
  function membersListController($RealTimeService, $component, $data, $done) {

    var MembersList = $component({
          data: $.extend(true, {
            type: $data.type,
            total: 0
          }, $data)
        }),
        _realtimeComponent = 'membersListController' + MembersList.get('componentId'),
        _realtimeListEvent = null;

    function _updateRealtimeEvents() {
      _realtimeListEvent = [
        'users-',
        MembersList.get('type'),
        (MembersList.get('memberid') ? ':' + MembersList.get('memberid') : ''),
        (MembersList.get('groupid') ? ':' + MembersList.get('groupid') : ''),
        (MembersList.get('count') ? ':' + MembersList.get('count') : '')
      ].join('');

      if (
        (MembersList.get('type') == 'coworkers' && !MembersList.get('memberid')) ||
        (MembersList.get('type') == 'groupleaders' && !MembersList.get('groupid')) ||
        (MembersList.get('type') == 'groupmembers' && !MembersList.get('groupid')) ||
        (MembersList.get('type') == 'groupinvitations' && !MembersList.get('groupid'))
      ) {
        return;
      }

      $RealTimeService.realtimeComponent(_realtimeComponent, {
        name: _realtimeListEvent,
        update: function(event, args) {
          if (!args || !args.users) {
            return;
          }

          MembersList.set('members', args.users);
          MembersList.set('total', args.total);
        }
      }, _realtimeListEvent);
    }

    MembersList.observe('count', _updateRealtimeEvents, {
      init: false
    });

    MembersList.observe('memberid', _updateRealtimeEvents, {
      init: false
    });

    MembersList.observe('groupid', _updateRealtimeEvents, {
      init: false
    });

    MembersList.on('teardown', function() {
      $RealTimeService.unregisterComponent(_realtimeComponent);
    });

    MembersList.observe('members', function() {
      MembersList.require().then(function() {
        MembersList.fire('membersloaded');
      });
    }, {
      defer: true,
      init: false
    });

    _updateRealtimeEvents();

    $done();
  }]);

})();
