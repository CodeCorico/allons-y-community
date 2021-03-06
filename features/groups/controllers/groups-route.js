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
        pages = ['leaders', 'members', 'deactivated', 'invitations', 'edit'];

    if ($context.params.page && pages.indexOf($context.params.page) < 0) {
      return window.page.redirect('/groups/' + $context.params.group);
    }

    setTimeout(function() {
      require('/public/groups/groups-service.js')
        .then(function() {
          return require('/public/dropzone/dropzone.css');
        })
        .then(function() {
          return require('/public/vendor/dropzone.js');
        })
        .then(function() {
          window.Dropzone.autoDiscover = false;

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

  exit: ['$next', '$Page', '$Layout', '$context', function($next, $Page, $Layout, $context) {
    if (window.page.doNothing) {
      window.page.doNothing = false;

      return;
    }

    require('/public/groups/groups-service.js').then(function() {
      var GroupsService = DependencyInjection.injector.view.get('GroupsService'),
          pathname = window.location.pathname,
          pathnameSplitted = window.location.pathname.split('/');

      if (!window.page.forceRedirection && GroupsService.inEditUnsaved()) {
        if (!pathnameSplitted || pathnameSplitted.length < 2 || pathnameSplitted[1] != 'groups') {
          window.page.doNothing = true;
        }

        window.page.redirect($context.path);

        GroupsService.exitConfirmation(function() {
          window.page.doNothing = false;
          window.page.forceRedirection = true;
          window.page(pathname);
        }, function() {
          window.page.doNothing = false;
        });

        return;
      }

      if (!pathnameSplitted || pathnameSplitted.length < 2 || pathnameSplitted[1] != 'groups') {
        $Page.rightButtonRemove('groups-details');
        $Layout.rightContext().closeIfGroupOpened('group-groups-details');

        return DependencyInjection.injector.view.get('GroupsService').teardown(null, $next);
      }

      $next();
    });
  }]
}];
