(function() {
  'use strict';

  window.Ractive.controllerInjection('groups-group', [
    'GroupsService', '$RealTimeService',
    '$Page', '$BodyDataService', '$component', '$data', '$done',
  function groupsGroupController(
    GroupsService, $RealTimeService,
    $Page, $BodyDataService, $component, $data, $done
  ) {
    var _web = $BodyDataService.data('web'),
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

      $RealTimeService.realtimeComponent('groupsGroupController', {
        name: 'groups-group:' + args.url,
        update: function(event, args) {
          if (!args) {
            return;
          }

          if (args.error && args.error == 'not found') {
            return window.page.redirect('/404');
          }

          if (args.group) {
            document.title = args.group.name + ' - ' + _web.brand;
          }

          _changeGroup(args);
        }
      }, 'groups-group:' + args.url);
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
