(function() {
  'use strict';

  window.bootstrap(['$Page', '$i18nService', '$done', function($Page, $i18nService, $done) {
    $Page.remember([
      /^\/groups\/?$/,
      /^\/groups\//
    ]);

    $Page.push('apps', {
      name: $i18nService._('Groups'),
      select: function() {
        window.page('/groups');
      }
    });

    $done();
  }]);

})();
