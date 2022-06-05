const Sanitize = require('./lib/Sanitize');
let assert = require('assert');

let dirty = `
<html>
<body>
<h1>Heading</h1>
<hr />
<img src="/stuff.png" />
</body>
</html>
`;

dirty = "<html><head><meta http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\" /></head><body style='font-size: 10pt; font-family: Verdana,Geneva,sans-serif'>\r\n<p>Forwarding</p>\r\n<p><br /></p>\r\n<div id=\"signature\"></div>\r\n<p><br /></p>\r\n<p>-------- Original Message --------</p>\r\n<table border=\"0\" cellspacing=\"0\" cellpadding=\"0\">\r\n<tbody>\r\n<tr>\r\n<th align=\"right\" valign=\"baseline\" nowrap=\"nowrap\">Subject:</th>\r\n<td>Test message with attachments and images</td>\r\n</tr>\r\n<tr>\r\n<th align=\"right\" valign=\"baseline\" nowrap=\"nowrap\">Date:</th>\r\n<td>09/05/2022 6:21 pm</td>\r\n</tr>\r\n<tr>\r\n<th align=\"right\" valign=\"baseline\" nowrap=\"nowrap\">From:</th>\r\n<td>Brad Robinson &lt;brobinson@toptensoftware.com&gt;</td>\r\n</tr>\r\n<tr>\r\n<th align=\"right\" valign=\"baseline\" nowrap=\"nowrap\">To:</th>\r\n<td>Brad &lt;brad@rocketskeleton.com&gt;</td>\r\n</tr>\r\n</tbody>\r\n</table>\r\n<p><br /></p>\r\n<div id=\"forwardbody1\">\r\n<div dir=\"ltr\">This is an image:\r\n<div>&nbsp;</div>\r\n<div><img src=\"cid:16521063656279247d2eaa9993398000@rocketskeleton.com\" alt=\"image.png\" width=\"472\" height=\"185\" /></div>\r\n<div>&nbsp;</div>\r\n<div>and another:</div>\r\n<div>&nbsp;</div>\r\n<div><img src=\"cid:16521063656279247d2eb58855795534@rocketskeleton.com\" alt=\"image.png\" width=\"472\" height=\"352\" /></div>\r\n<div>&nbsp;</div>\r\n<div>And some attachments:</div>\r\n</div>\r\n</div>\r\n</body></html>\r\n"


let clean = Sanitize.Html(dirty);

console.log(clean);

