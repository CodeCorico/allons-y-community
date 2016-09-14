(function() {
  'use strict';

  window.Ractive.controllerInjection('groups-layout', [
    'GroupsService',
    '$component', '$data', '$done',
  function groupsLayoutController(
    GroupsService,
    $component, $data, $done
  ) {
    var GroupsLayout = $component({
      data: $data
    });

    GroupsService.onSafe('groupsLayoutController.teardown', function() {
      GroupsLayout.teardown();
      GroupsLayout = null;

      setTimeout(function() {
        GroupsService.offNamespace('groupsLayoutController');
      });
    });

    $done();
  }]);

})();
