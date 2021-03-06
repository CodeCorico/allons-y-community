'use strict';

module.exports = [{
  url: '/members',

  enter: ['$BodyDataService', function($BodyDataService) {
    var user = $BodyDataService.data('user');

    return window.page.redirect(user.url ? '/members/' + user.url : '/');
  }]
}, {
  url: '/members/:member',

  enter: [
    '$BodyDataService', '$FaviconService', '$Page', '$i18nService', '$Layout', '$context', '$next',
  function($BodyDataService, $FaviconService, $Page, $i18nService, $Layout, $context, $next) {
    var user = $BodyDataService.data('user');

    if (user.permissionsPublic.indexOf('members-access') < 0) {
      return $next();
    }

    document.title = $i18nService._('Members') + ' - ' + $Page.get('web').brand;
    $FaviconService.update('/public/members/favicon.png');

    $Layout.selectApp('Members', false);

    var MembersService = null;

    setTimeout(function() {
      require('/public/members/members-service.js')
        .then(function() {
          MembersService = DependencyInjection.injector.view.get('MembersService');

          return MembersService.init();
        })
        .then(function() {
          return $Layout.require('members-layout');
        })
        .then(function() {
          MembersService.openMember($context.params.member);
        });
    });
  }],

  exit: ['$next', function($next) {
    require('/public/members/members-service.js').then(function() {
      var pathnameSplitted = window.location.pathname.split('/');

      if (!pathnameSplitted || pathnameSplitted.length < 2 || pathnameSplitted[1] != 'members') {
        return DependencyInjection.injector.view.get('MembersService').teardown(null, $next);
      }

      $next();
    });
  }]
}];
