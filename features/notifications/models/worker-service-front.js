'use strict';
/*globals self, clients, Headers */

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var data = (event.notification.data || 'null:null:null').split(':'),
      id = data[0] == 'null' ? null : data[0],
      user = data[1] == 'null' ? null : data[1],
      url = data[2] == 'null' ? null : data[2];

  fetch('/api/users/user-notification-action', {
    method: 'POST',
    mode: 'cors',
    headers: new Headers({
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    }),
    body: 'id=' + id + '&user=' + user
  });

  if (!url) {
    return;
  }

  return clients.openWindow(url);
});

self.addEventListener('push', function(event) {
  var payload = event.data ? event.data.text() : null;

  if (payload) {
    try {
      payload = JSON.parse(payload);
    }
    catch (err) {
      payload = null;
    }
  }

  if (!payload) {
    return;
  }

  payload.icon = location.protocol + '//' + location.host + payload.icon;

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      icon: payload.icon,
      body: payload.body,
      data: (payload.id || 'null') + ':' + (payload.user || 'null') + ':' + (payload.action || 'null')
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});
