<a name="1.1.0"></a>
# [1.1.0](https://github.com/CodeCorico/allons-y-community/compare/1.0.15...1.1.0) (2017-01-18)

### Features
* **groups:** move the members lists and permissions to a new right context [#16e27af](https://github.com/CodeCorico/allons-y-community/commit/16e27af)
* **groups:** create/delete/update groups feature [#98a134e](https://github.com/CodeCorico/allons-y-community/commit/98a134e)
* **groups:** flush permissions after update them [#e8a5e7f](https://github.com/CodeCorico/allons-y-community/commit/e8a5e7f)
* **groups:** send notification on leaders when the permissions has changed [#c8587d1](https://github.com/CodeCorico/allons-y-community/commit/c8587d1)
* **groups group model:** send a notification to the group's members [#57023de](https://github.com/CodeCorico/allons-y-community/commit/57023de)

### Bug Fixes
* **groups group event:** don't stop adding invitations for the special deactivated group [#d5fd1e3](https://github.com/CodeCorico/allons-y-community/commit/d5fd1e3)

<a name="1.0.15"></a>
# [1.0.15](https://github.com/CodeCorico/allons-y-community/compare/1.0.14...1.0.15) (2016-11-29)

### Features
* **users index:** don't display the user signin on prerender view [#628899d](https://github.com/CodeCorico/allons-y-community/commit/628899d)

<a name="1.0.14"></a>
# [1.0.14](https://github.com/CodeCorico/allons-y-community/compare/1.0.13...1.0.14) (2016-11-24)

### Features
* **groups:** add the possibility to downgrade a leader to a member [#fb9c0c8](https://github.com/CodeCorico/allons-y-community/commit/fb9c0c8)
* **groups:** add the possibility to remove a member [#8297ec4](https://github.com/CodeCorico/allons-y-community/commit/8297ec4)
* **groups:** add the possibility to cancel an invitation [#c44570e](https://github.com/CodeCorico/allons-y-community/commit/c44570e)
* **groups:** add the possibility to reactivate a deactivated member [#495e89c](https://github.com/CodeCorico/allons-y-community/commit/495e89c)
* **groups:** block the possibility to remove the last leader [#22c02b3](https://github.com/CodeCorico/allons-y-community/commit/22c02b3)

<a name="1.0.13"></a>
# [1.0.13](https://github.com/CodeCorico/allons-y-community/compare/1.0.12...1.0.13) (2016-11-21)

### Features
* **groups:** create the members, leaders, invitations and deactivated pages [#a4a0cc1](https://github.com/CodeCorico/allons-y-community/commit/a4a0cc1)

<a name="1.0.12"></a>
# [1.0.12](https://github.com/CodeCorico/allons-y-community/compare/1.0.11...1.0.12) (2016-11-08)

### Features
* **users user model:** display the connected members metric only for members-access permission [#99782fd](https://github.com/CodeCorico/allons-y-community/commit/99782fd)

<a name="1.0.11"></a>
# [1.0.11](https://github.com/CodeCorico/allons-y-community/compare/1.0.10...1.0.11) (2016-11-07)

### Bug Fixes
* **groups group model:** disable the unused web create link [#e896f51](https://github.com/CodeCorico/allons-y-community/commit/e896f51)
* **groups group model:** check if the group exists before changing its name [#13de241](https://github.com/CodeCorico/allons-y-community/commit/13de241)
* **users socketio:** always insert the socket duration on the closing log [#72a7400](https://github.com/CodeCorico/allons-y-community/commit/72a7400)

<a name="1.0.10"></a>
# [1.0.10](https://github.com/CodeCorico/allons-y-community/compare/1.0.9...1.0.10) (2016-11-06)

### Features
* **users user model:** add the "members-access" permission [#df7cc79](https://github.com/CodeCorico/allons-y-community/commit/df7cc79)

### Bug Fixes
* **groups group model:** extend member group when adding it to the deactivated members [#62ee1a8](https://github.com/CodeCorico/allons-y-community/commit/62ee1a8)
* **groups group model:** don't display empty member's groups [#350423b](https://github.com/CodeCorico/allons-y-community/commit/350423b)
* **groups group item:** check the "as leader" with indexOf() [#b724460](https://github.com/CodeCorico/allons-y-community/commit/b724460)
* **members route:** don't display a member if no "members-access" permission [#5ea62ea](https://github.com/CodeCorico/allons-y-community/commit/5ea62ea)

<a name="1.0.9"></a>
# [1.0.9](https://github.com/CodeCorico/allons-y-community/compare/1.0.8...1.0.9) (2016-11-06)

### Bug Fixes
* **users user model:** use force in canSignup & canSignin methods [#e3c0909](https://github.com/CodeCorico/allons-y-community/commit/e3c0909)

<a name="1.0.8"></a>
# [1.0.8](https://github.com/CodeCorico/allons-y-community/compare/1.0.7...1.0.8) (2016-11-04)

### Features
* **users:** add the possibility to activate the Google Recaptcha for the signup [#0fdba81](https://github.com/CodeCorico/allons-y-community/commit/0fdba81)

<a name="1.0.7"></a>
# [1.0.7](https://github.com/CodeCorico/allons-y-community/compare/1.0.6...1.0.7) (2016-11-04)

### Features
* **users user model:** add the createAndSignin() method [#369cde0](https://github.com/CodeCorico/allons-y-community/commit/369cde0)
* **users user model:** add signin and signup external conditions [#04d23e2](https://github.com/CodeCorico/allons-y-community/commit/04d23e2)

### Bug Fixes
* **users index:** display the "offline" indicator for an unknown user [#36e6b31](https://github.com/CodeCorico/allons-y-community/commit/36e6b31)
* **users user model:** remove useless "session" param [#fc733f0](https://github.com/CodeCorico/allons-y-community/commit/fc733f0)
* **users user model:** make the createUser() forced more usable [#e97afcb](https://github.com/CodeCorico/allons-y-community/commit/e97afcb)

<a name="1.0.6"></a>
# [1.0.6](https://github.com/CodeCorico/allons-y-community/compare/1.0.5...1.0.6) (2016-10-28)

### Features
* **users:** add rounded favicon avatar thumbnail and display it in the member page [#c32a62a](https://github.com/CodeCorico/allons-y-community/commit/c32a62a)

<a name="1.0.5"></a>
# [1.0.5](https://github.com/CodeCorico/allons-y-community/compare/1.0.4...1.0.5) (2016-10-27)

### Features
* **users:** capitalize new member's name [#3ddb911](https://github.com/CodeCorico/allons-y-community/commit/3ddb911)

### Bug Fixes
* **users:** remove useless permissions for /api/users/signin-socket [#3cde7e3](https://github.com/CodeCorico/allons-y-community/commit/3cde7e3)

<a name="1.0.4"></a>
# [1.0.4 Allonzo](https://github.com/CodeCorico/allons-y-community/releases/tag/1.0.4) (2016-10-24)

### Features
* **community:** First version
