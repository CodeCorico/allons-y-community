'use strict';

module.exports = [{
  event: 'call(groups/groups.autocomplete)',
  isMember: true,
  controller: function($socket, GroupModel, $message) {
    if (!this.validMessage($message, {
      name: ['string', 'filled']
    })) {
      return;
    }

    GroupModel.autocomplete($socket.user, $message.name, $message.excludes, function(err, groups) {
      groups = err || !groups ? null : groups;

      $socket.emit('read(groups/groups.autocomplete)', {
        groups: groups
      });
    });
  }
}];
