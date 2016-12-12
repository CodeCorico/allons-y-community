module.exports = function() {
  'use strict';

  DependencyInjection.service('GroupsService', [
    '$AbstractService', '$socket',
  function($AbstractService, $socket) {

    return new (function GroupsService() {

      $AbstractService.call(this);

      this.MODES = {
        NONE: null,
        SELECT: 'select',
        EDIT: 'edit',
        CREATE: 'create'
      };

      var _this = this,
          _usersFound = null,
          _mode = this.MODES.NONE,
          _groupSelected = null,
          _lastGroup = null;

      this.openGroup = function(url, page) {
        if (_mode == _this.MODES.CREATE) {
          return _this.fire('openCreateGroup');
        }

        _this.fire('openGroup', {
          url: url,
          page: page || null
        });
      };

      this.group = function(group) {
        _this.fire('groupChanged', {
          group: group
        });

        _lastGroup = group;
      };

      this.lastGroup = function() {
        return _lastGroup;
      };

      this.findMembers = function(groupId, search, isLeader, callback) {
        if (!search) {
          return callback([]);
        }

        $socket.once('read(groups/users.search)', function(args) {
          _usersFound = args.users;
          callback(args.users);
        });

        $socket.emit('call(groups/users.search)', {
          groupId: groupId,
          search: search,
          isLeader: isLeader,
          limit: 10
        });
      };

      this.invitMember = function(groupId, email, isLeader, callback) {
        var member = null;

        if (email && _usersFound && _usersFound.length) {
          for (var i = 0; i < _usersFound.length; i++) {
            if (_usersFound[i].email == email) {
              member = _usersFound[i];
              _usersFound = null;

              break;
            }
          }
        }

        if (!member) {
          return callback(false);
        }

        callback(true);

        $socket.emit('create(groups/group.invitation)', {
          groupId: groupId,
          add: email,
          isLeader: isLeader
        });
      };

      $socket.on('read(groups/group.downmember)', function(args) {
        if (args && args.error && args.error == 'last-leader') {
          _this.fire('lastLeaderError');
        }
      });

      $socket.on('read(groups/group.member)', function(args) {
        if (args && args.error && args.error == 'last-leader') {
          _this.fire('lastLeaderError');
        }
      });

      this.becomeMember = function(url, member) {
        $socket.emit('update(groups/group.downmember)', {
          url: url,
          memberId: member.id
        });
      };

      this.removeMember = function(url, member) {
        $socket.emit('delete(groups/group.member)', {
          url: url,
          memberId: member.id
        });
      };

      this.reactivate = function(member) {
        $socket.emit('update(groups/group.deactivated)', {
          memberId: member.id
        });
      };

      this.cancelinvitation = function(url, invitation) {
        $socket.emit('delete(groups/group.invitation)', {
          url: url,
          invitationId: invitation.id
        });
      };

      this.cleanGroups = function(isGroup) {
        return new window.Ractive.Promise(function(fulfil) {
          _this.fire(isGroup ? 'teardownGroups' : 'teardownGroup', null, fulfil);
        });
      };

      this.mode = function(isCreate, isEdit, groupUrl) {
        if (typeof isCreate == 'undefined') {
          return _mode;
        }

        return new window.Ractive.Promise(function(fulfil) {
          if (isCreate) {
            _mode = _this.MODES.CREATE;
            _groupSelected = null;

            _this.fire('createMode');
          }
          else if (isEdit) {
            _mode = _this.MODES.EDIT;
            _groupSelected = groupUrl;

            _this.fire('editMode', {
              url: groupUrl
            });
          }
          else {
            _mode = _this.MODES.SELECT;
            _groupSelected = groupUrl;

            _this.fire('selectMode', {
              url: groupUrl
            });
          }

          _this.fire(groupUrl ? 'teardownGroups' : 'teardownGroup', null, fulfil);
        });
      };

    })();

  }]);

};
