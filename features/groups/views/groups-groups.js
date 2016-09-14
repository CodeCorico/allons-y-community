(function() {
  'use strict';

  window.Ractive.controllerInjection('groups-groups', [
    'GroupsService', '$component', '$data', '$done',
  function groupsGroupsController(
    GroupsService, $component, $data, $done
  ) {
    var GroupsGroups = $component({
      data: $data
    });

    function _beforeTeadown(callback) {
      callback();
    }

    GroupsService.onAsyncSafe('groupsGroupsController.beforeTeardown', function(args, callback) {
      _beforeTeadown(callback);
    });

    GroupsService.onAsyncSafe('groupsGroupsController.teardownGroups', function(args, callback) {
      _beforeTeadown(function() {
        GroupsGroups.teardown().then(function() {
          callback();
        });
      });
    });

    GroupsGroups.on('teardown', function() {
      GroupsGroups = null;

      setTimeout(function() {
        GroupsService.offNamespace('groupsGroupsController');
      });
    });

    GroupsGroups.require().then($done);
  }]);

})();
