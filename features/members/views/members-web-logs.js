(function() {
  'use strict';

  window.Ractive.controllerInjection('members-web-logs', [
    '$WebLogsService', '$Page', '$el', '$done',
  function membersWebLogsController($WebLogsService, $Page, $el, $done) {

    var WebLogsLayout = window.Ractive.findRequireByEl($el.parent().parent()[0]),
        $layout = $el.parent().find('.web-logs-layout'),
        _memberGraphMode = false,
        _members = [],
        _chartWidth = 0;

    $WebLogsService.onSafe('membersWebLogsController.teardown', function() {
      WebLogsLayout = null;
      $layout = null;

      setTimeout(function() {
        $WebLogsService.offNamespace('membersWebLogsController');
      });
    });

    $WebLogsService.onSafe('webLogsLayoutController.readLogs', function(args) {
      if (args.error || !args.logs) {
        return;
      }

      _members = [];
      _chartWidth = _memberGraphMode ? 10 : 0;

      args.logs.forEach(function(log) {
        var memberIndex = null;

        if (log.userEmail) {
          log.avatarMini = $Page.get('avatar')(log.userAvatarMini);
        }

        if (_memberGraphMode && log.userEmail) {
          var clientId = log.clientId || null,
              hasClient = false;

          for (var i = 0; i < _members.length; i++) {
            if (_members[i].email == log.userEmail) {
              memberIndex = i;

              break;
            }
          }

          if (memberIndex === null) {
            _members.push({
              name: log.userName,
              email: log.userEmail,
              picture: log.userAvatarMini,
              width: 0,
              clients: [],
              lastActionIndex: null
            });
            memberIndex = _members.length - 1;
          }
          else if (!_members[memberIndex].picture && log.userAvatarMini) {
            _members[memberIndex].picture = log.userAvatarMini;
          }

          for (var i = 0; i < _members[memberIndex].clients.length; i++) {
            if (_members[memberIndex].clients[i] === clientId) {
              hasClient = true;

              break;
            }
          }

          if (!hasClient) {
            if (clientId === null) {
              _members[memberIndex].clients.unshift(clientId);
            }
            else {
              _members[memberIndex].clients.push(clientId);
            }

            _members[memberIndex].width += 30;
            _chartWidth += 30;
          }
        }
      });

      _members.forEach(function(member) {
        member.picture = $Page.get('avatar')(member.picture);
        member.clients.reverse();

        if (member.clients[member.clients.length - 1] === null) {
          member.clients.unshift(member.clients.pop());
        }
      });

      _members.reverse();
    }, 'high');

    $WebLogsService.onSafe('webLogsLayoutController.readLogs', function() {
      WebLogsLayout.set('members', _members);
      WebLogsLayout.set('chartWidth', _chartWidth);
    }, 'low');

    $WebLogsService.onSafe('membersWebLogsController.search', function(args) {
      _memberGraphMode = args.fields.user || args.fields.userName ? true : false;

      $layout[_memberGraphMode ? 'addClass' : 'removeClass']('web-logs-layout-member-graph');
    });

    $WebLogsService.logConverter(function(log) {
      if (log.userName) {
        log.label = '<span class="avatar" style="background-image: url(\'' + log.avatarMini + '\');" title="' + log.userName + '"></span> ' + log.label;
      }

      log.chartIndexes = 0;

      if (_memberGraphMode && log.userEmail) {
        log.memberGraph = [];

        _members.forEach(function(member) {
          member.clients.forEach(function(client) {
            var graphItem = {
              clientNull: !client,
              action: member.email == log.userEmail && client == log.clientId,
              previousActionIndex: member.lastActionIndex !== null ? member.lastActionIndex : log.memberGraph.length,
              directBar: member.email != log.userEmail && member.lastActionIndex === log.memberGraph.length
            };

            if (member.email == log.userEmail && client == log.clientId) {
              member.lastActionIndex = log.memberGraph.length;
            }

            log.memberGraph.push(graphItem);
          });
        });
      }
    });

    $done();
  }]);

})();
