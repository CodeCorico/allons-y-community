(function() {
  'use strict';

  window.Ractive.controllerInjection('groups-list', [
    '$RealTimeService', '$component', '$data', '$done',
  function groupsListController($RealTimeService, $component, $data, $done) {

    var GroupsList = $component({
          data: $.extend(true, {
            type: $data.type,
            total: 0
          }, $data)
        }),
        _total = null,
        _realtimeComponent = 'groupsListController' + GroupsList.get('componentId'),
        _realtimeListEvent = null;

    function _updateRealtimeEvents() {
      _realtimeListEvent = [
        'groups-',
        GroupsList.get('type'),
        (GroupsList.get('memberid') ? ':' + GroupsList.get('memberid') : ''),
        (GroupsList.get('count') ? ':' + GroupsList.get('count') : '')
      ].join('');

      if (GroupsList.get('type') == 'member' && !GroupsList.get('memberid')) {
        return;
      }

      $RealTimeService.realtimeComponent(_realtimeComponent, {
        name: _realtimeListEvent,
        update: function(event, args) {
          if (!args || !args.groups) {
            return;
          }

          GroupsList.set('groups', args.groups);
        }
      }, _realtimeListEvent);
    }

    GroupsList.observe('count', _updateRealtimeEvents, {
      init: false
    });

    GroupsList.observe('memberid', _updateRealtimeEvents, {
      init: false
    });

    GroupsList.on('teardown', function() {
      $RealTimeService.unregisterComponent(_realtimeComponent);
    });

    GroupsList.observe('groups', function(groups) {
      var total = groups && groups.length || 0;
      if (total === _total) {
        return;
      }
      _total = total;

      GroupsList.set('total', groups && groups.length || 0);

      GroupsList.require().then(function() {
        GroupsList.fire('groupsloaded');
      });
    }, {
      defer: true,
      init: false
    });

    _updateRealtimeEvents();

    $done();
  }]);

})();
