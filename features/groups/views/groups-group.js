(function() {
  'use strict';

  window.Ractive.controllerInjection('groups-group', [
    'GroupsService', '$RealTimeService',
    '$Page', '$component', '$data', '$done',
  function groupsGroupController(
    GroupsService, $RealTimeService,
    $Page, $component, $data, $done
  ) {
    var _web = $Page.get('web'),
        _defaultCover = '/public/groups/group.png',
        GroupsGroup = $component({
          data: $.extend(true, {
            invitMembers: null,
            displayAvatar: $Page.get('avatar'),
            displayCover: function(cover) {
              return cover || _defaultCover;
            },

            invitFocus: function(event, value, component) {
              GroupsGroup.get('invitChange')(event, value, component);
            },

            invitChange: function(event, value, component) {
              GroupsService.findMembers(
                GroupsGroup.get('group.id'), value, component.get('is') == 'leader', function(members) {
                  component.set('list', _membersList(members));
                }
              );
            },

            invitSelect: function(event, value, component) {
              GroupsService.invitMember(
                GroupsGroup.get('group.id'), value, component.get('is') == 'leader', function(adding) {
                  if (adding) {
                    component.clear();
                  }
                }
              );
            }
          }, $data)
        }),
        _$el = {
          layout: $(GroupsGroup.el),
          scrolls: $(GroupsGroup.el).find('.pl-scrolls')
        },
        _pageFilterTimeout = null,
        _scrolls = null;

    function _membersList(members) {
      members = members || [];

      members.forEach(function(member) {
        member.display = '<img src="' + GroupsGroup.get('displayAvatar')(member.avatarMini) + '" /> ' + member.username;
        member.value = member.email;

        return member;
      });

      return members;
    }

    function _changeGroup(args, callback) {
      args.group.permissions = [];
      if (args.group.permissionsMembers) {
        args.group.permissions = args.group.permissions.concat(args.group.permissionsMembers.map(function(permission) {
          return permission.title;
        }));
      }
      if (args.group.permissionsLeaders) {
        args.group.permissions = args.group.permissions.concat(args.group.permissionsLeaders.map(function(permission) {
          return permission.title;
        }));
      }

      GroupsGroup.set('group', args.group);

      _scrolls.update();

      GroupsGroup.require();

      if (callback) {
        callback();
      }
    }

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

            GroupsGroup.set('leadersUrl', url + '/leaders');
            GroupsGroup.set('membersUrl', url + '/' + (args.group.special == 'deactivated' ? 'deactivated' : 'members'));
            GroupsGroup.set('invitationsUrl', url + '/invitations');

            GroupsGroup.set('canBecomeMember', args.group.activeUserisLeader);
            GroupsGroup.set('canRemoveMember', args.group.activeUserisLeader && (!args.group.special || args.group.special != 'deactivated'));
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

    GroupsService.onAsyncSafe('groupsGroupController.teardownGroup', function(args, callback) {
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

    GroupsGroup.on('becomemember', function(element, list, args) {
      GroupsService.becomeMember(GroupsGroup.get('groupUrl'), args.member);
    });

    GroupsGroup.on('remove', function(element, list, args) {
      GroupsService.removeMember(GroupsGroup.get('groupUrl'), args.member);
    });

    GroupsGroup.on('reactivate', function(element, list, args) {
      GroupsService.reactivate(args.member);
    });

    GroupsGroup.on('cancelinvitation', function(element, list, args) {
      GroupsService.cancelinvitation(GroupsGroup.get('groupUrl'), args.invitation);
    });

    GroupsGroup.on('teardown', function() {
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
