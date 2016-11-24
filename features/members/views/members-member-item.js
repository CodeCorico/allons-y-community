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

    function _formatMember(member) {
      member.addedAtString = window.moment(member.addedAt).fromNow();

      return member;
    }

    MembersMemberItem.observe('member', function(member) {
      if (!member || !member.id) {
        _lastId = null;
        $RealTimeService.unregisterComponent(_realtimeComponent);

        return;
      }

      MembersMemberItem.set('deleted', false);
      MembersMemberItem.set('lastLeaderError', false);
      MembersMemberItem.set('inError', false);

      _formatMember(member);

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

          var member = $.extend(true, MembersMemberItem.get('user') || {}, args.user);
          _formatMember(member);

          MembersMemberItem.set('member', member);
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

    MembersMemberItem.on('becomememberClick', function(event) {
      event.original.stopPropagation();
      event.original.preventDefault();

      MembersMemberItem.set('deleted', true);

      MembersMemberItem.fire('becomemember', {
        member: MembersMemberItem.get('member')
      });
    });

    MembersMemberItem.on('removeClick', function(event) {
      event.original.stopPropagation();
      event.original.preventDefault();

      MembersMemberItem.set('deleted', true);

      MembersMemberItem.fire('remove', {
        member: MembersMemberItem.get('member')
      });
    });

    MembersMemberItem.on('reactivateClick', function(event) {
      event.original.stopPropagation();
      event.original.preventDefault();

      MembersMemberItem.set('deleted', true);

      MembersMemberItem.fire('reactivate', {
        member: MembersMemberItem.get('member')
      });
    });

    MembersMemberItem.on('cancelinvitationClick', function(event) {
      event.original.stopPropagation();
      event.original.preventDefault();

      MembersMemberItem.set('deleted', true);

      MembersMemberItem.fire('cancelinvitation', {
        invitation: MembersMemberItem.get('member')
      });
    });

    MembersMemberItem.on('lastLeaderError', function() {
      MembersMemberItem.set('deleted', false);

      MembersMemberItem.set('inError', true);
      MembersMemberItem.set('lastLeaderError', true);

      setTimeout(function() {
        MembersMemberItem.set('inError', 'hide');

        setTimeout(function() {
          MembersMemberItem.set('lastLeaderError', false);
          MembersMemberItem.set('inError', false);
        }, 550);
      }, 4000);
    });

    MembersMemberItem.on('teardown', function() {
      $RealTimeService.unregisterComponent(_realtimeComponent);

      MembersMemberItem = null;
    });

    $done();
  }]);

})();
