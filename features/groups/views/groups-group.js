(function() {
  'use strict';

  window.Ractive.controllerInjection('groups-group', [
    'GroupsService', '$RealTimeService', '$BodyDataService',
    '$Page', '$component', '$data', '$done',
  function groupsGroupController(
    GroupsService, $RealTimeService, $BodyDataService,
    $Page, $component, $data, $done
  ) {
    var _web = $Page.get('web'),
        _defaultCover = '/public/groups/group.png',
        _lastMemberElement = null,
        GroupsGroup = $component({
          data: $.extend(true, {
            MODES: GroupsService.MODES,
            user: $BodyDataService.data('user'),
            invitMembers: null,
            displayAvatar: $Page.get('avatar'),
            displayCover: function(cover) {
              return cover || _defaultCover;
            }
          }, $data)
        }),
        _$el = {
          layout: $(GroupsGroup.el),
          scrolls: $(GroupsGroup.el).find('.pl-scrolls')
        },
        _pageFilterTimeout = null,
        _scrolls = null;

    function _changeGroup(args, callback) {
      GroupsService.group(args.group);

      GroupsGroup.set('group', args.group);

      _scrolls.update();

      GroupsGroup.require();

      if (callback) {
        callback();
      }
    }

    GroupsService.onSafe('groupsGroupController.lastLeaderError', function() {
      if (!_lastMemberElement) {
        return;
      }

      _lastMemberElement.fire('lastLeaderError');
    });

    function _modeChanged() {
      var mode = GroupsService.mode();

      GroupsGroup.set('mode', mode);
      GroupsGroup.set('editMode', mode == GroupsService.MODES.EDIT || mode == GroupsService.MODES.CREATE);
    }

    GroupsService.onSafe([
      'groupsGroupController.selectMode',
      'groupsGroupController.editMode',
      'groupsGroupController.createMode'
    ].join(' '), _modeChanged);

    GroupsService.onSafe('groupsGroupController.openCreateGroup', function() {
      GroupsGroup.set('group', {
        name: '',
        description: ''
      });

      GroupsGroup.require().then(function() {
        _$el.layout.find('.edit-name input').focus();
      });
    });

    GroupsService.onSafe('groupsGroupController.openGroup', function(args) {
      if (!args || !args.url) {
        return;
      }

      var url = args.url;

      if (url.substr(url.length - 1, 1) == '/') {
        url = url.substr(0, url.length - 1);
      }

      GroupsGroup.set('groupUrl', url);

      url = '/groups/' + url;
      GroupsGroup.set('url', url);
      GroupsGroup.set('pageFilter', '');
      GroupsGroup.set('pageItemsCount', 25);
      GroupsGroup.set('page', args.page || null);

      _lastMemberElement = null;

      $RealTimeService.realtimeComponent('groupsGroupController', {
        name: 'groups-group:' + args.url,
        update: function(event, args) {
          if (!args) {
            return;
          }

          var page = GroupsGroup.get('page');

          if (args.error && args.error == 'not found') {
            return window.page.redirect('/404');
          }

          if (args.group) {
            if (page == 'deactivated' && (!args.group.special || args.group.special != 'deactivated')) {
              return window.page.redirect('/404');
            }
            if (args.group.special == 'deactivated' && (page == 'members' || page == 'invitations')) {
              return window.page.redirect('/404');
            }

            document.title = args.group.name + ' - ' + _web.brand;

            GroupsGroup.set('canBecomeMember',
              args.group.activeUserisLeader &&
              (!args.group.special || (args.group.special != 'deactivated' && args.group.special != 'unknowns'))
            );
            GroupsGroup.set('canRemoveMember',
              args.group.activeUserisLeader &&
              (!args.group.special || (args.group.special != 'deactivated' && args.group.special != 'members'))
            );
            GroupsGroup.set('canReactivateDeactivated', args.group.activeUserisLeader && args.group.special == 'deactivated');
            GroupsGroup.set('canCancelInvitation', args.group.activeUserisLeader);
          }

          _changeGroup(args);
        }
      }, 'groups-group:' + args.url);

      GroupsGroup.require();
    });

    function _beforeTeadown(callback) {
      callback();
    }

    GroupsService.onAsyncSafe('groupsGroupController.beforeTeardown', function(args, callback) {
      _beforeTeadown(callback);
    });

    GroupsService.onAsyncSafe('groupsGroupController.teardownGroup groupsGroupController.teardown', function(args, callback) {
      _beforeTeadown(function() {
        GroupsGroup.teardown().then(function() {
          callback();
        });
      });
    });

    GroupsGroup.on('showMore', function() {
      GroupsGroup.set('pageItemsCount', GroupsGroup.get('pageItemsCount') + 25);
    });

    function _updatePageFilter() {
      if (!GroupsGroup) {
        return;
      }

      GroupsGroup.set('pageFilterValue', GroupsGroup.get('pageFilter'));
    }

    GroupsGroup.observe('pageFilter', function() {
      clearTimeout(_pageFilterTimeout);
      _pageFilterTimeout = setTimeout(_updatePageFilter, 500);
    }, {
      init: false
    });

    GroupsGroup.on('becomemember', function(list, element, args) {
      _lastMemberElement = element;

      GroupsService.becomeMember(GroupsGroup.get('groupUrl'), args.member);
    });

    GroupsGroup.on('remove', function(list, element, args) {
      _lastMemberElement = element;

      GroupsService.removeMember(GroupsGroup.get('groupUrl'), args.member);
    });

    GroupsGroup.on('reactivate', function(list, element, args) {
      GroupsService.reactivate(args.member);
    });

    GroupsGroup.on('cancelinvitation', function(list, element, args) {
      GroupsService.cancelinvitation(GroupsGroup.get('groupUrl'), args.invitation);
    });

    GroupsGroup.on('teardown', function() {
      _lastMemberElement = null;
      GroupsGroup = null;
      _$el = null;
      $RealTimeService.unregisterComponent('groupsGroupController');

      setTimeout(function() {
        GroupsService.offNamespace('groupsGroupController');
      });
    });

    GroupsGroup.require().then(function() {
      _scrolls = GroupsGroup.findChild('name', 'pl-scrolls');

      $done();
    });
  }]);

})();
