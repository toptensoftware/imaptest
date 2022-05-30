
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import useAppState from './AppState';
import { set } from 'pinia/node_modules/vue-demi';
import 'material-symbols';

const app = createApp(App)
app.use(router)
app.use(createPinia());

const state = useAppState();

router.beforeResolve((to) => {

    state.setRouteState(to.params);
    document.title = state.pageTitle;

});

app.mount('#app')


/*
text editor: https://quilljs.com

html sanitizing: 
    https://www.npmjs.com/package/sanitize-html 
    https://www.w3schools.com/tags/att_iframe_sandbox.asp
    https://blog.chromium.org/2010/05/security-in-depth-html5s-sandbox.html (detect support for iframe sandbox)
    https://stackoverflow.com/questions/27852405/html-attributes-that-can-contain-javascript
    https://www.npmjs.com/package/css (css parser to find url() url(javascript:) styles)

content encoding: https://www.npmjs.com/package/http-encoding

quoted printable: https://www.npmjs.com/package/quoted-printable

invert content for dark mode: https://giancarlobuomprisco.com/css/automatic-dark-mode-any-website

getting css value in javascript: https://zellwk.com/blog/css-values-in-js/
    (perhaps use this to determine if selected theme is dark/light and whether to try to modify email presentation)

preventing csrf https://portswigger.net/web-security/csrf/samesite-cookies

rest apis:
    * https://stackoverflow.blog/2020/03/02/best-practices-for-rest-api-design/
    * https://stackoverflow.blog/2021/10/06/best-practices-for-authentication-and-authorization-for-rest-apis/

*/

/*

TODO:

- read/unread icons
- next/previous buttons on message view
- page indicators
- report spam button
- delete forever when in Trash/Spam
- empty trash/spam
- click outside to close sidebar popup


*/