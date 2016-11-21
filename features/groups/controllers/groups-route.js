'use strict';

module.exports = [{
  urls: [
    '/groups',
    '/groups/:group',
    '/groups/:group/:page'
  ],

  enter: [
    '$Page', '$FaviconService', '$i18nService', '$Layout', '$context',
  function($Page, $FaviconService, $i18nService, $Layout, $context) {
    document.title = $i18nService._('Groups') + ' - ' + $Page.get('web').brand;
    $FaviconService.update('/public/groups/favicon.png');

    $Layout.selectApp('Groups', false);

    var GroupsService = null,
        pages = ['leaders', 'members', 'deactivated', 'invitations'];

    if ($context.params.page && pages.indexOf($context.params.page) < 0) {
      return window.page.redirect('/groups/' + $context.params.group);
    }

    setTimeout(function() {
      require('/public/groups/groups-service.js')
        .then(function() {
          GroupsService = DependencyInjection.injector.view.get('GroupsService');

          return GroupsService.init();
        })
        .then(function() {
          return $Layout.require('groups-layout');
        })
        .then(function() {
          return GroupsService.inGroups(!!$context.params.group);
        })
        .then(function() {
          return $Layout.findChild('name', 'groups-layout').require($context.params.group ? 'groups-group' : 'groups-groups');
        })
        .then(function() {
          if ($context.params.group) {
            GroupsService.openGroup($context.params.group, $context.params.page);
          }
        });
    });
  }],

  exit: ['$next', function($next) {
    require('/public/groups/groups-service.js').then(function() {
      var pathnameSplitted = window.location.pathname.split('/');

      if (!pathnameSplitted || pathnameSplitted.length < 2 || pathnameSplitted[1] != 'groups') {
        return DependencyInjection.injector.view.get('GroupsService').teardown(null, $next);
      }

      $next();
    });
  }]
}];
