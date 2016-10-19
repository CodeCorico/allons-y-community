'use strict';

module.exports = [{
  method: 'POST',
  url: 'users/signin',
  permissions: ['members-signin'],
  controller: function($req, $res, UserModel) {
    if (!this.validMessage($req.body, {
      email: ['string', 'filled'],
      password: ['string', 'filled']
    })) {
      return $res.send({
        error: 'filled'
      });
    }

    UserModel.signin($req.body.email, $req.body.password, function(err, user, session) {
      if (err) {
        return $res.send({
          error: err
        });
      }

      $res.cookie('session', session.session, {
        maxAge: session.duration,
        signed: true
      });

      return $res.send({
        user: user.ownPublicData()
      });
    });
  }
}, {
  method: 'POST',
  url: 'users/signout',
  controller: function($req, $res, UserModel) {
    UserModel.signout($req.signedCookies.session || null, function(err) {
      if (err) {
        return $res.send({
          error: err
        });
      }

      $res.clearCookie('session');

      return $res.send({
        success: true
      });
    });
  }
}, {
  method: 'POST',
  url: 'users/signup',
  permissions: ['members-signout'],
  controller: function($req, $res, $WebService, UserModel) {
    if (!this.validMessage($req.body, {
      firstname: ['string', 'filled'],
      lastname: ['string', 'filled'],
      email: ['string', 'filled'],
      password: ['string', 'filled']
    })) {
      return $res.send({
        error: 'filled'
      });
    }

    if (!$WebService.validateEmail($req.body.email)) {
      return $res.send({
        error: 'email'
      });
    }

    if (!UserModel.validatePassword($req.body.password, $req.body)) {
      return $res.send({
        error: 'password'
      });
    }

    UserModel.createUser($req.body, function(err, user, session) {
      if (err) {
        if (err == 'code sent') {
          return $res.send({
            codeNeeded: true
          });
        }

        return $res.send({
          error: err
        });
      }

      $res.cookie('session', session.session, {
        maxAge: session.duration,
        signed: true
      });

      return $res.send({
        user: user.ownPublicData()
      });
    });
  }
}, {
  method: 'POST',
  url: 'users/forgot',
  permissions: ['members-signin'],
  controller: function($req, $res, UserModel) {
    if (!this.validMessage($req.body, {
      email: ['string', 'filled']
    })) {
      return $res.send({
        error: 'filled'
      });
    }

    UserModel.forgot($req.body.email, function(err, email) {
      if (err) {
        return $res.send({
          error: err
        });
      }

      return $res.send({
        email: email
      });
    });
  }
}, {
  method: 'POST',
  url: 'users/forgotcode',
  permissions: ['members-signin'],
  controller: function($req, $res, UserModel) {
    if (!this.validMessage($req.body, {
      email: ['string', 'filled'],
      code: ['string', 'filled']
    })) {
      return $res.send({
        error: 'filled'
      });
    }

    UserModel.forgotCode($req.body.email, $req.body.code, function(err, email, code) {
      if (err) {
        return $res.send({
          error: err
        });
      }

      return $res.send({
        email: email,
        code: code
      });
    });
  }
}, {
  method: 'POST',
  url: 'users/forgotpassword',
  permissions: ['members-signin'],
  controller: function($req, $res, UserModel) {
    if (!this.validMessage($req.body, {
      email: ['string', 'filled'],
      code: ['string', 'filled'],
      password: ['string', 'filled']
    })) {
      return $res.send({
        error: 'filled'
      });
    }

    UserModel.forgotPassword($req.body.email, $req.body.code, $req.body.password, function(err) {
      if (err) {
        return $res.send({
          error: err
        });
      }

      return $res.send({
        success: true
      });
    });
  }
}];
