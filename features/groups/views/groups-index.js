(function() {
  'use strict';

  window.bootstrap(['$Page', '$i18nService', '$done', function($Page, $i18nService, $done) {

    $Page.push('apps', {
      name: $i18nService._('Groups'),
      select: function() {
        window.page('/groups');
      }
    });

    $done();
  }]);

})();
