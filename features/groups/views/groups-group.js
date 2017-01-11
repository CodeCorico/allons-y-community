(function() {
  'use strict';

  window.Ractive.controllerInjection('groups-group', [
    'GroupsService', '$RealTimeService', '$BodyDataService', '$socket',
    '$Page', '$component', '$data', '$done',
  function groupsGroupController(
    GroupsService, $RealTimeService, $BodyDataService, $socket,
    $Page, $component, $data, $done
  ) {
    var _web = $Page.get('web'),
        _defaultCover = '/public/groups/group.png',
        _lastMemberElement = null,
        GroupsGroup = $component({
          data: $.extend(true, {
            MODES: GroupsService.MODES,
            groupOrigin: null,
            saving: false,
            closeConfirm: false,
            deleteConfirm: false,
            hasModifications: false,
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
        _dropzone = new window.Dropzone(
          _$el.layout.find('.groups-group-edit-cover-upload .dropzone')[0],
          {
            url: '/api/media',
            previewTemplate: [
              '<div class="dz-preview dz-file-preview">',
                '<div class="dz-image"><img data-dz-thumbnail /></div>',
                '<div class="dz-progress"><span class="dz-upload" data-dz-uploadprogress></span></div>',
                '<div class="dz-error-message"><span data-dz-errormessage></span></div>',
                '<div class="dz-success-mark">✔</div>',
                '<div class="dz-error-mark">✘</div>',
              '</div>'
            ].join(''),
            parallelUploads: 2,
            thumbnailHeight: 90,
            thumbnailWidth: 90,
            maxFilesize: 3,
            filesizeBase: 1000,
            maxFiles: 1,
            params: {
              isGroupCover: true
            }
          }
        ),
        _pageFilterTimeout = null,
        _scrolls = null;

    GroupsGroup.on('changeCover', function() {
      if (!GroupsGroup.get('editMode')) {
        return;
      }

      _dropzone.removeAllFiles();

      GroupsGroup.set('changeCoverOpened', !GroupsGroup.get('changeCoverOpened'));
    });

    GroupsGroup.on('cancelEditGroup', function(event) {
      if (!GroupsGroup.get('editMode') || GroupsGroup.get('saving')) {
        return;
      }

      GroupsGroup.set('editConfirmCallback', null);
      GroupsGroup.set('editCancelCallback', null);

      if (GroupsGroup.get('hasModifications') && !$(event.node).data('confirm')) {
        return GroupsGroup.set('closeConfirm', true);
      }

      _noModifications();
      GroupsGroup.set('closeConfirm', false);

      if (GroupsGroup.get('mode') == GroupsService.MODES.CREATE) {
        return window.page('/create');
      }

      GroupsGroup.set('group', $.extend(true, {}, GroupsGroup.get('groupOrigin')));
      GroupsService.group(GroupsGroup.get('group'));

      window.page(GroupsGroup.get('url'));
    });

    GroupsGroup.on('cancelAskCloseGroup', function() {
      GroupsGroup.set('closeConfirm', false);

      var editCancelCallback = GroupsGroup.get('editCancelCallback');
      GroupsGroup.set('editConfirmCallback', null);
      GroupsGroup.set('editCancelCallback', null);

      if (editCancelCallback) {
        return editCancelCallback();
      }
    });

    GroupsService.onSafe('groupsGroupController.exitConfirmation', function(args) {
      GroupsGroup.set('editConfirmCallback', args.confirmCallback);
      GroupsGroup.set('editCancelCallback', args.cancelCallback);
      GroupsGroup.set('closeConfirm', true);
    });

    GroupsGroup.on('deleteGroup', function(event) {
      if (!GroupsGroup.get('editMode') || GroupsGroup.get('saving')) {
        return;
      }

      if (!$(event.node).data('confirm')) {
        return GroupsGroup.set('deleteConfirm', true);
      }

      GroupsGroup.set('deleteConfirm', false);

      $socket.once('read(groups/group.delete)', function() {
        window.page('/groups');
      });

      $socket.emit('delete(groups/group)', {
        group: {
          id: GroupsGroup.get('group.id')
        }
      });

    });

    GroupsGroup.on('cancelDeleteGroup', function() {
      GroupsGroup.set('deleteConfirm', false);
    });

    GroupsGroup.on('saveGroup', function() {
      if (!GroupsGroup.get('hasModifications')) {
        return;
      }

      _noModifications();
      GroupsGroup.set('saving', true);

      var group = GroupsGroup.get('group');

      GroupsService.fire('beforeSave', {
        group: group
      }, function(results) {
        if (results && results.length) {
          results.forEach(function(result) {
            if (typeof result != 'object') {
              return;
            }

            $.extend(group, result);
          });
        }

        if (!group.id) {
          $socket.once('read(groups/group.new)', function(args) {
            if (!args) {
              return;
            }

            window.page('/groups/' + args.url + '/edit');
          });

          $socket.emit('create(groups/group)', {
            group: group
          });
        }
        else {
          $socket.emit('update(groups/group)', {
            group: group
          });
        }
      });
    });

    function _hasModifications() {
      GroupsService.hasModifications(true);
      GroupsGroup.set('saving', false);
    }

    function _noModifications() {
      GroupsService.hasModifications(false);
      GroupsGroup.set('saving', false);
    }

    _dropzone.on('success', function(file, res) {
      if (file && res && res.url) {
        setTimeout(function() {
          _hasModifications();

          GroupsGroup.set('group.cover', res.cover);
          GroupsGroup.set('group.coverMini', res.coverMini);
          GroupsGroup.set('group.coverThumb', res.coverThumb);
          GroupsGroup.set('group.coverLarge', res.coverLarge);

          GroupsGroup.set('changeCoverOpened', false);

          _dropzone.removeAllFiles();
        }, 2000);
      }
    });

    function _changeGroup(args, callback) {
      GroupsService.group(args.group);

      GroupsGroup.set('closeConfirm', false);
      GroupsGroup.set('deleteConfirm', false);
      GroupsGroup.set('group', args.group);

      _noModifications();

      if (GroupsGroup.get('mode') == GroupsService.MODES.EDIT) {
        _edition();
      }

      _scrolls.update();

      GroupsGroup.require();

      if (callback) {
        callback();
      }
    }

    GroupsService.onSafe('groupsGroupController.hasModifications', function(value) {
      GroupsGroup.set('hasModifications', value);
    });

    GroupsService.onSafe('groupsGroupController.lastLeaderError', function() {
      if (!_lastMemberElement) {
        return;
      }

      _lastMemberElement.fire('lastLeaderError');
    });

    GroupsGroup.observe('group.name', function(value) {
      if (
        !GroupsGroup.get('editMode') ||
        (GroupsGroup.get('mode') == GroupsService.MODES.EDIT && !GroupsGroup.get('groupOrigin')) ||
        (GroupsGroup.get('mode') == GroupsService.MODES.EDIT && value == GroupsGroup.get('groupOrigin.name'))
      ) {
        return;
      }

      if (!value) {
        return _noModifications();
      }

      _hasModifications();
    }, {
      init: false
    });

    GroupsGroup.observe('group.description', function(value) {
      if (
        !GroupsGroup.get('editMode') ||
        (GroupsGroup.get('mode') == GroupsService.MODES.EDIT && !GroupsGroup.get('groupOrigin')) ||
        (GroupsGroup.get('mode') == GroupsService.MODES.EDIT && value == GroupsGroup.get('groupOrigin.description'))
      ) {
        return;
      }

      _hasModifications();
    }, {
      init: false
    });

    function _edition() {
      if (!GroupsGroup.get('group') || (!GroupsGroup.get('group.id') || GroupsGroup.get('mode') == GroupsService.MODES.CREATE)) {
        return;
      }

      GroupsGroup.set('groupOrigin', $.extend(true, {}, GroupsGroup.get('group')));
    }

    function _modeChanged() {
      if (!GroupsGroup) {
        return;
      }

      var mode = GroupsService.mode();

      GroupsGroup.set('groupOrigin', null);
      GroupsGroup.set('mode', mode);
      GroupsGroup.set('editMode', mode == GroupsService.MODES.EDIT || mode == GroupsService.MODES.CREATE);
      _noModifications();

      if (mode == GroupsService.MODES.EDIT) {
        _edition();
      }

      _editFocus();
    }

    function _editFocus() {
      setTimeout(function() {
        _$el.layout.find('.edit-name input').focus();
      });
    }

    GroupsService.onSafe([
      'groupsGroupController.selectMode',
      'groupsGroupController.editMode',
      'groupsGroupController.createMode'
    ].join(' '), _modeChanged);

    GroupsService.onSafe('groupsGroupController.openCreateGroup', function() {
      GroupsGroup.set('group', {
        name: '',
        description: '',
        activeUserisLeader: true
      });

      _edition();

      GroupsGroup.require().then(function() {
        _editFocus();
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
      if (!GroupsGroup) {
        return callback();
      }

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
