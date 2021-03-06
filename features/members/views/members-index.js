(function() {
  'use strict';

  window.bootstrap(['$Page', '$i18nService', '$done', function($Page, $i18nService, $done) {
    $Page.remember([
      /^\/members\/?$/,
      /^\/members\//
    ]);

    $Page.push('apps', {
      name: $i18nService._('Members'),
      select: function() {
        window.page('/members');
      }
    });

    $done();
  }]);

})();
