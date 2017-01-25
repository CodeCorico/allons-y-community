(function() {
  'use strict';

  window.Ractive.controllerInjection('groups-details', [
    '$RealTimeService', '$BodyDataService', '$socket', '$Page', '$Layout', 'GroupsService', '$component', '$data', '$done',
  function groupsDetailsController(
    $RealTimeService, $BodyDataService, $socket, $Page, $Layout, GroupsService, $component, $data, $done
  ) {
    var GroupsDetails = $component({
          data: $.extend(true, {
            tabs: [{
              name: 'community',
              title: 'Community',
              icon: 'fa fa-users'
            }, {
              name: 'permissions',
              title: 'Permissions',
              icon: 'fa fa-key'
            }],
            MODES: GroupsService.MODES,
            user: $BodyDataService.data('user'),
            tabSelected: 'community',
            titleSelected: null,
            displayAvatar: $Page.get('avatar'),

            invitFocus: function(event, value, component) {
              GroupsDetails.get('invitChange')(event, value, component);
            },

            invitChange: function(event, value, component) {
              GroupsService.findMembers(
                GroupsDetails.get('group.id'), value, component.get('is') == 'leader', function(members) {
                  component.set('list', _membersList(members));
                }
              );
            },

            invitSelect: function(event, value, component) {
              GroupsService.invitMember(
                GroupsDetails.get('group.id'), value, component.get('is') == 'leader', function(adding) {
                  if (adding) {
                    component.clear();
                  }
                }
              );
            },

            newGroupFocus: function(event, value, component) {
              GroupsDetails.get('newGroupChange')(event, value, component);
            },

            newGroupChange: function(event, value, component) {
              if (!value) {
                GroupsService.stopAutocompleteNewGroup();
                component.clear();

                return;
              }

              var keypath = component.get('keypath'),
                  context = GroupsDetails.get(keypath);

              GroupsService.autocompleteNewGroup(
                value,
                context.map(function(group) {
                  return group.ownLeaders ? -1 : (group.ownMembers ? -2 : group.id);
                }).concat([GroupsDetails.get('group.id')]),
                function(groups) {
                  component.set('list', groups.map(function(group) {
                    if (group.ownLeaders || group.ownMembers) {
                      group.display = GroupsDetails.get('group.name') + ': ' + group.display;
                    }

                    return group;
                  }));
                }
              );
            },

            newGroupSelect: function(event, value, component) {
              if (typeof event.context.id == 'undefined') {
                return;
              }

              var keypath = component.get('keypath'),
                  context = GroupsDetails.get(keypath),
                  group = $.extend(true, {}, event.context);

              group.name = group.value;
              group.delete = false;
              delete group.value;
              delete group.display;

              context.push(group);

              GroupsDetails.update(keypath);

              _hasModifications();

              component.clear();
            }
          }, $data),

          goToTab: function(tab, noAnimation) {
            var $tab = _$el.component.find('.s-' + tab),
                $firstTab = _$el.scrolls.find('.pl-section.s-' + GroupsDetails.get('tabs')[0].name);

            if (!$tab.length || !$firstTab.length) {
              return;
            }

            var scrollTop = $tab.offset().top - $firstTab.offset().top;

            _stopScroll = true;
            GroupsDetails.set('tabSelected', tab);

            if (noAnimation) {
              _$el.scrolls.scrollTop(scrollTop);
              _stopScroll = false;
            }
            else {
              _$el.scrolls.animate({
                scrollTop: scrollTop
              }, 250, function() {
                _stopScroll = false;
              });
            }
          }
        }),
        _stopScroll = false,
        _scrolls = null,
        _$el = {
          component: $(GroupsDetails.el)
        };

    function _membersList(members) {
      members = members || [];

      members.forEach(function(member) {
        member.display = '<img src="' + GroupsDetails.get('displayAvatar')(member.avatarMini) + '" /> ' + member.username;
        member.value = member.email;

        return member;
      });

      return members;
    }

    function _hasModifications() {
      GroupsService.hasModifications(true);
    }

    function _rightContextOpened(args) {
      if (!args.opened) {
        return;
      }

      setTimeout(function() {
        if (!_scrolls) {
          return;
        }

        _scrolls.update();
      }, 1200);
    }

    function _closeOnNotDesktop() {
      $Layout.closeOnNotDesktop('group-groups-details');
    }

    // GroupsDetails.on('goBackPost', _closeOnNotDesktop);

    _$el.scrolls = _$el.component.find('.pl-scrolls');

    _$el.scrolls.scroll(function() {
      if (_stopScroll || !GroupsDetails.get('group')) {
        return;
      }

      var tabs = GroupsDetails.get('tabs'),
          tabSelected = null;

      for (var i = 0; i < tabs.length; i++) {
        var $tab = _$el.component.find('.s-' + tabs[i].name);

        if ($tab.length && $tab.offset().top - _$el.scrolls.offset().top < 50) {
          tabSelected = tabs[i].name;
        }
        else {
          break;
        }
      }

      GroupsDetails.set('tabSelected', tabSelected);
    });

    GroupsDetails.on('scrollToAnchor', function(event) {
      event.original.stopPropagation();
      event.original.preventDefault();

      if (GroupsDetails.get('editMode')) {
        return;
      }

      _closeOnNotDesktop();

      GroupsService.scrollToAnchor('#' + event.context.name.replace(/#/, ''));
    });

    GroupsDetails.on('removePermissionGroup', function(event) {
      GroupsDetails.set(event.keypath + '.delete', true);

      setTimeout(function() {
        var lastDot = event.keypath.lastIndexOf('.'),
            parent = event.keypath.substr(0, lastDot),
            index = event.keypath.substring(lastDot + 1);

        GroupsDetails.splice(parent, index, 1);

        _hasModifications();
      }, 350);
    });

    GroupsDetails.on('togglePublicPermission', function(event) {
      GroupsDetails.set(event.keypath + '.selected', !GroupsDetails.get(event.keypath + '.selected'));

      _hasModifications();
    });

    GroupsService.onAsyncSafe('groupsDetailsController.beforeSave', function(args, callback) {
      callback({
        permissions: GroupsDetails.get('permissions')
      });
    });

    GroupsService.onSafe([
      'groupsDetailsController.selectMode',
      'groupsDetailsController.editMode',
      'groupsDetailsController.createMode'
    ].join(' '), _modeChanged);

    function _modeChanged() {
      if (!GroupsDetails) {
        return;
      }

      var mode = GroupsService.mode();

      if (mode == GroupsService.MODES.NONE) {
        _resetView();
      }
      else if (mode == GroupsService.MODES.CREATE) {
        _groupChanged({
          group: {
            id: null
          }
        });
      }

      GroupsDetails.set('mode', mode);
      GroupsDetails.set('editMode', mode == GroupsService.MODES.EDIT || mode == GroupsService.MODES.CREATE);

      GroupsDetails.require();
    }

    function _resetTab() {
      _$el.scrolls.scrollTop(0);
    }

    function _resetView() {
      GroupsDetails.set('group', null);
      _resetTab();
    }

    function _hasPublicPermissionSelected(permissions) {
      for (var i = 0; i < permissions.length; i++) {
        if (permissions[i].selected) {
          return true;
        }
      }

      return false;
    }

    function _groupChanged(args) {
      if (!GroupsDetails || !args || !args.group) {
        return _resetView();
      }

      if (args.group.id) {
        if (GroupsDetails.get('group.id') != args.group.id) {
          _resetTab();

          $RealTimeService.realtimeComponent('groupsDetailsController', {
            name: 'groups-permissions:' + args.group.id,
            update: function(event, args) {
              if (!args) {
                return;
              }

              args.permissions.hasPublicSelected = _hasPublicPermissionSelected(args.permissions.publicPermissions);

              GroupsDetails.set('permissionsOrigin', args.permissions);
              GroupsDetails.set('permissions', $.extend(true, {}, args.permissions));
            }
          }, 'groups-permissions:' + args.group.id);
        }
        else {
          GroupsDetails.set('permissions', $.extend(true, {}, GroupsDetails.get('permissionsOrigin')));
        }
      }
      else {
        _resetTab();

        $RealTimeService.unregisterComponent('groupsDetailsController');

        $socket.once('read(groups/groups.publicPermissions)', function(args) {
          GroupsDetails.set('permissions.publicPermissions', args.publicPermissions);
        });

        $socket.emit('call(groups/groups.publicPermissions)');

        GroupsDetails.set('permissions', {
          canSeeGroups: [{
            id: null,
            name: null,
            ownLeaders: true,
            fixed: true
          }, {
            id: null,
            name: null,
            ownMembers: true,
            fixed: true
          }],
          canSeeLeadersGroups: [{
            id: null,
            name: null,
            ownLeaders: true,
            fixed: true
          }],
          canSeeMembersGroups: [{
            id: null,
            name: null,
            ownLeaders: true,
            fixed: true
          }]
        });

        GroupsDetails.set('permissionsOrigin', GroupsDetails.get('permissions'));
      }

      GroupsDetails.set('group', args.group);
      GroupsDetails.set('leadersUrl', '/groups/' + args.group.url + '/leaders');
      GroupsDetails.set('membersUrl', '/groups/' + args.group.url + '/' + (args.group.special == 'deactivated' ? 'deactivated' : 'members'));
      GroupsDetails.set('invitationsUrl', '/groups/' + args.group.url + '/invitations');

      GroupsDetails.require();
    }

    GroupsService.onSafe('groupsDetailsController.groupChanged', _groupChanged);

    GroupsService.onAsyncSafe('groupsDetailsController.teardownGroup groupsDetailsController.teardown', function(args, callback) {
      if (!GroupsDetails) {
        return callback();
      }

      GroupsDetails.teardown().then(callback);
    });

    GroupsDetails.on('teardown', function() {
      $Layout.off('rightContextOpened', _rightContextOpened);
      GroupsDetails = null;
      $RealTimeService.unregisterComponent('groupsDetailsController');

      setTimeout(function() {
        GroupsService.offNamespace('groupsDetailsController');
      });
    });

    GroupsDetails.require().then(function() {
      _scrolls = GroupsDetails.findChild('name', 'pl-scrolls');

      _modeChanged();

      if (GroupsService.lastGroup()) {
        _groupChanged({
          group: GroupsService.lastGroup()
        });
      }

      $Layout.on('rightContextOpened', _rightContextOpened);

      $done();
    });
  }]);

})();
