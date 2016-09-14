(function() {
  'use strict';

  window.Ractive.controllerInjection('groups-group-item', [
    '$Page', '$RealTimeService', '$component', '$data', '$done',
  function groupsGroupItemController($Page, $RealTimeService, $component, $data, $done) {

    var _defaultCover = '/public/groups/group.png',
        GroupsGroupItem = $component({
          data: $.extend(true, {
            displayCover: function(cover) {
              return cover || _defaultCover;
            }
          }, $data)
        }),
        _realtimeComponent = 'groupsGroupItemController' + GroupsGroupItem.get('componentId'),
        _lastId = null;

    GroupsGroupItem.observe('group', function(group) {
      if (!group || !group.id) {
        _lastId = null;
        $RealTimeService.unregisterComponent(_realtimeComponent);

        return;
      }

      if (_lastId == group.id) {
        return;
      }
      _lastId = group.id;

      $RealTimeService.realtimeComponent(_realtimeComponent, {
        name: 'groups-group:' + group.id,
        update: function(event, args) {
          if (!GroupsGroupItem || !args || !args.group) {
            return;
          }

          GroupsGroupItem.set('group', $.extend(true, GroupsGroupItem.get('group') || {}, args.group));
        },
        url: function(url) {
          GroupsGroupItem.set('selected', '/groups/' + GroupsGroupItem.get('group.url') == url);
        }
      });

      if (GroupsGroupItem.get('notransition') && GroupsGroupItem.get('notransition') == 'true') {
        GroupsGroupItem.set('show', true);
      }

      GroupsGroupItem.update('group');

      if (!GroupsGroupItem.get('show')) {
        setTimeout(function() {
          if (!GroupsGroupItem) {
            return;
          }

          GroupsGroupItem.set('show', true);
        }, GroupsGroupItem.get('index') * 150);
      }
    });

    GroupsGroupItem.on('teardown', function() {
      $RealTimeService.unregisterComponent(_realtimeComponent);

      GroupsGroupItem = null;
    });

    $done();
  }]);

})();
