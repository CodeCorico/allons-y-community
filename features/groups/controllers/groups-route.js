'use strict';

module.exports = [{
  urls: [
    '/groups',
    '/groups/:group',
    '/groups/:group/:page'
  ],

  enter: [
    '$Page', '$BodyDataService', '$FaviconService', '$i18nService', '$Layout', '$context',
  function($Page, $BodyDataService, $FaviconService, $i18nService, $Layout, $context) {
    var user = $BodyDataService.data('user');

    if ($context.params.group && $context.params.group == 'create' && user.permissionsPublic.indexOf('groups-create') < 0) {
      return window.page.redirect('/create');
    }

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
          return GroupsService.cleanGroups(!!$context.params.group);
        })
        .then(function() {
          if ($context.params.group) {
            $Page.rightButtonAdd('groups-details', {
              icon: 'fa fa-file-text',
              group: 'group-groups-details',
              autoOpen: /^\/groups\//,
              beforeGroup: function(context, $group, userBehavior, callback) {
                context.require('groups-details').then(callback);
              }
            });
          }
          else {
            $Page.rightButtonRemove('groups-details');
            $Layout.rightContext().closeIfGroupOpened('group-groups-details');
          }

          return $Layout.findChild('name', 'groups-layout').require($context.params.group ? 'groups-group' : 'groups-groups');
        })
        .then(function() {
          return GroupsService.mode(
            $context.params.group && $context.params.group == 'create' || false,
            $context.params.page && $context.params.page == 'edit' || false,
            $context.params.group
          );
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
