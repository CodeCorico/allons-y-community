(function() {
  'use strict';

  window.Ractive.controllerInjection('users-sign-context', [
    '$Page', '$i18nService', '$BodyDataService', '$socket', '$component', '$data', '$done',
  function usersSignContext(
    $Page, $i18nService, $BodyDataService, $socket, $component, $data, $done
  ) {
    var _web = $Page.get('web'),
        _user = $BodyDataService.data('user'),
        UsersSignContext = $component({
          data: $.extend(true, {
            canSignup: _user.permissionsPublic.indexOf('members-signup') > -1,
            useRecaptcha: _web.useRecaptcha || false,
            membersNeedsLeader: _user.membersNeedsLeader || false,
            membersLeader: _user.membersNeedsLeader || false,
            signinAvatars: null,
            signinAvatarsNew: null
          }, $data)
        }),
        _errors = {
          filled: $i18nService._('Please fill all the fields.'),
          email: $i18nService._('Please enter a valid email address.'),
          validemail: $i18nService._('Please use the same email address on both email fields.'),
          validpassword: $i18nService._('Please use the same password on both fields.'),
          exists: $i18nService._('This email address is already registered for a member.'),
          noexists: $i18nService._('This email address is not registered for a member.'),
          credentials: $i18nService._('Bad email/password credentials.'),
          signuppermission: $i18nService._('You don\'t have the permission to signup.'),
          signinpermission: $i18nService._('You don\'t have the permission to signin.'),
          forgotpermission: $i18nService._('You don\'t have the permission to create a new password.'),
          deactivated: $i18nService._('Your account has been deactivated.'),
          captcha: $i18nService._('Our anti-bot system thinks you\'re a bot. Maybe you didn\'t know.'),
          password: $i18nService._([
            'Please use a password more secured:',
            '<ol>',
              '<li>It must not contain your name.</li>',
              '<li>It must contain one or more digits.</li>',
              '<li>It is recommended to mix lowercase and uppercase characters.</li>',
              '<li>It should be long over 7 characters.</li>',
            '</ol>'
          ].join(''))
        },
        _$el = {
          layout: $(UsersSignContext.el)
        },
        _searchAvatarTimeout = null,
        _lastSearchAvatarEmail = null;

    if (_web.useRecaptcha) {
      window.usersRecaptcha = function() {
        window.grecaptcha.render($(UsersSignContext.el).find('.g-recaptcha')[0], {
          sitekey: _web.recaptchaKey,
          theme: 'dark'
        });
      };

      require('https://www.google.com/recaptcha/api.js?onload=usersRecaptcha&render=explicit');
    }

    function _message(message, cls) {
      message = _errors[message] ? _errors[message] : message;

      UsersSignContext.set('messageCls', cls);
      UsersSignContext.set('message', message);
      UsersSignContext.set('messageSB', 'message-sb-1');

      setTimeout(function() {
        if (!UsersSignContext) {
          return;
        }

        UsersSignContext.set('messageSB', 'message-sb-2');

        setTimeout(function() {
          if (!UsersSignContext) {
            return;
          }

          UsersSignContext.set('messageSB', null);
          UsersSignContext.set('message', null);
        }, 550);
      }, 3550);
    }

    function _error(message) {
      _message(message, 'error');
    }

    function _success(message) {
      _message(message, 'success');
    }

    function _welcome(user, back) {
      UsersSignContext.set('welcomeSB', 'welcome-sb-1');

      UsersSignContext.require('pl-messages-message').then(function() {
        var Message = UsersSignContext.findChild('name', 'pl-messages-message');

        Message.fire('reset');

        setTimeout(function() {
          if (!Message) {
            return;
          }

          Message.fire('play', {
            message: $i18nService._('Welcome' + (back ? ' back' : '') + ' <strong>' + user.firstname + '</strong>'),
            callback: function() {
              location.reload();
            },
            displayWordTime: 250,
            displayTextTime: 1500,
            freezeLastLine: true
          });
        }, 500);
      });
    }

    function _changeAvatar(avatars) {
      UsersSignContext.set('signinAvatarsNew', avatars || null);
      setTimeout(function() {
        UsersSignContext.set('signinNewAvatar', true);
        setTimeout(function() {
          UsersSignContext.set('signinAvatars', avatars || null);
          UsersSignContext.set('signinNewAvatar', false);
        }, 350);
      });
    }

    function _searchAvatar() {
      var email = UsersSignContext.get('signinEmail');

      if (email === _lastSearchAvatarEmail) {
        return;
      }
      _lastSearchAvatarEmail = email;

      if (!email) {
        return _changeAvatar(null);
      }

      $socket.once('read(users/avatar)', function(args) {
        if (!args.avatars && !UsersSignContext.get('signinAvatars')) {
          return;
        }

        _changeAvatar(args.avatars);
      });

      $socket.emit('call(users/avatar)', {
        email: email
      });
    }

    UsersSignContext.observe('signinEmail', function() {
      clearTimeout(_searchAvatarTimeout);
      _searchAvatarTimeout = setTimeout(_searchAvatar, 500);
    }, {
      init: false
    });

    UsersSignContext.on('backSignin', function() {
      UsersSignContext.set('inPanel', null);
    });

    UsersSignContext.on('toggleForgot', function() {
      UsersSignContext.set('inPanel', UsersSignContext.get('inPanel') == 'forgot' ? null : 'forgot');

      setTimeout(function() {
        if (!UsersSignContext) {
          return;
        }

        _$el.layout.find('[name="' + (UsersSignContext.get('inPanel') == 'forgot' ? 'emailForgot' : 'emailSignin') + '"]').focus();
      }, 350);
    });

    UsersSignContext.on('toggleSignup', function() {
      UsersSignContext.set('inPanel', UsersSignContext.get('inPanel') == 'signup' ? null : 'signup');

      setTimeout(function() {
        if (!UsersSignContext) {
          return;
        }

        _$el.layout.find('[name="' + (UsersSignContext.get('inPanel') == 'signup' ? 'firstnameSignup' : 'emailSignin') + '"]').focus();
      }, 350);
    });

    function _readForgotPassword(args) {
      if (!args || !UsersSignContext) {
        return;
      }

      if (args.error) {
        _error(args.error);

        return;
      }

      UsersSignContext.set('inPanel', null);

      setTimeout(function() {
        _success($i18nService._('Your new password has been registered!'));
      }, 350);
    }

    UsersSignContext.on('forgotPasswordPress', function(event) {
      var charCode = event.original.charCode ? event.original.charCode : event.original.keyCode;

      // Enter
      if (charCode == 13) {
        UsersSignContext.fire('forgotPassword');
      }
    });

    UsersSignContext.on('forgotPassword', function() {
      var data = {},
          err = null;

      ['password', 'validpassword'].forEach(function(field) {
        data[field] = _$el.layout.find('[name="' + field + 'Forgot"]').val();

        if (!data[field]) {
          err = $i18nService._('Please fill the ' + field + ' field.');
        }
      });

      if (data.password != data.validpassword) {
        return _error('validpassword');
      }

      delete data.validpassword;

      if (err) {
        return _error(err);
      }

      data.email = UsersSignContext.get('forgotEmail');
      data.code = UsersSignContext.get('forgotCode');

      $.post('/api/users/forgotpassword', data, _readForgotPassword);
    });

    function _readForgotCode(args) {
      if (!args || !UsersSignContext) {
        return;
      }

      if (args.error) {
        _error(args.error);

        return;
      }

      if (args.code) {
        UsersSignContext.set('forgotCode', args.code);
        UsersSignContext.set('inPanel', 'forgot-password');

        setTimeout(function() {
          _$el.layout.find('[name="passwordForgot"]').focus();
        }, 350);
      }
    }

    UsersSignContext.on('forgotCodePress', function(event) {
      var charCode = event.original.charCode ? event.original.charCode : event.original.keyCode;

      // Enter
      if (charCode == 13) {
        UsersSignContext.fire('forgotCode');
      }
    });

    UsersSignContext.on('forgotCode', function() {
      var data = {},
          err = null;

      ['code'].forEach(function(field) {
        data[field] = _$el.layout.find('[name="' + field + 'Forgot"]').val();

        if (!data[field]) {
          err = $i18nService._('Please fill the ' + field + ' field.');
        }
      });

      if (err) {
        return _error(err);
      }

      data.email = UsersSignContext.get('forgotEmail');

      $.post('/api/users/forgotcode', data, _readForgotCode);
    });

    function _readForgot(args) {
      if (!args || !UsersSignContext) {
        return;
      }

      if (args.error) {
        _error(args.error);

        return;
      }

      if (args.email) {
        UsersSignContext.set('forgotEmail', args.email);
        UsersSignContext.set('inPanel', 'forgot-code');

        setTimeout(function() {
          _$el.layout.find('[name="codeForgot"]').focus();
        }, 350);
      }
    }

    UsersSignContext.on('forgotPress', function(event) {
      var charCode = event.original.charCode ? event.original.charCode : event.original.keyCode;

      // Enter
      if (charCode == 13) {
        UsersSignContext.fire('forgot');
      }
    });

    UsersSignContext.on('forgot', function() {
      var data = {},
          err = null;

      ['email'].forEach(function(field) {
        data[field] = _$el.layout.find('[name="' + field + 'Forgot"]').val();

        if (!data[field]) {
          err = $i18nService._('Please fill the ' + field + ' field.');
        }
      });

      if (err) {
        return _error(err);
      }

      $.post('/api/users/forgot', data, _readForgot);
    });

    function _readSignin(args) {
      if (!args || !UsersSignContext) {
        return;
      }

      if (args.error) {
        _error(args.error);

        _$el.layout.find('[name="passwordSignin"]').val('');

        return;
      }

      _welcome(args.user, true);
    }

    UsersSignContext.on('signinPress', function(event) {
      var charCode = event.original.charCode ? event.original.charCode : event.original.keyCode;

      // Enter
      if (charCode == 13) {
        UsersSignContext.fire('signin');
      }
    });

    UsersSignContext.on('signin', function() {
      var data = {},
          err = null;

      ['email', 'password'].forEach(function(field) {
        data[field] = _$el.layout.find('[name="' + field + 'Signin"]').val();

        if (!data[field]) {
          err = $i18nService._('Please fill the ' + field + ' field.');
        }
      });

      if (err) {
        return _error(err);
      }

      $.post('/api/users/signin', data, _readSignin);
    });

    function _readSignup(args) {
      if (!args || !UsersSignContext) {
        return;
      }

      if (args.error) {
        _error(args.error);

        _$el.layout.find('[name="passwordSignup"]').val('');

        return;
      }

      if (args.codeNeeded) {
        UsersSignContext.set('inPanel', 'signup-code');

        setTimeout(function() {
          _$el.layout.find('[name="codeSignup"]').focus();
        }, 350);
      }
      else {
        _welcome(args.user);
      }
    }

    UsersSignContext.on('signupPress', function(event) {
      var charCode = event.original.charCode ? event.original.charCode : event.original.keyCode;

      // Enter
      if (charCode == 13) {
        UsersSignContext.fire('signup');
      }
    });

    UsersSignContext.on('signup', function() {
      var data = {},
          err = null;

      ['firstname', 'lastname', 'email', 'validemail', 'password'].forEach(function(field) {
        data[field] = _$el.layout.find('[name="' + field + 'Signup"]').val();

        if (!err && !data[field]) {
          err = $i18nService._('Please fill the ' + field + ' field.');
        }
      });

      if (err) {
        return _error(err);
      }

      if (data.email != data.validemail) {
        return _error('validemail');
      }

      delete data.validemail;

      if (_web.useRecaptcha) {
        data.captcha = window.grecaptcha.getResponse();

        if (!data.captcha) {
          return _error($i18nService._('Please use the anti-bot verification.'));
        }
      }

      if (UsersSignContext.get('membersLeader')) {
        data.membersLeader = true;
      }

      $.post('/api/users/signup', data, _readSignup);
    });

    UsersSignContext.on('signupCodePress', function(event) {
      var charCode = event.original.charCode ? event.original.charCode : event.original.keyCode;

      // Enter
      if (charCode == 13) {
        UsersSignContext.fire('signupCode');
      }
    });

    UsersSignContext.on('signupCode', function() {
      var data = {},
          err = null;

      ['code'].forEach(function(field) {
        data[field] = _$el.layout.find('[name="' + field + 'Signup"]').val();

        if (!data[field]) {
          err = $i18nService._('Please fill the ' + field + ' field.');
        }
      });

      if (err) {
        return _error(err);
      }

      ['firstname', 'lastname', 'email', 'password'].forEach(function(field) {
        data[field] = _$el.layout.find('[name="' + field + 'Signup"]').val();
      });

      if (UsersSignContext.get('membersLeader')) {
        data.membersLeader = true;
      }

      $.post('/api/users/signup', data, _readSignup);
    });

    UsersSignContext.on('teardown', function() {
      UsersSignContext = null;
      _$el = null;
    });

    UsersSignContext.require().then(function() {
      setTimeout(function() {
        if (!UsersSignContext) {
          return;
        }

        _$el.layout.find('[name="emailSignin"]').focus();
      }, 1000);

      $done();
    });

  }]);

})();
