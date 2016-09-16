'use strict';

module.exports = function($server) {

  $server.apiFilter(function(req, res, config) {
    if ((config.isMember || config.url == 'media') && (!req.user || !req.user.id)) {
      res.sendStatus(403);

      return false;
    }

    if (config.permissions && config.permissions.length) {
      if (!req.user || !req.user.id || !req.user.hasPermissions(config.permissions)) {
        res.sendStatus(403);

        return false;
      }
    }

    return true;
  });

};
