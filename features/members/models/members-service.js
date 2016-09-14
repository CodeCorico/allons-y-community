module.exports = function() {
  'use strict';

  DependencyInjection.service('MembersService', ['$AbstractService', function($AbstractService) {

    return new (function MembersService() {

      $AbstractService.call(this);

      var _this = this,
          _memberCalled = null;

      this.openMember = function(url) {
        _memberCalled = url;

        _this.fire('openMember', {
          url: url
        });
      };

      // this.updateWinChartCount = function(feature) {
      //   $socket.emit('update(win-chart/chart)', {
      //     feature: feature
      //   });
      // };

    })();

  }]);

};
