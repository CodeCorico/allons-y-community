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

      this.openGroup = function(url) {
        _this.fire('openGroup', {
          url: url
        });
      };

      // this.updateWinChartCount = function(feature) {
      //   $socket.emit('update(win-chart/chart)', {
      //     feature: feature
      //   });
      // };

      this.findMembers = function(groupId, search, isLeader, callback) {
        if (!search) {
          return callback([]);
        }

        $socket.once('read(groups/users.seach)', function(args) {
          _usersFound = args.users;
          callback(args.users);
        });

        $socket.emit('call(groups/users.seach)', {
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

    })();

  }]);

};
