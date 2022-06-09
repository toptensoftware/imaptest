## BUGS

- No content shown immediately after login
- Error recovery in MessageFetcher
- Mail delivery failures not showing content
- Mail delivery daemon display name missing in conversation list
- Color detection only working on styles, not color/bg color attrib
- Color detection not checking for background styles

## TODO

- Show progress or explaination during first login delay
- Show CC recipients on messages
- Show + download attachments
- Make sure links in emails have target="_blank"
- Collapse gmail-quotes to <detail> sections
- Allow some fore colors if in contrast to current background
- Block quote colors (see Re: Another Message)
- Auto refresh every minute

## UI TODO

- read/unread icons
- next/previous buttons on message view
- page indicators
- report spam button
- delete forever when in Trash/Spam
- empty trash/spam
- click outside to close sidebar popup

## Material Symbols

inbox
stars
snooze
label_important
send
schedule_send
draft
mail
settings
archive
move_to_inbox
drive_file_move_outline
block (for spam)
check
check_box
check_box_outline_blank
indeterminate_check_box
close
mark_as_unread
chevron_left
keyboard_arrow_left
menu
display_settings


https://marella.me/material-symbols/demo/

https://glyphsearch.com

## Text editor

* https://quilljs.com

## HTML Sanitizing

* https://www.npmjs.com/package/sanitize-html 
* https://www.w3schools.com/tags/att_iframe_sandbox.asp
* https://blog.chromium.org/2010/05/security-in-depth-html5s-sandbox.html (detect support for iframe sandbox)
* https://stackoverflow.com/questions/27852405/html-attributes-that-can-contain-javascript
* https://www.npmjs.com/package/css (css parser to find url() url(javascript:) styles)

## Content Encoding

* https://www.npmjs.com/package/http-encoding
* https://www.npmjs.com/package/quoted-printable

## Dark Mode

* invert content for dark mode: https://giancarlobuomprisco.com/css/automatic-dark-mode-any-website
* getting css value in javascript: https://zellwk.com/blog/css-values-in-js/
  (perhaps use this to determine if selected theme is dark/light and whether to try to modify email presentation)

## API 

* CSRF

    * https://portswigger.net/web-security/csrf/samesite-cookies
    * https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#cookie-with-__host-prefix

* REST APIs:
    * https://stackoverflow.blog/2020/03/02/best-practices-for-rest-api-design/
    * https://stackoverflow.blog/2021/10/06/best-practices-for-authentication-and-authorization-for-rest-apis/


## Security

Local storage vs cookies: https://dev.to/rdegges/please-stop-using-local-storage-1i04

Content Security Policy: https://michaelzanggl.com/articles/web-security-xss/#content-security-policy-csp



## Unsubscribe Header:

"List-Unsubscribe":


## Threading

https://www.jwz.org/doc/threading.html


## Email Body Structure

https://bowaggoner.com/bomail/writeups/mimes.html

http://sgerwk.altervista.org/imapbodystructure.html

