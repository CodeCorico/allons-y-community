(function() {
  'use strict';

  window.Ractive.controllerInjection('members-member-item', [
    '$Page', '$RealTimeService', '$component', '$data', '$done',
  function membersMemberItemController($Page, $RealTimeService, $component, $data, $done) {

    var MembersMemberItem = $component({
          data: $.extend(true, {
            displayAvatar: $Page.get('avatar')
          }, $data)
        }),
        _realtimeComponent = 'membersMemberItemController' + MembersMemberItem.get('componentId'),
        _lastId = null;

    MembersMemberItem.observe('member', function(member) {
      if (!member || !member.id) {
        _lastId = null;
        $RealTimeService.unregisterComponent(_realtimeComponent);

        return;
      }

      if (_lastId == member.id) {
        return;
      }
      _lastId = member.id;

      $RealTimeService.realtimeComponent(_realtimeComponent, {
        name: 'users-user:' + member.id,
        update: function(event, args) {
          if (!MembersMemberItem || !args || !args.user) {
            return;
          }

          MembersMemberItem.set('member', $.extend(true, MembersMemberItem.get('user') || {}, args.user));
        },
        url: function(url) {
          MembersMemberItem.set('selected', '/members/' + MembersMemberItem.get('member.url') == url);
        }
      });

      if (MembersMemberItem.get('notransition') && MembersMemberItem.get('notransition') == 'true') {
        MembersMemberItem.set('show', true);
      }

      MembersMemberItem.update('member');

      if (!MembersMemberItem.get('show')) {
        setTimeout(function() {
          if (!MembersMemberItem) {
            return;
          }

          MembersMemberItem.set('show', true);
        }, MembersMemberItem.get('index') * 150);
      }
    });

    MembersMemberItem.on('teardown', function() {
      $RealTimeService.unregisterComponent(_realtimeComponent);

      MembersMemberItem = null;
    });

    $done();
  }]);

})();
