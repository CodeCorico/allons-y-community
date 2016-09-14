'use strict';

module.exports = function vendorDependencies($manifest) {
  // jscs:disable requireCamelCaseOrUpperCaseIdentifiers

  if (process.env.USERS_GCM && process.env.USERS_GCM == 'true') {
    $manifest.gcm_sender_id = process.env.USERS_GCM_API_PROJECT_ID;
  }

};
