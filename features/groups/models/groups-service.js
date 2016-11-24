module.exports = function() {
  'use strict';

  DependencyInjection.service('GroupsService', [
    '$AbstractService', '$socket',
  function($AbstractService, $socket) {

    return new (function GroupsService() {

      $AbstractService.call(this);

      var _this = this,
          _usersFound = null;

      this.inGroups = function(inGroups) {
        return new window.Ractive.Promise(function(fulfil) {
          _this.fire(inGroups ? 'teardownGroups' : 'teardownGroup', null, fulfil);
        });
      };

      this.openGroup = function(url, page) {
        _this.fire('openGroup', {
          url: url,
          page: page || null
        });
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

    })();

  }]);

};
