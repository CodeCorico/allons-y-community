(function() {
  'use strict';

  window.Ractive.controllerInjection('groups-details', [
    '$BodyDataService', '$socket', '$Page', '$Layout', 'GroupsService', '$component', '$data', '$done',
  function groupsDetailsController(
    $BodyDataService, $socket, $Page, $Layout, GroupsService, $component, $data, $done
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

    // function _hasModifications() {
    //   GroupsService.fire('hasModifications');
    // }

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

    // GroupsService.onAsyncSafe('groupsDetailsController.beforeSave', function(args, callback) {
    //   var tags = GroupsDetails.get('tags') || [],
    //       newTags = {};

    //   tags.forEach(function(sectionTags) {
    //     sectionTags.masterTags.forEach(function(masterTag) {
    //       masterTag.tags.forEach(function(tag) {
    //         newTags[sectionTags.name] = newTags[sectionTags.name] || [];
    //         newTags[sectionTags.name].push(masterTag.name + ':' + tag.name);
    //       });
    //     });
    //   });

    //   callback({
    //     tags: newTags
    //   });
    // });

    GroupsService.onSafe([
      'groupsDetailsController.selectMode',
      'groupsDetailsController.editMode',
      'groupsDetailsController.createMode'
    ].join(' '), _modeChanged);

    function _modeChanged() {
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

      console.log('mode', mode);

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

    function _groupChanged(args) {
      if (!args || !args.group) {
        return _resetView();
      }

      if (GroupsDetails.get('group.id') != args.group.id) {
        _resetTab();
      }

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

      GroupsDetails.set('group', args.group);

      GroupsDetails.set('leadersUrl', '/groups/' + args.group.url + '/leaders');
      GroupsDetails.set('membersUrl', '/groups/' + args.group.url + '/' + (args.group.special == 'deactivated' ? 'deactivated' : 'members'));
      GroupsDetails.set('invitationsUrl', '/groups/' + args.group.url + '/invitations');

      GroupsDetails.require();
    }

    GroupsService.onSafe('groupsDetailsController.groupChanged', _groupChanged);

    GroupsService.onAsyncSafe('groupsDetailsController.teardownGroup groupsDetailsController.teardown', function(args, callback) {
      GroupsDetails.teardown().then(callback);
    });

    GroupsDetails.on('teardown', function() {
      $Layout.off('rightContextOpened', _rightContextOpened);
      GroupsDetails.teardown();
      GroupsDetails = null;

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
